import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

String source(String path) => File(path).readAsStringSync();

void main() {
  group('Web/mobile parity regression guards', () {
    test('case execution uses effort results, safe transfer and no work sessions', () {
      final text = source('lib/screens/case_detail_screen.dart');
      expect(text, contains("'effortMinutes'"));
      expect(text, contains("'nextReminder'"));
      expect(text, contains('/members/transfer-candidates'));
      expect(text, contains('/cases/\${widget.caseId}/files'));
      expect(text, isNot(contains('/work-sessions/')));
      expect(text, isNot(contains("AuthService.instance.get('/members')")));
    });

    test('case creation keeps customer context and employee-safe member access', () {
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

    test('profile keeps personnel finalization and authenticated photo flow', () {
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
    });
  });
}
