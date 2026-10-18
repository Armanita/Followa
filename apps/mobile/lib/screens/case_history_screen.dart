import 'dart:convert';
import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/case_repository.dart';
import '../widgets/case_widgets.dart';
import '../widgets/common.dart';

const assignmentEvents = {'ASSIGN', 'ACCEPT', 'REJECT'};
const reminderEvents = {'REMINDER_CREATED', 'REMINDER_DONE'};
bool matchesHistoryFilter(Map<String, dynamic> item, String filter) {
  final type = item['type'];
  final payload = item['payload'];
  final result = type == 'RESULT_ADDED' ||
      (type == 'REMINDER_DONE' &&
          payload is Map &&
          (payload['result'] ?? '').toString().isNotEmpty);
  return switch (filter) {
    'results' => result,
    'assignments' => assignmentEvents.contains(type),
    'reminders' => reminderEvents.contains(type),
    'other' => !result &&
        !assignmentEvents.contains(type) &&
        !reminderEvents.contains(type),
    _ => true,
  };
}

String eventLabel(Map<String, dynamic> item) =>
    item['type'] == 'REMINDER_DONE' &&
            (item['payload'] is Map && item['payload']['result'] != null)
        ? 'نتیجه انجام یادآوری'
        : activityLabels[item['type']] ?? 'رویداد ${item['type'] ?? 'نامشخص'}';

class CaseHistoryScreen extends StatefulWidget {
  final String caseId;
  final bool responsibility;
  final String filter;
  final String? eventId;
  final CaseRepository repository;
  const CaseHistoryScreen(
      {super.key,
      required this.caseId,
      this.responsibility = false,
      this.filter = 'all',
      this.eventId,
      this.repository = const CaseRepository()});
  @override
  State<CaseHistoryScreen> createState() => _CaseHistoryScreenState();
}

class _CaseHistoryScreenState extends State<CaseHistoryScreen> {
  List<Map<String, dynamic>> _activities = [], _assignments = [];
  String? _activityError, _assignmentError;
  bool _loading = true;
  late String _filter = widget.filter;
  int _loadGeneration = 0;
  Future<void> _load() async {
    final generation = ++_loadGeneration;
    setState(() {
      _loading = true;
      _activityError = null;
      _assignmentError = null;
    });
    await Future.wait([
      (() async {
        try {
          final v =
              await widget.repository.get('/cases/${widget.caseId}/activities');
          if (mounted && generation == _loadGeneration) {
            setState(() => _activities = caseRows(v));
          }
        } catch (e) {
          if (mounted && generation == _loadGeneration) {
            setState(() => _activityError = userMessage(e));
          }
        }
      })(),
      (() async {
        try {
          final v = await widget.repository
              .get('/cases/${widget.caseId}/assignments');
          if (mounted && generation == _loadGeneration) {
            setState(() => _assignments = caseRows(v['items']));
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

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) => DefaultTabController(
      length: 2,
      initialIndex: widget.responsibility ? 1 : 0,
      child: Scaffold(
          appBar: AppBar(
              title: const Text('تاریخچه پرونده'),
              bottom: const TabBar(
                  isScrollable: true,
                  tabs: [Tab(text: 'فعالیت‌ها'), Tab(text: 'گردش مسئولیت')])),
          body: Column(children: [
            if (_loading) const LinearProgressIndicator(),
            Expanded(
                child:
                    TabBarView(children: [_activityList(), _assignmentList()]))
          ])));

  Widget _activityList() {
    final items = newestCaseEvents(_activities)
        .where((e) => matchesHistoryFilter(e, _filter))
        .toList();
    final selected = widget.eventId == null
        ? null
        : _activities.where((e) => e['id'] == widget.eventId).firstOrNull;
    return RefreshIndicator(
        onRefresh: _load,
        child: ListView.builder(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            itemCount: items.length + 1,
            itemBuilder: (context, index) {
              if (index == 0) {
                return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (_activityError != null)
                        CaseError(
                            'به‌روزرسانی فعالیت‌ها انجام نشد: $_activityError',
                            retry: _load),
                      Wrap(spacing: 8, children: [
                        for (final entry in const {
                          'all': 'همه',
                          'results': 'نتایج',
                          'assignments': 'ارجاع‌ها',
                          'reminders': 'یادآوری‌ها',
                          'other': 'سایر فعالیت‌ها'
                        }.entries)
                          ChoiceChip(
                              label: Text(entry.value),
                              selected: _filter == entry.key,
                              onSelected: (_) =>
                                  setState(() => _filter = entry.key))
                      ]),
                      if (selected != null)
                        CaseSection(
                            title: 'رویداد انتخاب‌شده',
                            child: ActivityEntry(
                                item: selected, assignments: _assignments)),
                      if (items.isEmpty && !_loading && _activityError == null)
                        const EmptyState(title: 'رویدادی در این بخش نیست'),
                    ]);
              }
              final item = items[index - 1];
              final date =
                  DateTime.tryParse(item['createdAt']?.toString() ?? '');
              final day = date == null ? 'زمان نامشخص' : Fa.date(date);
              final previousDate = index > 1
                  ? DateTime.tryParse(
                      items[index - 2]['createdAt']?.toString() ?? '')
                  : null;
              final previousDay =
                  previousDate == null ? 'زمان نامشخص' : Fa.date(previousDate);
              return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (index == 1 || day != previousDay)
                      Padding(
                          padding: const EdgeInsets.only(top: 16),
                          child: Text(day,
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold))),
                    ActivityEntry(item: item, assignments: _assignments),
                  ]);
            }));
  }

  Widget _assignmentList() => RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          itemCount: _assignments.length + 1,
          itemBuilder: (context, index) {
            if (index == 0) {
              return Column(children: [
                if (_assignmentError != null)
                  CaseError(_assignmentError!, retry: _load),
                if (_assignments.isEmpty &&
                    !_loading &&
                    _assignmentError == null)
                  const EmptyState(title: 'ارجاعی ثبت نشده است')
              ]);
            }
            final item = newestCaseEvents(_assignments)[index - 1];
            const reasons = {
              'INITIAL_ASSIGNMENT': 'ارجاع اولیه',
              'TRANSFER': 'انتقال',
              'RETURN_AFTER_REJECT': 'بازگشت پس از رد'
            };
            const states = {
              'PENDING': 'در انتظار پاسخ',
              'ACCEPTED': 'پذیرفته‌شده',
              'REJECTED': 'ردشده'
            };
            return CaseSection(
                title: reasons[item['reason']] ??
                    item['reason']?.toString() ??
                    'ارجاع',
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                          'از: ${personName(item['fromUs'], fallback: 'سیستم')}'),
                      Text('به: ${personName(item['toUs'])}'),
                      Text(
                          'وضعیت: ${states[item['status']] ?? item['status'] ?? 'نامشخص'}'),
                      Text('زمان ارجاع: ${caseTime(item['createdAt'])}'),
                      if (item['respondedAt'] != null)
                        Text('زمان پاسخ: ${caseTime(item['respondedAt'])}'),
                      if ((item['note'] ?? '').toString().isNotEmpty)
                        ExpandableCaseText('توضیح: ${item['note']}'),
                      if ((item['rejectReason'] ?? '').toString().isNotEmpty)
                        ExpandableCaseText('دلیل رد: ${item['rejectReason']}'),
                      const Divider(),
                    ]));
          }));
}

