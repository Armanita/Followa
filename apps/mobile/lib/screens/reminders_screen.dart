import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../widgets/common.dart';

class RemindersScreen extends StatefulWidget {
  const RemindersScreen({super.key});

  @override
  State<RemindersScreen> createState() => _RemindersScreenState();
}

class _RemindersScreenState extends State<RemindersScreen> {
  List<dynamic> _items = [];
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      await AuthService.instance.get('/reminders/due-check').timeout(const Duration(seconds: 5));
    } catch (_) {}
    try {
      final res = await AuthService.instance.get('/reminders?status=ACTIVE');
      setState(() => _items = res['items']);
    } catch (e) { setState(() => _error = e.toString()); }
  }

  Future<void> _complete(Map<String, dynamic> r) async {
    final ctrl = TextEditingController(text: r['note'] ?? '');
    if (!mounted) return;
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: const Text('ثبت نتیجه یادآوری'),
      content: TextField(controller: ctrl, maxLines: 3, decoration: const InputDecoration(hintText: 'نتیجه پیگیری (روی پرونده درج می‌شود)')),
      actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('انصراف')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('انجام شد'))]));
    if (ok == true) {
      try {
        await AuthService.instance.post('/reminders/${r['id']}/complete', {'result': ctrl.text.isEmpty ? null : ctrl.text});
        await _load();
      } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()))); }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('یادآوری‌ها')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _error != null
            ? ListView(children: [ErrorState(message: _error!, onRetry: _load)])
            : _items.isEmpty
                ? ListView(children: const [EmptyState(title: 'یادآوری فعالی ندارید', hint: 'از جزئیات پرونده، یادآوری جدید بسازید')])
                : ListView.separated(
                    padding: const EdgeInsets.all(14),
                    itemCount: _items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final r = _items[i] as Map<String, dynamic>;
                      final overdue = DateTime.parse(r['remindAt']).isBefore(DateTime.now());
                      return Card(child: ListTile(
                        leading: Icon(overdue ? Icons.local_fire_department : Icons.alarm,
                            color: overdue ? const Color(0xFFDC2626) : const Color(0xFFF59E0B)),
                        title: Text(r['note'] ?? r['case']['title'],
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                        subtitle: Text('${Fa.dateTime(DateTime.parse(r['remindAt']))} · ${r['case']['title']}',
                            maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500)),
                        trailing: FilledButton(
                          style: FilledButton.styleFrom(minimumSize: const Size(0, 36), padding: const EdgeInsets.symmetric(horizontal: 12), backgroundColor: const Color(0xFF059669)),
                          onPressed: () => _complete(r),
                          child: const Text('انجام', style: TextStyle(fontSize: 12))),
                      ));
                    })),
    );
  }
}
