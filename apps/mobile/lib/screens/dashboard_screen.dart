import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
import '../widgets/common.dart';
import '../widgets/workspace_visibility.dart';
import '../widgets/case_widgets.dart';
import '../services/case_repository.dart';
import 'case_detail_screen.dart';
import 'reminder_detail_screen.dart';

class DashboardScreen extends StatefulWidget {
  final CaseRepository repository;
  const DashboardScreen({super.key, this.repository = const CaseRepository()});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _data;
  String? _error;

  bool? _wasVisible;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final visible = WorkspaceVisibility.of(context);
    if (_wasVisible == false && visible) {
      _load();
    }
    _wasVisible = visible;
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  int _loadGeneration = 0;
  Future<void> _load() async {
    final generation = ++_loadGeneration;
    setState(() => _error = null);
    try {
      final path = widget.repository.isManager
          ? '/dashboard/manager'
          : '/dashboard/employee';
      final response = await widget.repository.get(path);
      if (!mounted || generation != _loadGeneration) return;
      setState(() => _data = response as Map<String, dynamic>);
    } catch (error) {
      if (mounted && generation == _loadGeneration) {
        setState(() => _error = userMessage(error));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: _load,
          child: _error != null && _data == null
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    const SizedBox(height: 120),
                    ErrorState(message: _error!, onRetry: _load),
                  ],
                )
              : _data == null
                  ? const Center(child: CircularProgressIndicator())
                  : _buildBody(),
        ),
      ),
    );
  }

  Widget _buildBody() {
    final isManager = widget.repository.isManager;
    final cards = (_data!['cards'] as Map?)?.cast<String, dynamic>() ?? {};

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 108),
      children: [
        if (_error != null)
          CaseError('به‌روزرسانی انجام نشد: $_error', retry: _load),
        _WorkspaceHeader(isManager: isManager),
        const SizedBox(height: 18),
        if (isManager)
          _ManagerMetrics(cards: cards)
        else
          _EmployeeMetrics(cards: cards),
        const SizedBox(height: 18),
        if (isManager) ...[
          _StatusPanel(data: _data!),
          const SizedBox(height: 14),
          _workPanel('پرونده‌های نیازمند توجه',
              (_data!['urgentCases'] as List?) ?? const [], 'case'),
          const SizedBox(height: 14),
        ] else ...[
          _workPanel('پیگیری‌های امروز',
              (_data!['remindersToday'] as List?) ?? const [], 'reminder'),
          const SizedBox(height: 14),
        ],
        _workPanel('فعالیت‌های اخیر',
            (_data!['recentActivities'] as List?) ?? const [], 'activity'),
      ],
    );
  }

  Widget _workPanel(String title, List items, String kind) => CaseSection(
      title: title,
      child: Column(children: [
        if (items.isEmpty) const Text('موردی برای نمایش وجود ندارد.'),
        for (final raw in items.take(kind == 'activity' ? 6 : 5))
          Builder(builder: (context) {
            final row = Map<String, dynamic>.from(raw as Map);
            final caseId = (kind == 'case'
                    ? row['id']
                    : row['caseId'] ?? row['case']?['id'])
                ?.toString();
            return ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(kind == 'case'
                    ? (row['title']?.toString() ?? 'پرونده')
                    : kind == 'reminder'
                        ? ((row['note'] ?? row['case']?['title'])?.toString() ??
                            'یادآوری')
                        : (activityLabels[row['type']] ??
                            row['type']?.toString() ??
                            'فعالیت')),
                subtitle: Text(kind == 'case'
                    ? 'مسئول: ${personName(row['currentOwner'], fallback: 'تعیین نشده')}'
                    : kind == 'reminder'
                        ? caseTime(row['remindAt'])
                        : '${row['case']?['title'] ?? ''} · ${personName(row['actor'])} · ${caseTime(row['createdAt'])}'),
                trailing:
                    caseId == null ? null : const Icon(Icons.chevron_left),
                onTap: caseId == null
                    ? null
                    : () async {
                        await Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) =>
                                    kind == 'reminder' && row['id'] != null
                                        ? ReminderDetailScreen(
                                            caseId: caseId,
                                            reminderId: row['id'].toString(),
                                            repository: widget.repository)
                                        : CaseDetailScreen(
                                            caseId: caseId,
                                            repository: widget.repository)));
                        if (mounted) await _load();
                      });
          }),
      ]));
}

class _WorkspaceHeader extends StatelessWidget {
  final bool isManager;
  const _WorkspaceHeader({required this.isManager});

  @override
  Widget build(BuildContext context) {
    final name = AuthService.instance.fullName;
    final initial = name.isEmpty ? 'ف' : name.characters.first;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'فضای کاری',
                style: TextStyle(
                  color: FollowaColors.soft,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                isManager ? 'سلام، $name' : 'امروزت را مدیریت کن، $name',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: FollowaColors.ink,
                  fontSize: 21,
                  height: 1.35,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                isManager
                    ? 'نمای زنده از جریان پرونده‌ها و وضعیت تیم'
                    : 'پرونده‌ها، ارجاع‌ها و پیگیری‌های مهم در یک نگاه',
                style: const TextStyle(
                  color: FollowaColors.muted,
                  fontSize: 12,
                  height: 1.6,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Container(
          width: 48,
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: FollowaColors.brand.withValues(alpha: .12),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
                color: FollowaColors.brandSoft.withValues(alpha: .25)),
          ),
          child: Text(
            initial,
            style: const TextStyle(
              color: FollowaColors.brandSoft,
              fontSize: 17,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
      ],
    );
  }
}

class _ManagerMetrics extends StatelessWidget {
  final Map<String, dynamic> cards;
  const _ManagerMetrics({required this.cards});

