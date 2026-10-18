import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/case_repository.dart';
import '../services/case_drafts.dart';
import '../widgets/common.dart';
import '../widgets/case_widgets.dart';
import '../widgets/reject_assignment_sheet.dart';
import 'case_history_screen.dart';
import 'case_documents_screen.dart';
import 'case_transfer_screen.dart';
import 'result_composer_screen.dart';
import 'reminder_detail_screen.dart';
import 'customer_case_history_screen.dart';
import 'home_shell.dart';

class CaseDetailScreen extends StatefulWidget {
  final String caseId;
  final CaseRepository repository;
  const CaseDetailScreen(
      {super.key,
      required this.caseId,
      this.repository = const CaseRepository()});
  @override
  State<CaseDetailScreen> createState() => _CaseDetailScreenState();
}

class _CaseDetailScreenState extends State<CaseDetailScreen> {
  Map<String, dynamic>? _case;
  List<Map<String, dynamic>> _activities = [], _assignments = [];
  String? _error, _historyError, _assignmentError;
  bool _loading = true, _busy = false;
  CaseRepository get _repo => widget.repository;
  @override
  void initState() {
    super.initState();
    _load();
  }

  int _loadGeneration = 0;
  Future<void> _load() async {
    final generation = ++_loadGeneration;
    if (!mounted || generation != _loadGeneration) return;
    setState(() {
      _loading = true;
      _error = null;
      _historyError = null;
      _assignmentError = null;
    });
    await Future.wait([
      (() async {
        try {
          final value = await _repo.get('/cases/${widget.caseId}');
          if (mounted && generation == _loadGeneration) {
            setState(() => _case = Map<String, dynamic>.from(value));
          }
        } catch (e) {
          if (mounted && generation == _loadGeneration) {
            setState(() => _error = userMessage(e));
          }
        }
      })(),
      (() async {
        try {
          final value = await _repo.get('/cases/${widget.caseId}/activities');
          if (mounted && generation == _loadGeneration) {
            setState(() => _activities = caseRows(value));
          }
        } catch (e) {
          if (mounted && generation == _loadGeneration) {
            setState(() => _historyError = userMessage(e));
          }
        }
      })(),
      (() async {
        try {
          final value = await _repo.get('/cases/${widget.caseId}/assignments');
          if (mounted && generation == _loadGeneration) {
            setState(() => _assignments = caseRows(value['items']));
          }
        } catch (e) {
          if (mounted && generation == _loadGeneration) {
            setState(() => _assignmentError = userMessage(e));
          }
        }
      })(),
    ]);
    if (mounted && generation == _loadGeneration) {
      setState(() => _loading = false);
    }
  }

