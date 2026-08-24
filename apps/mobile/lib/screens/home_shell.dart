import 'package:flutter/material.dart';
import '../services/auth_service.dart';
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
    final tabs = <(String, IconData, Widget)>[
      if (isManager) ...[
        ('داشبورد', Icons.dashboard_outlined, const DashboardScreen()),
        ('پرونده‌ها', Icons.folder_outlined, const CasesScreen()),
        ('کارکنان', Icons.people_outline, const EmployeesTab()),
        ('گزارش‌ها', Icons.bar_chart_outlined, const ReportsTab()),
        ('پروفایل', Icons.person_outline, const ProfileScreen()),
      ] else ...[
        ('داشبورد', Icons.dashboard_outlined, const DashboardScreen()),
        ('کارهای من', Icons.folder_outlined, const CasesScreen(mineOnly: true)),
        ('ارجاع‌ها', Icons.move_to_inbox_outlined, const AssignmentsScreen()),
        ('یادآوری', Icons.alarm_outlined, const RemindersScreen()),
        ('اعلان‌ها', Icons.notifications_outlined, const NotificationsScreen()),
      ],
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: [for (final t in tabs) t.$3]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          for (final t in tabs) NavigationDestination(icon: Icon(t.$2), label: t.$1),
        ],
      ),
    );
  }
}
