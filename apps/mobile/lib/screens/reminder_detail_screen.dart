import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/case_repository.dart';
import '../widgets/case_widgets.dart';
import 'case_detail_screen.dart';
import 'result_composer_screen.dart';

class ReminderDetailScreen extends StatefulWidget {
  final String caseId;
  final String? reminderId;
  final CaseRepository repository;
  const ReminderDetailScreen(
      {super.key,
      required this.caseId,
      this.reminderId,
      this.repository = const CaseRepository()});
  @override
  State<ReminderDetailScreen> createState() => _ReminderDetailScreenState();
}

class _ReminderDetailScreenState extends State<ReminderDetailScreen> {
  Map<String, dynamic>? _case;
  String? _error;
  bool _loading = true;
  int _loadGeneration = 0;
  Future<void> _load() async {
    final generation = ++_loadGeneration;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await widget.repository.get('/cases/${widget.caseId}');
      if (mounted && generation == _loadGeneration) {
        setState(() => _case = Map<String, dynamic>.from(r));
      }
    } catch (e) {
      if (mounted && generation == _loadGeneration) {
        setState(() => _error = userMessage(e));
      }
    } finally {
      if (mounted && generation == _loadGeneration) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _open(Widget page) async {
    final saved = await Navigator.push<bool>(
        context, MaterialPageRoute(builder: (_) => page));
    if (!mounted) return;
    await _load();
    if (saved == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(_error == null
              ? 'ثبت شد'
              : 'ثبت شد؛ به‌روزرسانی نمایش انجام نشد')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = caseRows(_case?['reminders'])
        .where((r) => widget.reminderId != null
            ? r['id'] == widget.reminderId
            : r['status'] == 'ACTIVE')
        .toList();
    final access = _case == null
        ? null
        : CaseAccess(
            _case!, widget.repository.isManager, widget.repository.userId);
    return Scaffold(
        appBar: AppBar(title: const Text('یادآوری پرونده')),
        body: RefreshIndicator(
            onRefresh: _load,
            child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                children: [
                  if (_loading) const LinearProgressIndicator(),
                  if (_error != null) CaseError(_error!, retry: _load),
                  if (_case != null)
                    ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(
                            'پرونده #${_case!['number']} · ${_case!['title']}'),
                        trailing: const Icon(Icons.chevron_left),
                        onTap: () => _open(CaseDetailScreen(
                            caseId: widget.caseId,
                            repository: widget.repository))),
                  if (!_loading && _error == null && rows.isEmpty)
                    const Text(
                        'یادآوری موردنظر در دسترس نیست یا یادآوری فعالی وجود ندارد.'),
                  for (final reminder in rows)
                    CaseSection(
                        title: caseTime(reminder['remindAt']),
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text('وضعیت: ${const {
                                    'ACTIVE': 'فعال',
                                    'DONE': 'انجام‌شده',
                                    'EXPIRED': 'منقضی‌شده'
                                  }[reminder['status']] ?? reminder['status']}'),
                              Text(
                                  'برای: ${reminder['assigneeId'] == widget.repository.userId ? 'شما' : personName(reminder['assignee'])}'),
                              if (reminder['status'] == 'ACTIVE' &&
                                  (DateTime.tryParse(reminder['remindAt']
                                                  ?.toString() ??
                                              '')
                                          ?.isBefore(DateTime.now()) ??
                                      false))
                                const Text('سررسید گذشته'),
                              const SizedBox(height: 12),
                              ExpandableCaseText(
                                  (reminder['note'] ?? '')
                                          .toString()
                                          .trim()
                                          .isEmpty
                                      ? 'بدون یادداشت'
                                      : reminder['note'].toString(),
                                  lines: 8),
                              if (reminder['status'] == 'ACTIVE' &&
                                  reminder['assigneeId'] ==
                                      widget.repository.userId) ...[
                                const SizedBox(height: 16),
                                if (access?.execute == true)
                                  FilledButton(
                                      onPressed: () => _open(
                                          ResultComposerScreen(
                                              caseData: _case!,
                                              reminder: reminder,
                                              repository: widget.repository)),
                                      child: const Text('ثبت نتیجه پیگیری')),
                                OutlinedButton(
                                    onPressed: () => _open(
                                        ReminderCompleteScreen(
                                            caseData: _case!,
                                            reminder: reminder,
                                            repository: widget.repository)),
                                    child: const Text('فقط انجام‌شدن یادآوری')),
                              ],
                            ])),
                ])));
  }
}

