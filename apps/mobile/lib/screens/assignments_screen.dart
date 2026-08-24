import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../widgets/common.dart';
import 'case_detail_screen.dart';

class AssignmentsScreen extends StatefulWidget {
  const AssignmentsScreen({super.key});

  @override
  State<AssignmentsScreen> createState() => _AssignmentsScreenState();
}

class _AssignmentsScreenState extends State<AssignmentsScreen> {
  List<dynamic> _items = [];
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final res = await AuthService.instance.get('/assignments/pending');
      setState(() => _items = (res['items'] as List).where((a) => a['case']['status'] == 'WAITING_ACCEPTANCE').toList());
    } catch (e) { setState(() => _error = e.toString()); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('ارجاع‌های جدید')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _error != null
            ? ListView(children: [ErrorState(message: _error!, onRetry: _load)])
            : _items.isEmpty
                ? ListView(children: const [EmptyState(title: 'ارجاع در انتظاری ندارید', hint: 'پرونده‌های ارجاع‌شده به شما اینجا ظاهر می‌شود')])
                : ListView.separated(
                    padding: const EdgeInsets.all(14),
                    itemCount: _items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final a = _items[i] as Map<String, dynamic>;
                      final c = a['case'] as Map<String, dynamic>;
                      return Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Text('#${Fa.num(c['number'])}', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Colors.grey.shade500)),
                          const Spacer(),
                          StatusChip(status: c['status']),
                        ]),
                        const SizedBox(height: 8),
                        InkWell(onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => CaseDetailScreen(caseId: c['id']))),
                          child: Text(c['title'], style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15))),
                        if ((a['note'] ?? '').toString().isNotEmpty)
                          Padding(padding: const EdgeInsets.only(top: 8), child: Container(width: double.infinity, padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(color: const Color(0xFFEFF6FF), borderRadius: BorderRadius.circular(10)),
                            child: Text('پیام: ${a['note']}', style: const TextStyle(fontSize: 12.5)))),
                        const SizedBox(height: 12),
                        Row(children: [
                          Expanded(child: FilledButton(
                            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF059669)),
                            onPressed: () async {
                              try {
                                await AuthService.instance.post('/cases/${c['id']}/accept');
                                await _load();
                              } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()))); }
                            },
                            child: const Text('پذیرش'))),
                          const SizedBox(width: 10),
                          Expanded(child: OutlinedButton(
                            style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFFDC2626)),
                            onPressed: () async {
                              final ctrl = TextEditingController();
                              final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
                                title: const Text('رد کردن'),
                                content: TextField(controller: ctrl, maxLines: 3, decoration: const InputDecoration(hintText: 'دلیل رد کردن (الزامی)')),
                                actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('انصراف')),
                                  FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('ثبت رد'))]));
                              if (ok == true && ctrl.text.trim().length >= 3) {
                                try {
                                  await AuthService.instance.post('/cases/${c['id']}/reject', {'reason': ctrl.text.trim()});
                                  await _load();
                                } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()))); }
                              }
                            },
                            child: const Text('رد کردن'))),
                        ]),
                      ])));
                    })),
    );
  }
}