  Future<void> _open(Widget page, {bool result = false}) async {
    final saved = await Navigator.push<bool>(
        context, MaterialPageRoute(builder: (_) => page));
    if (!mounted) return;
    await _load();
    if (saved == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(_error != null
              ? 'ثبت شد؛ به‌روزرسانی نمایش انجام نشد'
              : result
                  ? 'نتیجه ثبت شد'
                  : 'تغییرات ثبت شد')));
    }
  }

  Future<void> _accept() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await _repo.post('/cases/${widget.caseId}/accept');
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('پرونده پذیرفته شد')));
      await _load();
    } catch (e) {
      if (mounted) setState(() => _error = userMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _reject() async {
    if (_busy) return;
    final changed =
        await showRejectAssignment(context, widget.caseId, repository: _repo);
    if (changed == true && mounted) await _load();
  }

  Future<void> _actions(CaseAccess access) async {
    final action = await showModalBottomSheet<String>(
        context: context,
        builder: (ctx) => SafeArea(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
              if (access.transfer)
                ListTile(
                    leading: const Icon(Icons.swap_horiz),
                    title: const Text('انتقال پرونده'),
                    onTap: () => Navigator.pop(ctx, 'transfer')),
              if (access.execute)
                ListTile(
                    leading: const Icon(Icons.attach_file),
                    title: const Text('پیوست فایل'),
                    onTap: () => Navigator.pop(ctx, 'files')),
            ])));
    if (!mounted) return;
    if (action == 'transfer') {
      await _open(CaseTransferScreen(caseData: _case!, repository: _repo));
    }
    if (action == 'files') {
      await _open(
          CaseDocumentsScreen(caseId: widget.caseId, repository: _repo));
    }
  }

  void _back() {
    if (Navigator.of(context).canPop()) {
      Navigator.pop(context);
    } else {
      Navigator.pushReplacement(context,
          MaterialPageRoute(builder: (_) => const HomeShell(initialIndex: 1)));
    }
  }

  void _history(
          {bool responsibility = false,
          String filter = 'all',
          String? eventId}) =>
      _open(CaseHistoryScreen(
          caseId: widget.caseId,
          repository: _repo,
          responsibility: responsibility,
          filter: filter,
          eventId: eventId));

  @override
  Widget build(BuildContext context) {
    if (_case == null) {
      return Scaffold(
          appBar: AppBar(title: const Text('پرونده')),
          body: _loading
              ? const Center(child: CircularProgressIndicator())
              : ErrorState(
                  message: _error ?? 'پرونده در دسترس نیست', onRetry: _load));
    }
    final c = _case!;
    final access = CaseAccess(c, _repo.isManager, _repo.userId);
    final reminders = caseRows(c['reminders'])
        .where((r) => r['status'] == 'ACTIVE')
        .toList()
      ..sort((a, b) => (a['remindAt'] ?? '')
          .toString()
          .compareTo((b['remindAt'] ?? '').toString()));
    final pending = _assignments.reversed
        .where((a) => a['status'] == 'PENDING')
        .firstOrNull;
    final latest = _activities.reversed
        .where((a) =>
            a['payload'] is Map &&
            a['payload']['result'] == c['result'] &&
            a['createdAt'] == c['resultAt'])
        .firstOrNull;
    final customer = c['customer'];
    final result = (c['result'] ?? '').toString();
    final closedEvent = newestCaseEvents(_activities)
        .where((e) =>
            e['type'] == (c['status'] == 'CANCELLED' ? 'CANCEL' : 'COMPLETE'))
        .firstOrNull;
    final effort = _activities.fold<int>(
        0,
        (sum, a) =>
            sum +
            (a['payload'] is Map && a['payload']['effortMinutes'] is num
                ? (a['payload']['effortMinutes'] as num).toInt()
                : 0));
    return PopScope(
        canPop: Navigator.of(context).canPop(),
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) _back();
        },
        child: Scaffold(
          appBar: AppBar(
              leading: BackButton(onPressed: _back),
              title: Text('پرونده #${Fa.num(c['number'] ?? '—')}'),
              actions: [
                if (access.transfer || access.execute)
                  TextButton(
                      onPressed: _busy ? null : () => _actions(access),
                      child: const Text('عملیات')),
              ]),
          body: RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                  key: PageStorageKey('case-${widget.caseId}'),
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                  children: [
                    if (_loading || _busy) const LinearProgressIndicator(),
                    if (_error != null)
                      CaseError('به‌روزرسانی انجام نشد: $_error', retry: _load),
                    Text(c['title']?.toString() ?? 'پرونده',
                        style: const TextStyle(
                            fontSize: 22,
                            height: 1.6,
                            fontWeight: FontWeight.w800)),
                    const SizedBox(height: 12),
                    Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          StatusChip(status: c['status']?.toString() ?? ''),
                          Chip(
                              label: Text(
                                  'اولویت: ${priorityLabels[c['priority']] ?? c['priority'] ?? 'معمولی'}')),
                        ]),
                    const SizedBox(height: 12),
                    Text(
                        c['currentOwner'] != null
                            ? 'مسئول: ${personName(c['currentOwner'])}${access.owner ? ' (شما)' : ''}'
                            : c['status'] == 'WAITING_ACCEPTANCE'
                                ? 'در انتظار پذیرش${pending == null ? '' : ' ${personName(pending['toUs'])}'}'
                                : 'مسئول تعیین نشده',
                        style: const TextStyle(fontSize: 16)),
                    if (access.pending)
                      CaseSection(
                          title: 'این پرونده برای شما ارجاع شده است',
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (pending != null) ...[
                                  Text(
                                      'از: ${personName(pending['fromUs'], fallback: 'سیستم')}'),
                                  Text(caseTime(pending['createdAt'])),
                                  if ((pending['note'] ?? '')
                                      .toString()
                                      .isNotEmpty)
                                    ExpandableCaseText(
                                        pending['note'].toString())
                                ],
                              ]))
                    else if (!access.closed &&
                        !_repo.isManager &&
                        !access.owner)
                      const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Text(
                              'ثبت نتیجه توسط مسئول فعلی پرونده انجام می‌شود. شما به اطلاعات و تاریخچه دسترسی دارید.'))
                    else if (!access.closed &&
                        _repo.isManager &&
                        c['currentOwner'] == null &&
                        c['status'] != 'WAITING_ACCEPTANCE')
                      const Text(
                          'برای شروع پیگیری، پرونده را به یک کارمند ارجاع دهید.'),
                    if (access.closed)
                      Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Text(c['status'] == 'DONE'
                              ? 'این پرونده تکمیل شده است؛ تاریخچه و مستندات در دسترس هستند.'
                              : 'این پرونده لغو شده است؛ تاریخچه و مستندات در دسترس هستند.')),
                    if (access.closed && closedEvent != null)
                      Text(
                          'زمان ثبت وضعیت: ${caseTime(closedEvent['createdAt'])}'),
                    if (c['dueDate'] != null)
                      Text(
                          'سررسید پرونده: ${Fa.date(DateTime.parse(c['dueDate'].toString()))}'),
                    if (customer == null)
                      const Text('پرونده داخلی')
                    else
                      ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(
                              'مشتری: ${customer['name']}${customer['isActive'] == false ? ' · بایگانی' : ''}'),
                          subtitle: customer['type'] == null
                              ? null
                              : Text(customer['type'] == 'LEGAL'
                                  ? 'شخص حقوقی'
                                  : 'شخص حقیقی'),
                          trailing: _repo.isManager
                              ? const Icon(Icons.chevron_left)
                              : null,
                          onTap: !_repo.isManager
                              ? null
                              : () => _open(CustomerCaseHistoryScreen(
                                  customerId: customer['id'].toString(),
                                  name: customer['name'].toString(),
                                  repository: _repo))),
                    const Divider(),
                    CaseSection(
                        title: 'آخرین نتیجه',
                        child: result.trim().isEmpty
                            ? const Text('هنوز نتیجه‌ای ثبت نشده است.')
                            : Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                    ExpandableCaseText(result, lines: 6),
                                    if (c['resultAt'] != null)
                                      Text(
                                          '${latest == null ? '' : '${personName(latest['actor'])} · '}${caseTime(c['resultAt'])}',
                                          style: const TextStyle(fontSize: 12)),
                                    Align(
                                        alignment:
                                            AlignmentDirectional.centerStart,
                                        child: TextButton(
                                            onPressed: () =>
                                                _history(filter: 'results'),
                                            child: const Text('همه نتایج'))),
                                  ])),
                    if (reminders.isNotEmpty)
                      CaseSection(
                          title: 'یادآوری بعدی',
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Text(caseTime(reminders.first['remindAt']),
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700)),
                                Text(reminders.first['assigneeId'] ==
                                        _repo.userId
                                    ? 'برای شما'
                                    : 'برای ${personName(reminders.first['assignee'])}'),
                                if (DateTime.tryParse(reminders
                                                .first['remindAt']
                                                ?.toString() ??
                                            '')
                                        ?.isBefore(DateTime.now()) ??
                                    false)
                                  const Text('سررسید گذشته'),
                                if ((reminders.first['note'] ?? '')
                                    .toString()
                                    .isNotEmpty)
                                  ExpandableCaseText(
                                      reminders.first['note'].toString(),
                                      lines: 3),
                                TextButton(
                                    onPressed: () => _open(ReminderDetailScreen(
                                        caseId: widget.caseId,
                                        reminderId:
                                            reminders.first['id'].toString(),
                                        repository: _repo)),
                                    child: const Text('مشاهده یادآوری')),
                                if (reminders.length > 1)
                                  TextButton(
                                      onPressed: () => _open(
                                          ReminderDetailScreen(
                                              caseId: widget.caseId,
                                              repository: _repo)),
                                      child: Text(
                                          'همه یادآوری‌های فعال (${Fa.num(reminders.length)})')),
                              ]))
                    else if (access.execute)
                      const Text('یادآوری فعالی ثبت نشده است.'),
                    CaseSection(
                        title: 'شرح اولیه',
                        child: ExpandableCaseText(
                            (c['description'] ?? '').toString().trim().isEmpty
                                ? 'شرح اولیه ثبت نشده است.'
                                : c['description'].toString())),
                    CaseSection(
                        title: 'فعالیت‌های اخیر',
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              if (_historyError != null)
                                CaseError(_historyError!, retry: _load),
                              for (final event
                                  in newestCaseEvents(_activities).take(3))
                                ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    title: Text(eventLabel(event)),
                                    subtitle: Text(
                                        '${personName(event['actor'])} · ${caseTime(event['createdAt'])}'),
                                    onTap: () => _history(
                                        eventId: event['id']?.toString())),
                              TextButton(
                                  onPressed: () => _history(),
                                  child: const Text('مشاهده تاریخچه کامل')),
                            ])),
                    ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.attach_file),
                        title: Text(
                            'فایل‌ها و مستندات (${Fa.num(caseRows(c['files']).length)})'),
                        trailing: const Icon(Icons.chevron_left),
                        onTap: () => _open(CaseDocumentsScreen(
                            caseId: widget.caseId, repository: _repo))),
                    if (_assignmentError != null)
                      CaseError(_assignmentError!, retry: _load),
                    ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.swap_horiz),
                        title: Text(
                            'گردش مسئولیت (${Fa.num(_assignments.length)})'),
                        trailing: const Icon(Icons.chevron_left),
                        onTap: () => _history(responsibility: true)),
                    ExpansionTile(
                        key: PageStorageKey('meta-${widget.caseId}'),
                        tilePadding: EdgeInsets.zero,
                        title: const Text('اطلاعات بیشتر'),
                        children: [
                          _metadata('ایجادکننده', personName(c['createdBy'])),
                          _metadata('زمان ایجاد', caseTime(c['createdAt'])),
                          _metadata('نوع پرونده',
                              c['caseType']?['name']?.toString() ?? 'بدون نوع'),
                          _metadata(
                              'زمان خوداظهاری‌شده', '${Fa.num(effort)} دقیقه'),
                          if (c['totalWorkSeconds'] is num &&
                              c['totalWorkSeconds'] > 0)
                            _metadata(
                                'زمان نشست‌های کاری قدیمی',
                                Fa.duration(
                                    (c['totalWorkSeconds'] as num).toInt())),
                        ]),
                  ])),
          bottomNavigationBar: access.pending
              ? CaseActionBar(
                  child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                      FilledButton(
                          onPressed: _busy ? null : _accept,
                          child: const Text('پذیرش ارجاع')),
                      TextButton(
                          onPressed: _busy ? null : _reject,
                          child: const Text('رد ارجاع')),
                    ]))
              : access.execute
                  ? CaseActionBar(
                      child: FilledButton(
                          onPressed: _busy
                              ? null
                              : () => _open(
                                  ResultComposerScreen(
                                      caseData: c, repository: _repo),
                                  result: true),
                          child: Text(
                              CaseDrafts.has(_repo.userId, widget.caseId)
                                  ? 'ادامه پیش‌نویس'
                                  : 'ثبت نتیجه')))
                  : _repo.isManager && access.transfer
                      ? CaseActionBar(
                          child: FilledButton(
                              onPressed: _busy
                                  ? null
                                  : () => _open(CaseTransferScreen(
                                      caseData: c, repository: _repo)),
                              child: Text(c['status'] == 'WAITING_ACCEPTANCE'
                                  ? 'ارجاع مجدد'
                                  : c['currentOwner'] == null
                                      ? 'ارجاع پرونده'
                                      : 'انتقال پرونده')))
                      : null,
        ));
  }

  Widget _metadata(String label, String value) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Align(
          alignment: AlignmentDirectional.centerStart,
          child: Text('$label: $value')));
}
