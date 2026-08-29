import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
import '../utils/jalali_input.dart';
import '../widgets/common.dart';

class CaseDetailScreen extends StatefulWidget {
  final String caseId;
  const CaseDetailScreen({super.key, required this.caseId});

  @override
  State<CaseDetailScreen> createState() => _CaseDetailScreenState();
}

class _CaseDetailScreenState extends State<CaseDetailScreen> {
  Map<String, dynamic>? _case;
  List<dynamic> _activities = [];
  List<dynamic> _assignments = [];
  String? _error;
  bool _loading = true;
  bool _busy = false;

  bool get _isManager => AuthService.instance.isManager;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() { _loading = true; _error = null; });
    try {
      final auth = AuthService.instance;
      final values = await Future.wait([
        auth.get('/cases/${widget.caseId}'),
        auth.get('/cases/${widget.caseId}/activities'),
        auth.get('/cases/${widget.caseId}/assignments'),
      ]);
      if (!mounted) return;
      final assignmentResponse = values[2] as Map<String, dynamic>;
      setState(() {
        _case = values[0] as Map<String, dynamic>;
        _activities = values[1] as List<dynamic>;
        _assignments = (assignmentResponse['items'] as List<dynamic>? ?? const []).reversed.toList();
      });
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _run(Future<void> Function() action, String success) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
      if (!mounted) return;
      _message(success);
      await _load();
    } catch (error) {
      _message(error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _case == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_case == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('جزئیات پرونده')),
        body: ErrorState(message: _error ?? 'پرونده در دسترس نیست', onRetry: _load),
      );
    }

    final c = _case!;
    final closed = c['status'] == 'DONE' || c['status'] == 'CANCELLED';
    final canEdit = c['canEdit'] == true;
    final canTransfer = c['canTransfer'] == true;
    final pending = c['hasPendingAcceptanceForMe'] == true && c['status'] == 'WAITING_ACCEPTANCE';
    final files = (c['files'] as List<dynamic>?) ?? const [];
    final reminders = (c['reminders'] as List<dynamic>?) ?? const [];
    final effortMinutes = _activities.fold<int>(0, (sum, raw) {
      final payload = (raw as Map<String, dynamic>)['payload'];
      return sum + (payload is Map && payload['effortMinutes'] is num ? (payload['effortMinutes'] as num).toInt() : 0);
    });
    Map<String, dynamic>? activeReminder;
    for (final raw in reminders) {
      final reminder = raw as Map<String, dynamic>;
      if (reminder['status'] == 'ACTIVE') { activeReminder = reminder; break; }
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_isManager ? 'نظارت پرونده' : 'اجرای پرونده'),
        actions: [IconButton(onPressed: _busy ? null : _load, icon: const Icon(Icons.refresh_rounded))],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 32),
          children: [
            PremiumPanel(
              accent: statusColors[c['status']] ?? FollowaColors.brandSoft,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Text('#${Fa.num(c['number'] ?? '—')}', style: const TextStyle(color: FollowaColors.soft, fontWeight: FontWeight.w900)),
                  const SizedBox(width: 8),
                  StatusChip(status: c['status']?.toString() ?? ''),
                  const Spacer(),
                  Text(_isManager ? 'نظارت مدیریتی' : 'اجرای پرونده', style: const TextStyle(color: FollowaColors.soft, fontSize: 9.5)),
                ]),
                const SizedBox(height: 12),
                Text(c['title']?.toString() ?? 'پرونده', style: const TextStyle(color: FollowaColors.ink, fontSize: 18, height: 1.45, fontWeight: FontWeight.w900)),
              ]),
            ),
            const SizedBox(height: 10),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.85,
              children: [
                _Metric(label: 'مسئول فعلی', value: c['currentOwner'] == null ? 'در انتظار پذیرش' : '${c['currentOwner']['firstName']} ${c['currentOwner']['lastName']}', icon: Icons.person_outline_rounded),
                _Metric(label: 'سررسید', value: c['dueDate'] == null ? 'بدون سررسید' : Fa.date(DateTime.parse(c['dueDate'].toString())), icon: Icons.event_outlined),
                _Metric(label: 'زمان ثبت‌شده', value: effortMinutes == 0 ? 'ثبت نشده' : '${Fa.num(effortMinutes)} دقیقه', icon: Icons.timelapse_rounded),
                _Metric(label: 'مستندات', value: '${Fa.num(files.length)} فایل', icon: Icons.folder_copy_outlined),
              ],
            ),
            if (pending) ...[
              const SizedBox(height: 10),
              PremiumPanel(
                accent: FollowaColors.amber,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('این پرونده برای شما ارجاع شده است', style: TextStyle(color: Color(0xFFFDE68A), fontWeight: FontWeight.w900)),
                  const SizedBox(height: 10),
                  Row(children: [
                    Expanded(child: FilledButton(onPressed: _busy ? null : () => _run(() async { await AuthService.instance.post('/cases/${widget.caseId}/accept'); }, 'پرونده پذیرفته شد'), child: const Text('پذیرش'))),
                    const SizedBox(width: 8),
                    Expanded(child: OutlinedButton(onPressed: _busy ? null : _rejectDialog, child: const Text('رد ارجاع'))),
                  ]),
                ]),
              ),
            ],
            if (!closed && (canEdit || canTransfer)) ...[
              const SizedBox(height: 10),
              PremiumPanel(
                child: Wrap(spacing: 8, runSpacing: 8, children: [
                  if (!_isManager && canEdit)
                    FilledButton.icon(onPressed: _busy ? null : _resultDialog, icon: const Icon(Icons.edit_note_rounded, size: 18), label: const Text('ثبت نتیجه')),
                  if (canTransfer)
                    OutlinedButton.icon(onPressed: _busy ? null : _transferDialog, icon: const Icon(Icons.compare_arrows_rounded, size: 18), label: Text(c['status'] == 'WAITING_ACCEPTANCE' ? 'ارجاع مجدد' : 'انتقال')),
                  if (!_isManager && canEdit)
                    OutlinedButton.icon(onPressed: _busy ? null : _pickAndUpload, icon: const Icon(Icons.attach_file_rounded, size: 18), label: const Text('پیوست فایل')),
                  if (!_isManager && canEdit)
                    const Text('زمان صرف‌شده و پیگیری بعدی داخل «ثبت نتیجه» ثبت می‌شوند؛ تایمر شروع/پایان در جریان جدید وجود ندارد.', style: TextStyle(color: FollowaColors.soft, fontSize: 9.5, height: 1.7)),
                ]),
              ),
            ],
            const SizedBox(height: 10),
            _Section(
              title: 'شرح و نتیجه',
              icon: Icons.subject_rounded,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _TextBlock(label: 'شرح اولیه', text: (c['description'] ?? '').toString().trim().isEmpty ? 'شرح تکمیلی ثبت نشده است.' : c['description'].toString()),
                if ((c['result'] ?? '').toString().trim().isNotEmpty) ...[
                  const SizedBox(height: 10),
                  _TextBlock(label: 'آخرین نتیجه', text: c['result'].toString(), accent: FollowaColors.emerald, footer: c['resultAt'] == null ? null : Fa.dateTime(DateTime.parse(c['resultAt'].toString()))),
                ],
              ]),
            ),
            if (activeReminder != null) ...[
              const SizedBox(height: 10),
              _Section(
                title: 'پیگیری بعدی',
                icon: Icons.alarm_rounded,
                accent: FollowaColors.amber,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(Fa.dateTime(DateTime.parse(activeReminder['remindAt'].toString())), style: const TextStyle(color: Color(0xFFFDE68A), fontWeight: FontWeight.w900)),
                  if ((activeReminder['note'] ?? '').toString().trim().isNotEmpty) ...[const SizedBox(height: 5), Text(activeReminder['note'].toString(), style: const TextStyle(color: FollowaColors.muted, fontSize: 11))],
                ]),
              ),
            ],
            const SizedBox(height: 10),
            _Section(
              title: 'زمینه پرونده',
              icon: Icons.info_outline_rounded,
              child: Column(children: [
                _kv('ایجادکننده', '${c['createdBy']['firstName']} ${c['createdBy']['lastName']}'),
                _kv('نوع پرونده', c['caseType'] == null ? 'بدون نوع' : c['caseType']['name'].toString()),
                _kv('مشتری', c['customer'] == null ? 'بدون مشتری' : '${c['customer']['name']}${c['customer']['isActive'] == false ? ' · بایگانی' : ''}'),
                _kv('زمان ایجاد', Fa.dateTime(DateTime.parse(c['createdAt'].toString()))),
              ]),
            ),
            const SizedBox(height: 10),
            _files(files),
            const SizedBox(height: 10),
            _assignmentsPanel(),
            const SizedBox(height: 10),
            _activitiesPanel(),
          ],
        ),
      ),
    );
  }

  Widget _files(List<dynamic> files) => _Section(
    title: 'فایل‌ها و مستندات',
    icon: Icons.attach_file_rounded,
    child: files.isEmpty
        ? const Text('فایلی ثبت نشده است.', style: TextStyle(color: FollowaColors.soft, fontSize: 10.5))
        : Column(children: files.map((raw) {
            final file = raw as Map<String, dynamic>;
            return ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.insert_drive_file_outlined, color: FollowaColors.brandSoft),
              title: Text(file['filename']?.toString() ?? 'فایل', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: FollowaColors.ink, fontSize: 11, fontWeight: FontWeight.w800)),
              subtitle: Text('${file['uploader']?['firstName'] ?? ''} ${file['uploader']?['lastName'] ?? ''}'.trim(), style: const TextStyle(color: FollowaColors.soft, fontSize: 9.5)),
              trailing: const Icon(Icons.download_rounded, color: FollowaColors.muted),
              onTap: () => _openFile(file),
            );
          }).toList()),
  );

  Widget _assignmentsPanel() => _Section(
    title: 'گردش مسئولیت',
    icon: Icons.swap_horiz_rounded,
    child: _assignments.isEmpty
        ? const Text('ارجاعی ثبت نشده است.', style: TextStyle(color: FollowaColors.soft, fontSize: 10.5))
        : Column(children: _assignments.map((raw) {
            final item = raw as Map<String, dynamic>;
            final from = item['fromUs'];
            final to = item['toUs'];
            final fromName = from == null ? 'سیستم' : '${from['firstName']} ${from['lastName']}';
            final toName = to == null ? '—' : '${to['firstName']} ${to['lastName']}';
            return _EventBox(
              title: '$fromName ← $toName',
              time: Fa.dateTime(DateTime.parse(item['createdAt'].toString())),
              body: (item['rejectReason'] ?? '').toString().trim().isNotEmpty ? 'دلیل رد: ${item['rejectReason']}' : (item['note'] ?? '').toString(),
            );
          }).toList()),
  );

  Widget _activitiesPanel() => _Section(
    title: 'خط زمان فعالیت‌ها',
    icon: Icons.timeline_rounded,
    child: _activities.isEmpty
        ? const Text('فعالیتی ثبت نشده است.', style: TextStyle(color: FollowaColors.soft, fontSize: 10.5))
        : Column(children: _activities.reversed.map((raw) {
            final item = raw as Map<String, dynamic>;
            final payload = item['payload'];
            final type = item['type']?.toString() ?? '';
            final details = <String>[];
            if (payload is Map && (payload['result'] ?? '').toString().trim().isNotEmpty) details.add(payload['result'].toString());
            if (payload is Map && payload['effortMinutes'] is num) details.add('زمان صرف‌شده: ${Fa.num((payload['effortMinutes'] as num).toInt())} دقیقه');
            if (payload is Map && payload['remindAt'] != null) details.add('یادآوری: ${Fa.dateTime(DateTime.parse(payload['remindAt'].toString()))}');
            return _EventBox(
              title: activityLabels[type] ?? type,
              time: Fa.dateTime(DateTime.parse(item['createdAt'].toString())),
              body: details.join('\n'),
              result: type == 'RESULT_ADDED',
            );
          }).toList()),
  );

  Future<void> _rejectDialog() async {
    final controller = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: const Text('رد کردن ارجاع'),
      content: TextField(controller: controller, autofocus: true, maxLines: 4, decoration: const InputDecoration(labelText: 'دلیل رد (حداقل ۳ کاراکتر)')),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('انصراف')), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('ثبت رد'))],
    ));
    final reason = controller.text.trim();
    controller.dispose();
    if (ok == true && reason.length >= 3) {
      await _run(() async { await AuthService.instance.post('/cases/${widget.caseId}/reject', {'reason': reason}); }, 'ارجاع رد شد');
    }
  }

  Future<void> _resultDialog() async {
    final result = TextEditingController();
    final effort = TextEditingController();
    final date = TextEditingController(text: JalaliInput.format(DateTime.now().add(const Duration(days: 1))));
    final time = TextEditingController(text: '09:00');
    final note = TextEditingController();
    var complete = false;
    var reminder = false;

    final ok = await showDialog<bool>(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, setD) => AlertDialog(
      title: const Text('ثبت نتیجه پیگیری'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: result, autofocus: true, maxLines: 4, decoration: const InputDecoration(labelText: 'نتیجه پیگیری *')),
        const SizedBox(height: 10),
        TextField(controller: effort, keyboardType: TextInputType.number, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'زمان صرف‌شده (دقیقه) *')),
        CheckboxListTile(contentPadding: EdgeInsets.zero, value: complete, title: const Text('پرونده تکمیل شود', style: TextStyle(fontSize: 12)), onChanged: (v) => setD(() { complete = v ?? false; if (complete) reminder = false; })),
        if (!complete) CheckboxListTile(contentPadding: EdgeInsets.zero, value: reminder, title: const Text('یادآوری بعدی ثبت شود', style: TextStyle(fontSize: 12)), onChanged: (v) => setD(() => reminder = v ?? false)),
        if (!complete && reminder) ...[
          TextField(controller: date, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'تاریخ شمسی', hintText: '۱۴۰۵/۰۶/۰۷')),
          const SizedBox(height: 8),
          TextField(controller: time, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'ساعت', hintText: '09:00')),
          const SizedBox(height: 8),
          TextField(controller: note, maxLines: 2, decoration: const InputDecoration(labelText: 'یادداشت پیگیری')),
        ],
      ])),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('انصراف')), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(complete ? 'ثبت و تکمیل' : 'ثبت نتیجه'))],
    )));

    if (ok == true) {
      final resultText = result.text.trim();
      final effortValue = int.tryParse(JalaliInput.normalizeDigits(effort.text));
      if (resultText.length < 2) {
        _message('نتیجه پیگیری را وارد کنید');
      } else if (effortValue == null || effortValue < 1 || effortValue > 1440) {
        _message('زمان صرف‌شده را بین ۱ تا ۱۴۴۰ دقیقه وارد کنید');
      } else {
        try {
          Map<String, dynamic>? nextReminder;
          if (!complete && reminder) {
            final dt = JalaliInput.parseDateTime(date.text, time.text);
            if (dt.isBefore(DateTime.now().subtract(const Duration(minutes: 1)))) throw const FormatException('زمان یادآوری نمی‌تواند در گذشته باشد');
            nextReminder = {'remindAt': dt.toIso8601String(), if (note.text.trim().isNotEmpty) 'note': note.text.trim()};
          }
          await _run(() async {
            await AuthService.instance.post('/cases/${widget.caseId}/result', {
              'result': resultText,
              'complete': complete,
              'effortMinutes': effortValue,
              if (nextReminder != null) 'nextReminder': nextReminder,
            });
          }, complete ? 'نتیجه ثبت و پرونده تکمیل شد' : nextReminder != null ? 'نتیجه و یادآوری بعدی ثبت شد' : 'نتیجه ثبت شد');
        } on FormatException catch (error) {
          _message(error.message);
        }
      }
    }
    result.dispose(); effort.dispose(); date.dispose(); time.dispose(); note.dispose();
  }

  Future<void> _transferDialog() async {
    List<dynamic> candidates;
    try {
      final response = await AuthService.instance.get('/members/transfer-candidates');
      candidates = response['items'] as List<dynamic>? ?? const [];
    } catch (error) {
      _message(error.toString()); return;
    }
    if (!mounted) return;
    Map<String, dynamic>? selected;
    final note = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, setD) => AlertDialog(
      title: const Text('انتقال پرونده'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        DropdownButtonFormField<Map<String, dynamic>>(
          decoration: const InputDecoration(labelText: 'همکار مقصد'),
          items: candidates.map((raw) { final m = raw as Map<String, dynamic>; return DropdownMenuItem(value: m, child: Text('${m['fullName']}${(m['jobTitle'] ?? '').toString().isEmpty ? '' : ' · ${m['jobTitle']}'}')); }).toList(),
          onChanged: (value) => setD(() => selected = value),
        ),
        const SizedBox(height: 10),
        TextField(controller: note, maxLines: 2, decoration: const InputDecoration(labelText: 'توضیح انتقال (اختیاری)')),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('انصراف')), FilledButton(onPressed: selected == null ? null : () => Navigator.pop(ctx, true), child: const Text('انتقال'))],
    )));
    final noteText = note.text.trim(); note.dispose();
    if (ok == true && selected != null) {
      await _run(() async { await AuthService.instance.post('/cases/${widget.caseId}/transfer', {'toUserId': selected!['userId'], if (noteText.isNotEmpty) 'note': noteText}); }, 'پرونده منتقل شد');
    }
  }

  Future<void> _pickAndUpload() async {
    try {
      final file = await FilePicker.pickFile();
      if (file == null) return;
      final bytes = await file.readAsBytes();
      await _run(() async {
        await AuthService.instance.uploadBytes('/cases/${widget.caseId}/files', fieldName: 'file', filename: file.name, bytes: bytes);
      }, 'فایل پیوست شد');
    } catch (error) {
      _message(error.toString());
    }
  }

  Future<void> _openFile(Map<String, dynamic> file) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final binary = await AuthService.instance.download('/files/${file['id']}/download');
      if (!mounted) return;
      if (binary.contentType.toLowerCase().startsWith('image/')) {
        await showDialog<void>(context: context, builder: (_) => Dialog(child: InteractiveViewer(minScale: .5, maxScale: 4, child: Image.memory(binary.bytes, fit: BoxFit.contain))));
      } else {
        final saved = await FilePicker.saveFile(dialogTitle: 'ذخیره فایل', fileName: binary.filename ?? file['filename']?.toString() ?? 'followa-file', bytes: binary.bytes);
        if (saved != null) _message('فایل ذخیره شد');
      }
    } catch (error) {
      _message(error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _message(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  static Widget _kv(String key, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(width: 90, child: Text(key, style: const TextStyle(color: FollowaColors.soft, fontSize: 10))),
      Expanded(child: Text(value, style: const TextStyle(color: FollowaColors.muted, fontSize: 11, fontWeight: FontWeight.w700))),
    ]),
  );
}