  @override
  Widget build(BuildContext context) {
    return _MetricWrap(
      children: [
        MetricTile(
          label: 'کل پرونده‌ها',
          value: cards['totalCases'] ?? 0,
          icon: Icons.folder_copy_outlined,
          color: FollowaColors.brandSoft,
          hint: 'تمام پرونده‌های شرکت',
        ),
        MetricTile(
          label: 'در حال انجام',
          value: cards['inProgress'] ?? 0,
          icon: Icons.monitor_heart_outlined,
          color: FollowaColors.blue,
          hint: 'دارای مسئول فعال',
        ),
        MetricTile(
          label: 'انتظار پذیرش',
          value: cards['waitingAcceptance'] ?? 0,
          icon: Icons.schedule_rounded,
          color: FollowaColors.amber,
          hint: 'نیازمند واکنش کارمند',
        ),
        MetricTile(
          label: 'عقب‌افتاده',
          value: cards['lateCases'] ?? 0,
          icon: Icons.warning_amber_rounded,
          color: FollowaColors.red,
          hint: 'عبور از سررسید',
        ),
        MetricTile(
          label: 'باز',
          value: cards['openCases'] ?? 0,
          icon: Icons.inbox_outlined,
          color: FollowaColors.cyan,
          hint: 'پرونده‌های باز',
        ),
        MetricTile(
          label: 'کارکنان فعال',
          value: cards['activeEmployees'] ?? 0,
          icon: Icons.groups_2_outlined,
          color: FollowaColors.emerald,
          hint: 'عضویت فعال شرکت',
        ),
      ],
    );
  }
}

class _EmployeeMetrics extends StatelessWidget {
  final Map<String, dynamic> cards;
  const _EmployeeMetrics({required this.cards});

  @override
  Widget build(BuildContext context) {
    return _MetricWrap(
      children: [
        MetricTile(
          label: 'پرونده‌های من',
          value: cards['myCases'] ?? 0,
          icon: Icons.folder_shared_outlined,
          color: FollowaColors.brandSoft,
          hint: 'کارهای در جریان',
        ),
        MetricTile(
          label: 'ارجاع جدید',
          value: cards['newAssignments'] ?? 0,
          icon: Icons.move_to_inbox_outlined,
          color: FollowaColors.red,
          hint: 'منتظر پذیرش یا رد',
        ),
        MetricTile(
          label: 'یادآوری امروز',
          value: cards['todayReminders'] ?? 0,
          icon: Icons.alarm_outlined,
          color: FollowaColors.amber,
          hint: 'پیگیری‌های امروز',
        ),
        MetricTile(
          label: 'تکمیل‌شده',
          value: cards['completedCases'] ?? 0,
          icon: Icons.task_alt_rounded,
          color: FollowaColors.emerald,
          hint: 'پرونده‌های خاتمه‌یافته',
        ),
      ],
    );
  }
}

class _StatusPanel extends StatelessWidget {
  final Map<String, dynamic> data;
  const _StatusPanel({required this.data});

  @override
  Widget build(BuildContext context) {
    final rows = (data['statusChart'] as List?) ?? const [];
    final total = rows.fold<int>(0, (sum, item) {
      final row = item as Map<String, dynamic>;
      return sum + ((row['count'] as num?)?.toInt() ?? 0);
    });

    return PremiumPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _PanelTitle(
            title: 'سلامت جریان پرونده‌ها',
            subtitle: 'توزیع وضعیت بر اساس داده جاری شرکت',
            icon: Icons.pie_chart_outline_rounded,
          ),
          const SizedBox(height: 16),
          ...rows.map((item) {
            final row = item as Map<String, dynamic>;
            final status = row['status']?.toString() ?? '';
            final count = (row['count'] as num?)?.toInt() ?? 0;
            final fraction = total == 0 ? 0.0 : count / total;
            final color = statusColors[status] ?? FollowaColors.soft;
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: FollowaColors.brandSoft,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: color.withValues(alpha: .35),
                              blurRadius: 8,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          statusLabels[status] ?? status,
                          style: const TextStyle(
                            color: FollowaColors.muted,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Text(
                        Fa.num(count),
                        style: const TextStyle(
                          color: FollowaColors.ink,
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 7),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: LinearProgressIndicator(
                      value: fraction,
                      minHeight: 6,
                      color: FollowaColors.brandSoft,
                      backgroundColor: FollowaColors.elevated,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

class _PanelTitle extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;

  const _PanelTitle({
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 38,
          height: 38,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: FollowaColors.brandSoft.withValues(alpha: .10),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
                color: FollowaColors.brandSoft.withValues(alpha: .18)),
          ),
          child: Icon(icon, size: 18, color: FollowaColors.brandSoft),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: FollowaColors.ink,
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                subtitle,
                style: const TextStyle(
                  color: FollowaColors.soft,
                  fontSize: 12,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MetricWrap extends StatelessWidget {
  final List<Widget> children;
  const _MetricWrap({required this.children});
  @override
  Widget build(BuildContext context) =>
      LayoutBuilder(builder: (context, constraints) {
        final single = constraints.maxWidth < 330 ||
            MediaQuery.textScalerOf(context).scale(14) > 20;
        return Wrap(spacing: 10, runSpacing: 10, children: [
          for (final child in children)
            SizedBox(
                width: single
                    ? constraints.maxWidth
                    : (constraints.maxWidth - 10) / 2,
                child: child)
        ]);
      });
}
