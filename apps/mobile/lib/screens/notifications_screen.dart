import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../widgets/common.dart';
import 'case_detail_screen.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<dynamic> _items = [];
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final res = await AuthService.instance.get('/notifications?limit=100');
      setState(() => _items = res['items']);
    } catch (e) { setState(() => _error = e.toString()); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('اعلان‌ها'), actions: [
        TextButton(onPressed: () async { await AuthService.instance.post('/notifications/read-all'); _load(); }, child: const Text('خواندن همه')),
      ]),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _error != null
            ? ListView(children: [ErrorState(message: _error!, onRetry: _load)])
            : _items.isEmpty
                ? ListView(children: const [EmptyState(title: 'اعلانی ندارید')])
                : ListView.separated(
                    padding: const EdgeInsets.all(12),
                    itemCount: _items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 6),
                    itemBuilder: (context, i) {
                      final n = _items[i] as Map<String, dynamic>;
                      final unread = n['readAt'] == null;
                      final icon = {
                        'CASE_ASSIGNED': Icons.move_to_inbox_outlined,
                        'CASE_ACCEPTED': Icons.check_circle_outline,
                        'CASE_REJECTED': Icons.cancel_outlined,
                        'REMINDER_DUE': Icons.alarm,
                        'CASE_COMPLETED': Icons.flag_outlined,
                        'CASE_UPDATED': Icons.edit_note,
                      }[n['type']] ?? Icons.notifications_none;
                      return Card(
                        color: unread ? const Color(0xFFEFF6FF) : Colors.white,
                        child: ListTile(
                          onTap: () async {
                            if (!unread) return;
                            try { await AuthService.instance.post('/notifications/${n['id']}/read'); } catch (_) {}
                            if (n['linkType'] == 'CASE' && mounted) {
                              Navigator.push(context, MaterialPageRoute(builder: (_) => CaseDetailScreen(caseId: n['linkId'])));
                            }
                            _load();
                          },
                          leading: Icon(icon, color: unread ? const Color(0xFF2558EB) : Colors.grey.shade500),
                          title: Text(n['title'], style: TextStyle(fontWeight: unread ? FontWeight.w800 : FontWeight.w500, fontSize: 13.5)),
                          subtitle: Text(n['body'] ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                          trailing: Text(Fa.dateTime(DateTime.parse(n['createdAt'])), style: TextStyle(fontSize: 10, color: Colors.grey.shade400)),
                        ));
                    })),
    );
  }
}
