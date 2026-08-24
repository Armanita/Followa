import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../widgets/common.dart';

class CaseDetailScreen extends StatefulWidget {
  final String caseId;
  const CaseDetailScreen({super.key, required this.caseId});

  @override
  State<CaseDetailScreen> createState() => _CaseDetailScreenState();
}

class _CaseDetailScreenState extends State<CaseDetailScreen> {
  Map<String, dynamic>? _c;
  List<dynamic> _activities = [];
  List<dynamic> _assignments = [];
  String? _error;
  bool _hasActiveSession = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final auth = AuthService.instance;
      final c = await auth.get('/cases/${widget.caseId}');
      final acts = await auth.get('/cases/${widget.caseId}/activities');
      final asgns = await auth.get('/cases/${widget.caseId}/assignments');
      final active = await auth.get('/work-sessions/active');
      setState(() {
        _c = c as Map<String, dynamic>;
        _activities = acts as List;
        _assignments = (asgns['items'] as List).reversed.toList();
        _hasActiveSession =
            (active['items'] as List).any((s) => s['caseId'] == widget.caseId);
      });
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  Future<void> _action(Future<dynamic> Function() fn, String success) async {
    try {
      await fn();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(success)));
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = _c;
    return Scaffold(
      appBar: AppBar(title: const Text('جزئیات پرونده')),
      body: _error != null
          ? ErrorState(message: _error!, onRetry: _load)
          : c == null
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(padding: const EdgeInsets.all(16), children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(color: const Color(0xFF2558EB).withOpacity(0.08), borderRadius: BorderRadius.circular(8)),
                              child: Text('#${Fa.num(c['number'])}', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF2558EB)))),
                            const Spacer(),
                            StatusChip(status: c['status']),
                          ]),
                          const SizedBox(height: 10),
                          Text(c['title'], style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
                          if ((c['description'] ?? '').toString().isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Text(c['description'], style: TextStyle(fontSize: 13.5, height: 1.9, color: Colors.grey.shade700)),
                          ],
                          const Divider(height: 24),
                          _kv('مسئول فعلی', c['currentOwner'] != null ? '${c['currentOwner']['firstName']} ${c['currentOwner']['lastName']}' : '—'),
                          _kv('سازنده', '${c['createdBy']['firstName']} ${c['createdBy']['lastName']}'),
                          _kv('زمان کار ثبت‌شده', Fa.duration((c['totalWorkSeconds'] ?? 0) as int)),
                          if ((c['result'] ?? '').toString().isNotEmpty) ...[
                            const SizedBox(height: 8),
                            Container(width: double.infinity, padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(color: const Color(0xFFECFDF5), borderRadius: BorderRadius.circular(12)),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                const Text('نتیجه ثبت‌شده', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: Color(0xFF047857))),
                                const SizedBox(height: 4),
                                Text(c['result'], style: const TextStyle(fontSize: 13, height: 1.8)),
                              ])),
                          ],
                        ]),
                      ),
                    ),
                    // Pending acceptance banner
                    if (c['hasPendingAcceptanceForMe'] == true && c['status'] == 'WAITING_ACCEPTANCE')
                      Container(
                        margin: const EdgeInsets.only(top: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(color: const Color(0xFFFFFBEB), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFFDE68A))),
                        child: Column(children: [
                          const Text('این پرونده به شما ارجاع شده است.', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                          const SizedBox(height: 10),
                          Row(children: [
                            Expanded(child: FilledButton(
                              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF059669)),
                              onPressed: () => _action(() => AuthService.instance.post('/cases/${widget.caseId}/accept'), 'پرونده پذیرفته شد'),
                              child: const Text('پذیرش'))),
                            const SizedBox(width: 10),
                            Expanded(child: OutlinedButton(
                              style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFFDC2626), side: const BorderSide(color: Color(0xFFFECACA))),
                              onPressed: _rejectDialog,
                              child: const Text('رد کردن'))),
                          ]),
                        ]),
                      ),
                    // Actions
                    if (!_isClosed(c['status']))
                      Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Wrap(spacing: 8, runSpacing: 8, children: [
                          if (_isOwner(c))
                            ActionChip(
                              avatar: Icon(_hasActiveSession ? Icons.stop : Icons.play_arrow, size: 18,
                                  color: _hasActiveSession ? const Color(0xFFDC2626) : const Color(0xFF059669)),
                              label: Text(_hasActiveSession ? 'پایان کار' : 'شروع کار'),
                              onPressed: () => _action(
                                () => _hasActiveSession
                                    ? AuthService.instance.post('/work-sessions/end', {'caseId': widget.caseId})
                                    : AuthService.instance.post('/work-sessions/start', {'caseId': widget.caseId}),
                                _hasActiveSession ? 'پایان کار ثبت شد' : 'شروع کار ثبت شد'),
                            ),
                          if (c['canEdit'] == true || _isOwner(c)) ...[
                            ActionChip(
                              avatar: const Icon(Icons.edit_note, size: 18),
                              label: const Text('ثبت نتیجه'),
                              onPressed: _resultDialog),
                            ActionChip(
                              avatar: const Icon(Icons.send_outlined, size: 18),
                              label: const Text('انتقال'),
                              onPressed: _transferDialog),
                            ActionChip(
                              avatar: const Icon(Icons.alarm_add_outlined, size: 18),
                              label: const Text('یادآوری'),
                              onPressed: _reminderDialog),
                          ],
                        ]),
                      ),

                    const SizedBox(height: 18),
                    Card(
                      child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('گردش ارجاع', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                        const SizedBox(height: 10),
                        if (_assignments.isEmpty) Text('ارجاعی ثبت نشده است', style: TextStyle(color: Colors.grey.shade500, fontSize: 12.5)),
                        ..._assignments.map((a) {
                          final m = a as Map<String, dynamic>;
                          final from = m['fromUs'];
                          final to = m['toUs'];
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Container(width: double.infinity, padding: const EdgeInsets.all(11),
                              decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(12)),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text('${from != null ? '${from['firstName']} ${from['lastName']}' : 'سیستم'} ← ${to['firstName']} ${to['lastName']}',
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                                const SizedBox(height: 3),
                                Text(m['reason'] == 'INITIAL_ASSIGNMENT' ? 'ارجاع اولیه' : m['reason'] == 'TRANSFER' ? 'انتقال' : 'بازگشت (رد)',
                                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                                Text(Fa.dateTime(DateTime.parse(m['createdAt'])), style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
                                if ((m['note'] ?? '').toString().isNotEmpty)
                                  Padding(padding: const EdgeInsets.only(top: 4), child: Text(m['note'], style: TextStyle(fontSize: 12, color: Colors.grey.shade600))),
                                if ((m['rejectReason'] ?? '').toString().isNotEmpty)
                                  Padding(padding: const EdgeInsets.only(top: 4), child: Text('دلیل رد: ${m['rejectReason']}', style: const TextStyle(fontSize: 12, color: Color(0xFFB91C1C)))),
                              ])),
                          );
                        }),
                      ])),
                    ),
                    const SizedBox(height: 12),
                    Card(
                      child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('خط زمان فعالیت‌ها', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                        const SizedBox(height: 10),
                        ..._activities.reversed.map((e) {
                          final a = e as Map<String, dynamic>;
                          return ListTile(dense: true, contentPadding: EdgeInsets.zero,
                            leading: CircleAvatar(radius: 14, backgroundColor: Colors.grey.shade100,
                              child: const Icon(Icons.circle, size: 7, color: Color(0xFF2558EB))),
                            title: Text(activityLabels[a['type']] ?? a['type'], style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
                            subtitle: Text(a['actor'] != null ? '${a['actor']['firstName']} ${a['actor']['lastName']}' : '',
                                style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500)),
                            trailing: Text(Fa.dateTime(DateTime.parse(a['createdAt'])), style: TextStyle(fontSize: 10.5, color: Colors.grey.shade400)));
                        }),
                      ])),
                    ),
                    const SizedBox(height: 24),
                  ]),
                ),
    );
  }

  bool _isClosed(String status) => status == 'DONE' || status == 'CANCELLED';

  bool _isOwner(Map<String, dynamic> c) =>
      c['currentOwner'] != null && c['currentOwner']['id'] == AuthService.instance.user?['id'];

  Widget _kv(String k, String v) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Row(children: [
      SizedBox(width: 110, child: Text(k, style: TextStyle(fontSize: 12, color: Colors.grey.shade500))),
      Expanded(child: Text(v, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600))),
    ]));

  Future<void> _rejectDialog() async {
    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (_) => AlertDialog(
      title: const Text('رد کردن ارجاع'),
      content: TextField(controller: ctrl, maxLines: 3, autofocus: true,
        decoration: const InputDecoration(hintText: 'دلیل رد کردن (الزامی)')),
      actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('انصراف')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('ثبت رد'))],
    ));
    if (ok == true && ctrl.text.trim().length >= 3) {
      await _action(() => AuthService.instance.post('/cases/${widget.caseId}/reject', {'reason': ctrl.text.trim()}),
          'پرونده رد و بازگشت داده شد');
    }
  }

  Future<void> _resultDialog() async {
    final ctrl = TextEditingController();
    var complete = true;
    final ok = await showDialog<bool>(context: context, builder: (_) => StatefulBuilder(builder: (ctx, setD) => AlertDialog(
      title: const Text('ثبت نتیجه'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: ctrl, maxLines: 4, autofocus: true, decoration: const InputDecoration(hintText: 'نتیجه پیگیری…')),
        CheckboxListTile(value: complete, onChanged: (v) => setD(() => complete = v!), activeColor: Theme.of(ctx).colorScheme.primary,
          contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, title: const Text('پرونده تکمیل شود', style: TextStyle(fontSize: 13.5))),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('انصراف')),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('ثبت'))],
    )));
    if (ok == true && ctrl.text.trim().length >= 2) {
      await _action(() => AuthService.instance.post('/cases/${widget.caseId}/result', {'result': ctrl.text.trim(), 'complete': complete}),
          complete ? 'پرونده تکمیل شد' : 'نتیجه ثبت شد');
    }
  }

  Future<void> _transferDialog() async {
    List<dynamic> members = [];
    try { final r = await AuthService.instance.get('/members'); members = r['items']; } catch (_) {}
    if (!mounted) return;
    Map<String, dynamic>? selected;
    final noteCtrl = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (_) => StatefulBuilder(builder: (ctx, setD) => AlertDialog(
      title: const Text('انتقال پرونده'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        DropdownButtonFormField<Map<String, dynamic>>(
          items: [for (final m in members.where((m) => m['userId'] != AuthService.instance.user?['id']))
            DropdownMenuItem(value: m, child: Text('${m['fullName']} (${m['role'] == 'COMPANY_MANAGER' ? 'مدیر' : 'کارمند'})'))],
          onChanged: (v) => setD(() => selected = v),
          decoration: const InputDecoration(labelText: 'انتقال به')),
        const SizedBox(height: 12),
        TextField(controller: noteCtrl, maxLines: 2, decoration: const InputDecoration(labelText: 'توضیح (اختیاری)')),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('انصراف')),
        FilledButton(onPressed: selected == null ? null : () => Navigator.pop(ctx, true), child: const Text('انتقال'))],
    )));
    if (ok == true && selected != null) {
      await _action(() => AuthService.instance.post('/cases/${widget.caseId}/transfer',
          {'toUserId': selected!['userId'], 'note': noteCtrl.text.isEmpty ? null : noteCtrl.text}), 'پرونده ارجاع شد');
    }
  }

  Future<void> _reminderDialog() async {
    final date = await showDatePicker(context: context, firstDate: DateTime.now(), initialDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.now());
    if (time == null) return;
    final dt = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    await _action(() => AuthService.instance.post('/reminders', {'caseId': widget.caseId, 'remindAt': dt.toIso8601String()}), 'یادآوری ساخته شد');
  }
}
