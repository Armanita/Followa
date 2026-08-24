import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../widgets/common.dart';

/// Manager-only reports tab (30-day employee stats).
class ReportsTab extends StatefulWidget {
  const ReportsTab({super.key});

  @override
  State<ReportsTab> createState() => _ReportsTabState();
}

class _ReportsTabState extends State<ReportsTab> {
  List<dynamic> _items = [];
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final res = await AuthService.instance.get('/reports/employees');
      setState(() => _items = res['items']);
    } catch (e) { setState(() => _error = e.toString()); }
  }

  @override
  Widget build(BuildContext context) {
    final employees = _items.where((r) => r['role'] != 'COMPANY_MANAGER').toList();
    return Scaffold(
      appBar: AppBar(title: const Text('گزارش کارکنان')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _error != null
            ? ListView(children: [ErrorState(message: _error!, onRetry: _load)])
            : ListView(padding: const EdgeInsets.all(14), children: [
                Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('زمان کار ثبت‌شده (۳۰ روز)', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  const SizedBox(height: 14),
                  for (final r in employees)
                    Padding(padding: const EdgeInsets.only(bottom: 12), child: Column(children: [
                      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                        Text(r['user']['fullName'], style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                        Text(Fa.duration((r['workSeconds30d'] ?? 0) as int), style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500)),
                      ]),
                      const SizedBox(height: 5),
                      ClipRRect(borderRadius: BorderRadius.circular(99),
                        child: LinearProgressIndicator(
                          value: _maxWork() == 0 ? 0 : (r['workSeconds30d'] as int) / _maxWork(),
                          minHeight: 8,
                          backgroundColor: Colors.grey.shade100,
                          color: const Color(0xFF2558EB))),
                    ])),
                ]))),
                Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('آمار پرونده‌ها', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                  const SizedBox(height: 8),
                  ..._items.map((r) => ListTile(dense: true, contentPadding: EdgeInsets.zero,
                    title: Text(r['user']['fullName'], style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
                    subtitle: Text('فعال: ${Fa.num(r['ownedActiveCases'])} · تکمیل‌شده: ${Fa.num(r['completedCases'])} · در انتظار پذیرش او: ${Fa.num(r['pendingAssignments'])}',
                        style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500)),
                    trailing: Text('${Fa.num(r['sessions30d'])} نشست', style: TextStyle(fontSize: 11, color: Colors.grey.shade500)))),
                ]))),
              ]),
      ),
    );
  }

  int _maxWork() {
    var max = 1;
    for (final r in _items) {
      final v = (r['workSeconds30d'] ?? 0) as int;
      if (v > max) max = v;
    }
    return max;
  }
}