class _Metric extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  const _Metric({required this.label, required this.value, required this.icon});
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(color: FollowaColors.surface, borderRadius: BorderRadius.circular(15), border: Border.all(color: FollowaColors.border)),
    child: Row(children: [Icon(icon, color: FollowaColors.brandSoft, size: 17), const SizedBox(width: 7), Expanded(child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(color: FollowaColors.soft, fontSize: 8.5)), const SizedBox(height: 3), Text(value, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: FollowaColors.muted, fontSize: 9.5, fontWeight: FontWeight.w800))]))]),
  );
}

class _Section extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget child;
  final Color? accent;
  const _Section({required this.title, required this.icon, required this.child, this.accent});
  @override
  Widget build(BuildContext context) => PremiumPanel(
    accent: accent,
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Icon(icon, color: accent ?? FollowaColors.brandSoft, size: 18), const SizedBox(width: 7), Text(title, style: const TextStyle(color: FollowaColors.ink, fontSize: 12, fontWeight: FontWeight.w900))]),
      const SizedBox(height: 10), child,
    ]),
  );
}

class _TextBlock extends StatelessWidget {
  final String label;
  final String text;
  final Color? accent;
  final String? footer;
  const _TextBlock({required this.label, required this.text, this.accent, this.footer});
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(label, style: const TextStyle(color: FollowaColors.soft, fontSize: 9.5)), const SizedBox(height: 5),
    Container(width: double.infinity, padding: const EdgeInsets.all(11), decoration: BoxDecoration(color: accent?.withOpacity(.07) ?? FollowaColors.elevated, borderRadius: BorderRadius.circular(12), border: Border.all(color: accent?.withOpacity(.20) ?? FollowaColors.border)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(text, style: const TextStyle(color: FollowaColors.muted, fontSize: 10.5, height: 1.75)), if (footer != null) ...[const SizedBox(height: 6), Text(footer!, style: const TextStyle(color: FollowaColors.soft, fontSize: 9))]])),
  ]);
}

class _EventBox extends StatelessWidget {
  final String title;
  final String time;
  final String body;
  final bool result;
  const _EventBox({required this.title, required this.time, this.body = '', this.result = false});
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity, margin: const EdgeInsets.only(bottom: 8), padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(color: result ? FollowaColors.emerald.withOpacity(.055) : FollowaColors.elevated, borderRadius: BorderRadius.circular(12), border: Border.all(color: result ? FollowaColors.emerald.withOpacity(.18) : FollowaColors.border)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(children: [Expanded(child: Text(title, style: const TextStyle(color: FollowaColors.muted, fontSize: 10.5, fontWeight: FontWeight.w800))), Text(time, style: const TextStyle(color: FollowaColors.soft, fontSize: 8.5))]), if (body.trim().isNotEmpty) ...[const SizedBox(height: 6), Text(body, style: TextStyle(color: result ? const Color(0xFFBBF7D0) : FollowaColors.soft, fontSize: 9.5, height: 1.65))]]),
  );
}
