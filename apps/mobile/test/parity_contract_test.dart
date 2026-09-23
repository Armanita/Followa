import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

String source(String path) => File(path).readAsStringSync();

void main() {
  group('Web/mobile parity regression guards', () {
    test(
        'case execution uses effort results, safe transfer and no work sessions',
        () {
      final text = source('lib/screens/case_detail_screen.dart');
      expect(text, contains("'effortMinutes'"));
      expect(text, contains("'nextReminder'"));
      expect(text, contains('/members/transfer-candidates'));
      expect(text, contains('/cases/\${widget.caseId}/files'));
      expect(text, isNot(contains('/work-sessions/')));
      expect(text, isNot(contains("AuthService.instance.get('/members')")));
    });

    test('case creation keeps customer context and employee-safe member access',
        () {
      final text = source('lib/screens/new_case_screen.dart');
      expect(text, contains("'customerId'"));
      expect(text, contains('/customers'));
      expect(text, contains("if (_isManager)"));
      expect(text, contains("m['role'] == 'EMPLOYEE'"));
    });

    test('reports do not regress to work-session metrics', () {
      final text = source('lib/screens/reports_tab.dart');
      expect(text, contains('ownedActiveCases'));
      expect(text, contains('pendingAssignments'));
      expect(text, isNot(contains('workSeconds30d')));
      expect(text, isNot(contains('sessions30d')));
    });

    test('profile keeps personnel finalization and authenticated photo flow',
        () {
      final text = source('lib/screens/profile_screen.dart');
      expect(text, contains('/profile/finalize'));
      expect(text, contains('/profile/photo'));
      expect(text, contains('profileFinalizedAt'));
      expect(text, contains('JalaliInput'));
    });

    test('notifications navigate independently from unread state', () {
      final text = source('lib/screens/notifications_screen.dart');
      expect(text, contains("notification['linkType'] == 'CASE'"));
      expect(text, isNot(contains('if (!unread) return')));
    });

    test('manager navigation exposes customer and settings capability', () {
      final shell = source('lib/screens/home_shell.dart');
      final more = source('lib/screens/more_screen.dart');
      expect(shell, contains('CustomersScreen'));
      expect(more, contains('SettingsScreen'));
      expect(more, contains('ReportsTab'));
      expect(more, contains('ProfileScreen'));
      expect(more, contains('CustomerReportScreen'));
    });

    test('case archive tabs and customer report filters stay wired', () {
      final cases = source('lib/screens/cases_screen.dart');
      expect(cases, contains("'archive=\$_archive'"));
      expect(cases, contains('پرونده‌های فعال'));
      expect(cases, contains('پرونده‌های بایگانی شده'));
      expect(cases, contains('_archivedStatuses'));

      final report = source('lib/screens/customer_report_screen.dart');
      expect(report, contains("'customerId=\$_customerId'"));
      expect(report, contains("value: 'active', child: Text('در حال انجام')"));
      expect(report, contains("value: 'archived', child: Text('بایگانی شده')"));
      expect(report, contains('resultAt'));
      expect(report, contains('ownerId'));
      expect(report, contains('caseTypeId'));
      expect(report, contains('from='));
      expect(report, contains('to='));
    });

    test('bodyless JSON requests omit content-type header', () {
      final text = source('lib/services/auth_service.dart');
      expect(text, contains('_headers(json: body != null)'));
    });
  });
}
