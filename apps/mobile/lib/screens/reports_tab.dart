import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
import '../widgets/common.dart';

class ReportsTab extends StatefulWidget {
  const ReportsTab({super.key});
  @override
  State<ReportsTab> createState() => _ReportsTabState();
}

class _ReportsTabState extends State<ReportsTab> {
  List<dynamic> _items = [];
  String? _error;
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _error = null; _loading = true; });
    try {
      final response = await AuthService.instance.get('/reports/employees');
      if (mounted) setState(() => _items = response['items'] as List<dynamic>);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final employees = _items.where((raw) => (raw as Map<String, dynamic>)['role'] != 'COMPANY_MANAGER').toList();
    final active = employees.fold<int>(0, (sum, raw) => sum + (((raw as Map<String, dynamic>)['ownedActiveCases'] as num?)?.toInt() ?? 0));
    final completed = employees.fold<int>(0, (sum, raw) => sum + (((raw as Map<String, dynamic>)['completedCases'] as num?)?.toInt() ?? 0));
    final pending = employees.fold<int>(0, (sum, raw) => sum + (((raw as Map<String, dynamic>)['pendingAssignments'] as num?)?.toInt() ?? 0));
    final maxLoad = employees.fold<int>(1, (max, raw) {
      final r = raw as Map<String, dynamic>;
      final total = ((r['ownedActiveCases'] as num?)?.toInt() ?? 0) + ((r['completedCases'] as num?)?.toInt() ?? 0) + ((r['pendingAssignments'] as num?)?.toInt() ?? 0);
      return total > max ? total : max;
    });

    return Scaffold(
      appBar: AppBar(title: const Text('گزارش کارکنان')),
      body: RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 110), children: [
        if (_loading) const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator()))
        else if (_error != null) ErrorState(message: _error!, onRetry: _load)
        else ...[
          Row(children: [Expanded(child: _Summary(label: 'فعال تیم', value: active, color: FollowaColors.blue)), const SizedBox(width: 7), Expanded(child: _Summary(label: 'تکمیل‌شده', value: completed, color: FollowaColors.emerald)), const SizedBox(width: 7), Expanded(child: _Summary(label: 'انتظار پذیرش', value: pending, color: FollowaColors.amber))]),
          const SizedBox(height: 12),
          PremiumPanel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('بار عملیاتی تیم', style: TextStyle(color: FollowaColors.ink, fontSize: 14, fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            const Text('بر پایه پرونده‌های فعال، تکمیل‌شده و ارجاع‌های منتظر پاسخ؛ بدون تایمر و نشست کاری قدیمی.', style: TextStyle(color: FollowaColors.soft, fontSize: 9.5, height: 1.6)),
            const SizedBox(height: 16),
            if (employees.isEmpty) const EmptyState(title: 'کارمندی برای گزارش وجود ندارد')
            else ...employees.map((raw) {
              final r = raw as Map<String, dynamic>;
              final user = r['user'] as Map<String, dynamic>;
              final a = ((r['ownedActiveCases'] as num?)?.toInt() ?? 0);
              final c = ((r['completedCases'] as num?)?.toInt() ?? 0);
              final p = ((r['pendingAssignments'] as num?)?.toInt() ?? 0);
              final total = a + c + p;
              return Padding(padding: const EdgeInsets.only(bottom: 16), child: Column(children: [
                Row(children: [CircleAvatar(radius: 17, backgroundColor: FollowaColors.elevated, child: Text(user['fullName'].toString().substring(0, 1), style: const TextStyle(color: FollowaColors.brandSoft, fontSize: 11, fontWeight: FontWeight.w900))), const SizedBox(width: 9), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(user['fullName'].toString(), style: const TextStyle(color: FollowaColors.ink, fontWeight: FontWeight.w800, fontSize: 11)), const SizedBox(height: 2), Text('${Fa.num(a)} فعال · ${Fa.num(c)} تکمیل · ${Fa.num(p)} انتظار', style: const TextStyle(color: FollowaColors.soft, fontSize: 9))])), Text('${Fa.num(total)} مورد', style: const TextStyle(color: FollowaColors.muted, fontSize: 9.5, fontWeight: FontWeight.w800))]),
                const SizedBox(height: 7),
                ClipRRect(borderRadius: BorderRadius.circular(99), child: LinearProgressIndicator(value: total == 0 ? 0 : total / maxLoad, minHeight: 7, backgroundColor: FollowaColors.elevated, color: FollowaColors.brandSoft)),
              ]));
            }),
          ])),
        ],
      ])),
    );
  }
}

class _Summary extends StatelessWidget {
  final String label; final int value; final Color color;
  const _Summary({required this.label, required this.value, required this.color});
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: FollowaColors.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: color.withOpacity(.18))), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(Fa.num(value), style: TextStyle(color: color, fontSize: 21, fontWeight: FontWeight.w900)), const SizedBox(height: 5), Text(label, style: const TextStyle(color: FollowaColors.soft, fontSize: 8.5))]));
}
