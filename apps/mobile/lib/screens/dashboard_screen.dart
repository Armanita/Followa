import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../widgets/common.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _data;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final path = AuthService.instance.isManager
          ? '/dashboard/manager'
          : '/dashboard/employee';
      final res = await AuthService.instance.get(path);
      setState(() => _data = res as Map<String, dynamic>);
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('داشبورد فالوآ')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _error != null
            ? ListView(children: [ErrorState(message: _error!, onRetry: _load)])
            : _data == null
                ? const Center(child: CircularProgressIndicator())
                : _buildBody(context),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    final cards = _data!['cards'] as Map<String, dynamic>;
    final isManager = AuthService.instance.isManager;

    Widget stat(String label, Object value, {Color color = const Color(0xFF2558EB)}) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600)),
              const SizedBox(height: 6),
              Text(Fa.num(value), style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: color)),
            ],
          ),
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('سلام ${AuthService.instance.fullName} 👋',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
        Text(isManager ? 'نمای کلی پرونده‌ها و فعالیت کارکنان' : 'خلاصه کارهای امروز شما',
            style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
        const SizedBox(height: 16),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          childAspectRatio: 1.9,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          children: isManager
              ? [
                  stat('کل پرونده‌ها', cards['totalCases']),
                  stat('باز', cards['openCases'], color: const Color(0xFF0284C7)),
                  stat('در حال انجام', cards['inProgress']),
                  stat('انتظار پذیرش', cards['waitingAcceptance'], color: const Color(0xFFF59E0B)),
                  stat('عقب‌افتاده', cards['lateCases'], color: const Color(0xFFDC2626)),
                  stat('کارکنان فعال', cards['activeEmployees'], color: const Color(0xFF059669)),
                ]
              : [
                  stat('کارهای من', cards['myCases']),
                  stat('یادآوری امروز', cards['todayReminders'], color: const Color(0xFFF59E0B)),
                  stat('ارجاع جدید', cards['newAssignments'], color: const Color(0xFFDC2626)),
                  stat('کار فعال', cards['activeWork']),
                  stat('تکمیل‌شده', cards['completedCases'], color: const Color(0xFF059669)),
                ],
        ),
        if (isManager) ...[
          const SizedBox(height: 18),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('وضعیت پرونده‌ها', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                const SizedBox(height: 12),
                ...(((_data!['statusChart'] ?? []) as List).map((e) {
                  final row = e as Map<String, dynamic>;
                  final total = ((_data!['statusChart']) as List)
                      .fold<int>(0, (s, x) => s + ((x as Map<String, dynamic>)['count'] as int));
                  final c = row['count'] as int;
                  final frac = total == 0 ? 0.0 : c / total;
                  final color = statusColors[row['status']] ?? Colors.grey;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(children: [
                      Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                      const SizedBox(width: 8),
                      Expanded(child: Text(statusLabels[row['status']] ?? '', style: const TextStyle(fontSize: 13))),
                      SizedBox(
                        width: 110,
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(99),
                          child: LinearProgressIndicator(value: frac, minHeight: 7, backgroundColor: Colors.grey.shade100, color: color),
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(width: 30, child: Text(Fa.num(c), textAlign: TextAlign.left, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5))),
                    ]),
                  );
                })),
              ]),
            ),
          ),
        ],
        if (!isManager && (_data!['remindersToday'] as List?)?.isNotEmpty == true) ...[
          const SizedBox(height: 18),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('یادآوری‌های امروز ⏰', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                const SizedBox(height: 10),
                ...((_data!['remindersToday'] as List).map((e) {
                  final r = e as Map<String, dynamic>;
                  return ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.alarm, color: Color(0xFFF59E0B)),
                    title: Text(r['note'] ?? r['case']['title'], style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
                    subtitle: Text(Fa.dateTime(DateTime.parse(r['remindAt'])), style: const TextStyle(fontSize: 11.5)),
                  );
                })),
              ]),
            ),
          ),
        ],
      ],
    );
  }
}
