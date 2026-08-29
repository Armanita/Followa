import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
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
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _error = null; _loading = true; });
    try {
      final response = await AuthService.instance.get('/notifications?limit=100');
      if (mounted) setState(() => _items = response['items'] as List<dynamic>);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _readAll() async {
    try { await AuthService.instance.post('/notifications/read-all'); await _load(); }
    catch (error) { _message(error.toString()); }
  }

  Future<void> _open(Map<String, dynamic> notification) async {
    final unread = notification['readAt'] == null;
    if (unread) {
      try { await AuthService.instance.post('/notifications/${notification['id']}/read'); }
      catch (_) {}
    }
    if (!mounted) return;
    if (notification['linkType'] == 'CASE' && notification['linkId'] != null) {
      await Navigator.push(context, MaterialPageRoute(builder: (_) => CaseDetailScreen(caseId: notification['linkId'].toString())));
    }
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('اعلان‌ها'), actions: [TextButton(onPressed: _readAll, child: const Text('خواندن همه'))]),
      body: RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 110), children: [
        if (_loading) const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator()))
        else if (_error != null) ErrorState(message: _error!, onRetry: _load)
        else if (_items.isEmpty) const PremiumPanel(child: EmptyState(title: 'اعلانی ندارید'))
        else ..._items.map((raw) {
          final n = raw as Map<String, dynamic>;
          final unread = n['readAt'] == null;
          final icon = <String, IconData>{
            'CASE_ASSIGNED': Icons.move_to_inbox_outlined,
            'CASE_ACCEPTED': Icons.check_circle_outline,
            'CASE_REJECTED': Icons.cancel_outlined,
            'REMINDER_DUE': Icons.alarm_rounded,
            'CASE_COMPLETED': Icons.flag_outlined,
            'CASE_UPDATED': Icons.edit_note_rounded,
          }[n['type']] ?? Icons.notifications_none_rounded;
          return Padding(padding: const EdgeInsets.only(bottom: 8), child: Material(color: Colors.transparent, child: InkWell(onTap: () => _open(n), borderRadius: BorderRadius.circular(17), child: Container(padding: const EdgeInsets.all(13), decoration: BoxDecoration(color: unread ? FollowaColors.brand.withOpacity(.08) : FollowaColors.surface, borderRadius: BorderRadius.circular(17), border: Border.all(color: unread ? FollowaColors.brandSoft.withOpacity(.20) : FollowaColors.border)), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 38, height: 38, alignment: Alignment.center, decoration: BoxDecoration(color: unread ? FollowaColors.brand.withOpacity(.12) : FollowaColors.elevated, borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: unread ? FollowaColors.brandSoft : FollowaColors.soft, size: 19)),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(children: [Expanded(child: Text(n['title']?.toString() ?? 'اعلان', style: TextStyle(color: FollowaColors.ink, fontSize: 11.5, fontWeight: unread ? FontWeight.w900 : FontWeight.w700))), if (unread) Container(width: 7, height: 7, decoration: const BoxDecoration(color: FollowaColors.brandSoft, shape: BoxShape.circle))]), if ((n['body'] ?? '').toString().isNotEmpty) ...[const SizedBox(height: 4), Text(n['body'].toString(), maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: FollowaColors.muted, fontSize: 9.5, height: 1.5))], const SizedBox(height: 5), Text(Fa.dateTime(DateTime.parse(n['createdAt'].toString())), style: const TextStyle(color: FollowaColors.soft, fontSize: 8.5))])),
          ])))));
        }),
      ])),
    );
  }

  void _message(String text) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text))); }
}