class ActivityEntry extends StatelessWidget {
  final Map<String, dynamic> item;
  final List<Map<String, dynamic>> assignments;
  const ActivityEntry(
      {super.key, required this.item, this.assignments = const []});
  @override
  Widget build(BuildContext context) {
    final payload = item['payload'] is Map
        ? Map<String, dynamic>.from(item['payload'])
        : <String, dynamic>{};
    final assignment = assignments
        .where((e) => e['id'] == payload['assignmentId'])
        .firstOrNull;
    return Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(eventLabel(item),
              style:
                  const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          Text(
              '${personName(item['actor'], fallback: 'سیستم / ثبت‌کننده نامشخص')} · ${caseTime(item['createdAt'])}',
              style: const TextStyle(fontSize: 12)),
          if (payload['result'] != null)
            ExpandableCaseText(payload['result'].toString(), lines: 6),
          if (payload['effortMinutes'] != null)
            Text('زمان صرف‌شده: ${Fa.num(payload['effortMinutes'])} دقیقه'),
          if (payload['remindAt'] != null)
            Text('یادآوری: ${caseTime(payload['remindAt'])}'),
          if (payload['note'] != null)
            ExpandableCaseText('یادداشت: ${payload['note']}'),
          if (payload['rejectReason'] != null)
            ExpandableCaseText('دلیل رد: ${payload['rejectReason']}'),
          if (assignment != null)
            Text(
                'از: ${personName(assignment['fromUs'], fallback: 'سیستم')}\nبه: ${personName(assignment['toUs'])}'),
          if (payload.isNotEmpty)
            ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: const Text('جزئیات کامل رویداد'),
                children: [
                  // Known fields have readable labels; unfamiliar values remain accessible.
                  for (final entry in payload.entries)
                    Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                  const {
                                        'result': 'نتیجه',
                                        'effortMinutes': 'زمان صرف‌شده (دقیقه)',
                                        'note': 'یادداشت',
                                        'rejectReason': 'دلیل رد',
                                        'remindAt': 'زمان یادآوری',
                                        'filename': 'نام فایل',
                                        'durationSeconds': 'زمان نشست (ثانیه)',
                                        'assignmentId': 'شناسه ارجاع',
                                        'reminderId': 'شناسه یادآوری',
                                        'toUserId': 'شناسه گیرنده',
                                        'returnedTo':
                                            'شناسه دریافت‌کننده بازگشت'
                                      }[entry.key] ??
                                      entry.key,
                                  style: const TextStyle(fontSize: 12)),
                              SelectableText(
                                  entry.value is Map || entry.value is List
                                      ? const JsonEncoder.withIndent('  ')
                                          .convert(entry.value)
                                      : entry.value?.toString() ?? '—',
                                  style: const TextStyle(fontSize: 14)),
                            ])),
                ]),
          const Divider(),
        ]));
  }
}
