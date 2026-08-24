import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../widgets/common.dart';
import 'case_detail_screen.dart';
import 'new_case_screen.dart';
import 'employees_tab.dart';
import 'reports_tab.dart';

class CasesScreen extends StatefulWidget {
  final bool mineOnly;
  const CasesScreen({super.key, this.mineOnly = false});

  @override
  State<CasesScreen> createState() => _CasesScreenState();
}

class _CasesScreenState extends State<CasesScreen> {
  List<dynamic> _items = [];
  String? _error;
  String _search = '';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final q = StringBuffer('/cases?pageSize=50');
      if (widget.mineOnly) q.write('&mine=true');
      if (_search.isNotEmpty) q.write('&search=${Uri.encodeComponent(_search)}');
      final res = await AuthService.instance.get(q.toString());
      setState(() => _items = (res['items'] as List));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.mineOnly ? 'کارهای من' : 'پرونده‌ها'),
        actions: [
          IconButton(onPressed: () async { await Navigator.push(context, MaterialPageRoute(builder: (_) => const NewCaseScreen())); await _load(); }, icon: const Icon(Icons.add)),
        ],
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: TextField(
            decoration: const InputDecoration(hintText: 'جستجو در عنوان…', prefixIcon: Icon(Icons.search)),
            textInputAction: TextInputAction.search,
            onSubmitted: (v) { _search = v; _load(); },
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: _error != null
                ? ListView(children: [ErrorState(message: _error!, onRetry: _load)])
                : _loading
                    ? const Center(child: CircularProgressIndicator())
                    : _items.isEmpty
                        ? ListView(children: const [EmptyState(title: 'پرونده‌ای یافت نشد', hint: 'با دکمه + پرونده جدید بسازید')])
                        : ListView.separated(
                            padding: const EdgeInsets.all(14),
                            itemCount: _items.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 8),
                            itemBuilder: (context, i) {
                              final c = _items[i] as Map<String, dynamic>;
                              return Card(
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(16),
                                  onTap: () async {
                                    await Navigator.push(context, MaterialPageRoute(builder: (_) => CaseDetailScreen(caseId: c['id'])));
                                    _load();
                                  },
                                  child: Padding(
                                    padding: const EdgeInsets.all(13),
                                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                      Row(children: [
                                        Container(padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                          decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(8)),
                                          child: Text('#${Fa.num(c['number'])}', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.grey.shade600))),
                                        if (c['priority'] == 'URGENT' || c['priority'] == 'HIGH')
                                          Padding(
                                            padding: const EdgeInsets.only(right: 6),
                                            child: Text(priorityLabels[c['priority']]!,
                                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800,
                                                  color: c['priority'] == 'URGENT' ? const Color(0xFFDC2626) : const Color(0xFFEA580C))),
                                          ),
                                        const Spacer(),
                                        StatusChip(status: c['status']),
                                      ]),
                                      const SizedBox(height: 8),
                                      Text(c['title'], maxLines: 1, overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
                                      const SizedBox(height: 5),
                                      Text('مسئول: ${c['currentOwner'] != null ? '${c['currentOwner']['firstName']} ${c['currentOwner']['lastName']}' : 'در انتظار پذیرش'}',
                                          style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500)),
                                    ]),
                                  ),
                                ),
                              );
                            },
                          ),
          ),
        ),
      ]),
    );
  }
}
