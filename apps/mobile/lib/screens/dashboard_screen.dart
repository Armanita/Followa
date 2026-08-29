import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
import '../widgets/common.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _data;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final path = AuthService.instance.isManager
          ? '/dashboard/manager'
          : '/dashboard/employee';
      final response = await AuthService.instance.get(path);
      if (!mounted) return;
      setState(() => _data = response as Map<String, dynamic>);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: _load,
          child: _error != null
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
    final isManager = AuthService.instance.isManager;
    final cards = (_data!['cards'] as Map?)?.cast<String, dynamic>() ?? {};

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 108),
      children: [
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
          _UrgentCasesPanel(items: (_data!['urgentCases'] as List?) ?? const []),
          const SizedBox(height: 14),
        ] else ...[
          _TodayReminders(items: (_data!['remindersToday'] as List?) ?? const []),
          const SizedBox(height: 14),
        ],
        _RecentActivity(items: (_data!['recentActivities'] as List?) ?? const []),
      ],
    );
  }
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
                  fontSize: 10,
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
                  fontSize: 11,
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
            color: FollowaColors.brand.withOpacity(.12),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: FollowaColors.brandSoft.withOpacity(.25)),
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
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1.25,
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
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
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1.25,
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
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
                          color: color,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: color.withOpacity(.35),
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
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Text(
                        Fa.num(count),
                        style: const TextStyle(
                          color: FollowaColors.ink,
                          fontSize: 11,
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
                      color: color,
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

class _UrgentCasesPanel extends StatelessWidget {
  final List items;
  const _UrgentCasesPanel({required this.items});

  @override
  Widget build(BuildContext context) {
    return PremiumPanel(
      accent: items.isEmpty ? null : FollowaColors.red,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _PanelTitle(
            title: 'پرونده‌های نیازمند توجه',
            subtitle: items.isEmpty
                ? 'در حال حاضر مورد فوری فعالی وجود ندارد.'
                : '${Fa.num(items.length)} پرونده با اولویت بالا یا فوری',
            icon: Icons.crisis_alert_rounded,
            color: items.isEmpty ? FollowaColors.soft : FollowaColors.red,
          ),
          if (items.isNotEmpty) ...[
            const SizedBox(height: 10),
            ...items.take(5).map((item) {
              final row = item as Map<String, dynamic>;
              final owner = row['currentOwner'] as Map?;
              final ownerName = owner == null
                  ? 'بدون مسئول'
                  : '${owner['firstName'] ?? ''} ${owner['lastName'] ?? ''}'.trim();
              return Container(
                margin: const EdgeInsets.only(top: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: FollowaColors.elevated.withOpacity(.72),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: FollowaColors.border),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 34,
                      height: 34,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: FollowaColors.red.withOpacity(.09),
                        borderRadius: BorderRadius.circular(11),
                      ),
                      child: const Icon(
                        Icons.priority_high_rounded,
                        size: 17,
                        color: FollowaColors.red,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            row['title']?.toString() ?? 'پرونده',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: FollowaColors.ink,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'مسئول: $ownerName',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: FollowaColors.soft,
                              fontSize: 9.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(
                      Icons.chevron_left_rounded,
                      color: FollowaColors.soft,
                      size: 20,
                    ),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}

class _TodayReminders extends StatelessWidget {
  final List items;
  const _TodayReminders({required this.items});

  @override
  Widget build(BuildContext context) {
    return PremiumPanel(
      accent: items.isEmpty ? null : FollowaColors.amber,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _PanelTitle(
            title: 'پیگیری‌های امروز',
            subtitle: items.isEmpty
                ? 'برای امروز یادآوری فعالی ندارید.'
                : '${Fa.num(items.length)} یادآوری برای امروز',
            icon: Icons.alarm_on_rounded,
            color: items.isEmpty ? FollowaColors.soft : FollowaColors.amber,
          ),
          if (items.isNotEmpty) ...[
            const SizedBox(height: 10),
            ...items.take(5).map((item) {
              final row = item as Map<String, dynamic>;
              final caseData = (row['case'] as Map?)?.cast<String, dynamic>();
              final remindAt = DateTime.tryParse(row['remindAt']?.toString() ?? '');
              return Container(
                margin: const EdgeInsets.only(top: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: FollowaColors.elevated.withOpacity(.72),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: FollowaColors.border),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.notifications_active_outlined,
                      color: FollowaColors.amber,
                      size: 19,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            row['note']?.toString().trim().isNotEmpty == true
                                ? row['note'].toString()
                                : caseData?['title']?.toString() ?? 'یادآوری پرونده',
                            style: const TextStyle(
                              color: FollowaColors.ink,
                              fontSize: 11.5,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          if (remindAt != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              Fa.dateTime(remindAt),
                              style: const TextStyle(
                                color: FollowaColors.soft,
                                fontSize: 9.5,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}

class _RecentActivity extends StatelessWidget {
  final List items;
  const _RecentActivity({required this.items});

  @override
  Widget build(BuildContext context) {
    return PremiumPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _PanelTitle(
            title: 'جریان فعالیت اخیر',
            subtitle: 'آخرین تغییرات قابل مشاهده در پرونده‌ها',
            icon: Icons.timeline_rounded,
          ),
          if (items.isEmpty)
            const Padding(
              padding: EdgeInsets.only(top: 18),
              child: Text(
                'هنوز فعالیتی برای نمایش وجود ندارد.',
                style: TextStyle(color: FollowaColors.soft, fontSize: 11),
              ),
            )
          else ...[
            const SizedBox(height: 10),
            ...items.take(6).map((item) {
              final row = item as Map<String, dynamic>;
              final caseData = (row['case'] as Map?)?.cast<String, dynamic>();
              final actor = (row['actor'] as Map?)?.cast<String, dynamic>();
              final createdAt = DateTime.tryParse(row['createdAt']?.toString() ?? '');
              final actorName = actor == null
                  ? 'سیستم'
                  : '${actor['firstName'] ?? ''} ${actor['lastName'] ?? ''}'.trim();
              final type = row['type']?.toString() ?? '';
              return Container(
                padding: const EdgeInsets.symmetric(vertical: 11),
                decoration: const BoxDecoration(
                  border: Border(bottom: BorderSide(color: FollowaColors.border)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: FollowaColors.brand.withOpacity(.09),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.bolt_rounded,
                        color: FollowaColors.brandSoft,
                        size: 16,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            activityLabels[type] ?? type,
                            style: const TextStyle(
                              color: FollowaColors.ink,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${caseData?['title'] ?? 'پرونده'} · $actorName',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: FollowaColors.soft,
                              fontSize: 9.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (createdAt != null)
                      Text(
                        Fa.date(createdAt),
                        style: const TextStyle(
                          color: FollowaColors.soft,
                          fontSize: 8.5,
                        ),
                      ),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}

class _PanelTitle extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;

  const _PanelTitle({
    required this.title,
    required this.subtitle,
    required this.icon,
    this.color = FollowaColors.brandSoft,
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
            color: color.withOpacity(.10),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withOpacity(.18)),
          ),
          child: Icon(icon, size: 18, color: color),
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
                  fontSize: 9.5,
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