class ReminderCompleteScreen extends StatefulWidget {
  final Map<String, dynamic> caseData, reminder;
  final CaseRepository repository;
  const ReminderCompleteScreen(
      {super.key,
      required this.caseData,
      required this.reminder,
      this.repository = const CaseRepository()});
  @override
  State<ReminderCompleteScreen> createState() => _ReminderCompleteScreenState();
}

class _ReminderCompleteScreenState extends State<ReminderCompleteScreen> {
  final _result = TextEditingController();
  bool _busy = false, _exit = false, _uncertain = false;
  String? _error;
  @override
  void dispose() {
    _result.dispose();
    super.dispose();
  }

  Future<void> _leave() async {
    if (_busy) return;
    if (_result.text.isNotEmpty && !await confirmDiscard(context)) return;
    if (!mounted) return;
    setState(() => _exit = true);
    await WidgetsBinding.instance.endOfFrame;
    if (mounted) Navigator.pop(context);
  }

  Future<void> _save() async {
    if (_busy || _uncertain) return;
    if (_result.text.trim().length > 5000) {
      setState(() => _error = 'حداکثر ۵۰۰۰ کاراکتر');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.repository.post(
          '/reminders/${widget.reminder['id']}/complete',
          {if (_result.text.trim().isNotEmpty) 'result': _result.text.trim()});
      if (!mounted) return;
      setState(() => _exit = true);
      await WidgetsBinding.instance.endOfFrame;
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _uncertain = e is! ApiException || e.statusCode! >= 500;
          _error = _uncertain
              ? 'وضعیت ثبت مشخص نیست. پیش از تلاش دوباره وضعیت یادآوری را بررسی کنید.'
              : userMessage(e);
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _check() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final c = await widget.repository.get('/cases/${widget.caseData['id']}');
      final r = caseRows(c['reminders'])
          .where((e) => e['id'] == widget.reminder['id'])
          .firstOrNull;
      if (!mounted) return;
      if (r != null && r['status'] != 'ACTIVE') {
        setState(() => _exit = true);
        await WidgetsBinding.instance.endOfFrame;
        if (mounted) Navigator.pop(context, true);
      } else if (r != null) {
        setState(() {
          _uncertain = false;
          _error = 'یادآوری هنوز فعال است. در صورت نیاز دوباره ثبت کنید.';
        });
      } else {
        setState(() =>
            _error = 'وضعیت یادآوری قابل تأیید نیست؛ نوشته شما محفوظ است.');
      }
    } catch (e) {
      if (mounted) setState(() => _error = userMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final closed = CaseAccess(widget.caseData, widget.repository.isManager,
            widget.repository.userId)
        .closed;
    final allowed = widget.reminder['status'] == 'ACTIVE' &&
        widget.reminder['assigneeId'] == widget.repository.userId;
    return PopScope(
        canPop: _exit,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) _leave();
        },
        child: Scaffold(
            appBar: AppBar(
                title: const Text('انجام یادآوری'),
                leading: BackButton(onPressed: _leave)),
            body: ListView(padding: const EdgeInsets.all(16), children: [
              Text(
                  'پرونده #${widget.caseData['number']} · ${widget.caseData['title']}'),
              CaseSection(
                  title: 'دستور یادآوری',
                  child: Text(
                      widget.reminder['note']?.toString() ?? 'بدون یادداشت')),
              const Text(
                  'این اقدام فقط یادآوری را انجام‌شده می‌کند؛ پرونده تکمیل نمی‌شود.'),
              Text(closed
                  ? 'متن نتیجه در تاریخچه ثبت می‌شود؛ پرونده باز نمی‌شود و آخرین نتیجه آن تغییر نمی‌کند.'
                  : 'اگر نتیجه بنویسید، آخرین نتیجه پرونده نیز به‌روزرسانی می‌شود.'),
              const SizedBox(height: 16),
              TextField(
                  controller: _result,
                  enabled: !_busy && allowed,
                  minLines: 6,
                  maxLines: null,
                  maxLength: 5000,
                  decoration: const InputDecoration(
                      labelText: 'نتیجه پیگیری (اختیاری)')),
              if (_error != null) CaseError(_error!),
              if (_uncertain)
                TextButton(
                    onPressed: _busy ? null : _check,
                    child: const Text('بررسی وضعیت یادآوری')),
            ]),
            bottomNavigationBar: CaseActionBar(
                child: FilledButton(
                    onPressed: _busy || _uncertain || !allowed ? null : _save,
                    child:
                        Text(_busy ? 'در حال ثبت…' : 'ثبت انجام یادآوری')))));
  }
}
