import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../widgets/common.dart';

/// Manager-only tab listing employees with activate/suspend/reset actions.
class EmployeesTab extends StatefulWidget {
  const EmployeesTab({super.key});

  @override
  State<EmployeesTab> createState() => _EmployeesTabState();
}

class _EmployeesTabState extends State<EmployeesTab> {
  List<dynamic> _items = [];
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final res = await AuthService.instance.get('/members');
      setState(() => _items = res['items']);
    } catch (e) { setState(() => _error = e.toString()); }
  }

  Future<void> _toggle(Map<String, dynamic> m) async {
    try {
      await AuthService.instance.patch('/members/${m['membershipId']}', {'isActive': !m['isActive']});
      await _load();
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()))); }
  }

  Future<void> _resetPassword(Map<String, dynamic> m) async {
    final ctrl = TextEditingController();
    if (!mounted) return;
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: Text('بازنشانی رمز ${m['fullName']}'),
      content: TextField(controller: ctrl, obscureText: true, decoration: const InputDecoration(labelText: 'رمز جدید (حداقل ۸ کاراکتر)')),
      actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('انصراف')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('بازنشانی'))]));
    if (ok == true && ctrl.text.length >= 8) {
      try {
        await AuthService.instance.post('/members/${m['membershipId']}/reset-password', {'newPassword': ctrl.text});
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('رمز بازنشانی شد')));
      } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()))); }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('کارکنان')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _error != null
            ? ListView(children: [ErrorState(message: _error!, onRetry: _load)])
            : _items.isEmpty
                ? ListView(children: const [EmptyState(title: 'عضوی ثبت نشده است')])
                : ListView.separated(
                    padding: const EdgeInsets.all(14),
                    itemCount: _items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final m = _items[i] as Map<String, dynamic>;
                      return Card(child: ListTile(
                        leading: CircleAvatar(backgroundColor: Colors.grey.shade100,
                          child: Text('${m['firstName']}'[0], style: const TextStyle(fontWeight: FontWeight.w800))),
                        title: Text(m['fullName'], style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5)),
                        subtitle: Text(m['role'] == 'COMPANY_MANAGER' ? 'مدیر' : (m['jobTitle'] ?? 'کارمند'),
                            style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                        trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                          Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                            decoration: BoxDecoration(
                              color: m['isActive'] ? const Color(0xFFECFDF5) : const Color(0xFFFEF2F2),
                              borderRadius: BorderRadius.circular(99)),
                            child: Text(m['isActive'] ? 'فعال' : 'غیرفعال',
                                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
                                    color: m['isActive'] ? const Color(0xFF047857) : const Color(0xFFB91C1C)))),
                          PopupMenuButton<String>(onSelected: (v) {
                            if (v == 'toggle') _toggle(m);
                            if (v == 'reset') _resetPassword(m);
                          }, itemBuilder: (_) => [
                            PopupMenuItem(value: 'toggle', child: Text(m['isActive'] ? 'تعلیق دسترسی' : 'فعال‌سازی')),
                            PopupMenuItem(value: 'reset', child: const Text('بازنشانی رمز')),
                          ]),
                        ]),
                      ));
                    })),
    );
  }
}
