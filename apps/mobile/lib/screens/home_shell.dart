import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
import 'dashboard_screen.dart';
import 'cases_screen.dart';
import 'assignments_screen.dart';
import 'reminders_screen.dart';
import 'notifications_screen.dart';
import 'profile_screen.dart';
import 'employees_tab.dart';
import 'reports_tab.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final isManager = AuthService.instance.isManager;
    final tabs = <(String, IconData, IconData, Widget)>[
      if (isManager) ...[
        (
          'داشبورد',
          Icons.grid_view_outlined,
          Icons.grid_view_rounded,
          const DashboardScreen(),
        ),
        (
          'پرونده‌ها',
          Icons.folder_outlined,
          Icons.folder_rounded,
          const CasesScreen(),
        ),
        (
          'کارکنان',
          Icons.people_outline_rounded,
          Icons.people_rounded,
          const EmployeesTab(),
        ),
        (
          'گزارش‌ها',
          Icons.bar_chart_outlined,
          Icons.bar_chart_rounded,
          const ReportsTab(),
        ),
        (
          'پروفایل',
          Icons.person_outline_rounded,
          Icons.person_rounded,
          const ProfileScreen(),
        ),
      ] else ...[
        (
          'امروز',
          Icons.grid_view_outlined,
          Icons.grid_view_rounded,
          const DashboardScreen(),
        ),
        (
          'پرونده‌ها',
          Icons.folder_outlined,
          Icons.folder_rounded,
          const CasesScreen(mineOnly: true),
        ),
        (
          'ارجاع‌ها',
          Icons.move_to_inbox_outlined,
          Icons.move_to_inbox_rounded,
          const AssignmentsScreen(),
        ),
        (
          'یادآوری',
          Icons.alarm_outlined,
          Icons.alarm_rounded,
          const RemindersScreen(),
        ),
        (
          'اعلان‌ها',
          Icons.notifications_outlined,
          Icons.notifications_rounded,
          const NotificationsScreen(),
        ),
      ],
    ];

    if (_index >= tabs.length) _index = 0;

    return Scaffold(
      extendBody: true,
      body: IndexedStack(
        index: _index,
        children: [for (final tab in tabs) tab.$4],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(10, 0, 10, 8),
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFF0A111D),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: FollowaColors.border),
            boxShadow: const [
              BoxShadow(
                color: Color(0x66000000),
                blurRadius: 30,
                offset: Offset(0, 14),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: NavigationBar(
            selectedIndex: _index,
            onDestinationSelected: (index) => setState(() => _index = index),
            destinations: [
              for (var index = 0; index < tabs.length; index++)
                NavigationDestination(
                  icon: Icon(tabs[index].$2),
                  selectedIcon: Icon(tabs[index].$3),
                  label: tabs[index].$1,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
