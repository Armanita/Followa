import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:followa_mobile/services/auth_service.dart';
import 'package:followa_mobile/services/case_repository.dart';
import 'package:followa_mobile/services/case_drafts.dart';
import 'package:followa_mobile/screens/case_detail_screen.dart';
import 'package:followa_mobile/screens/case_history_screen.dart';
import 'package:followa_mobile/screens/case_transfer_screen.dart';
import 'package:followa_mobile/screens/result_composer_screen.dart';
import 'package:followa_mobile/screens/reminder_detail_screen.dart';
import 'package:followa_mobile/screens/cases_screen.dart';
import 'package:followa_mobile/screens/dashboard_screen.dart';
import 'package:followa_mobile/screens/new_case_screen.dart';
import 'package:followa_mobile/widgets/reject_assignment_sheet.dart';
import 'package:followa_mobile/theme/premium_theme.dart';

Map<String, dynamic> fixture(
        {String status = 'IN_PROGRESS',
        bool owner = true,
        bool pending = false}) =>
    {
      'id': 'case-1',
      'number': 12,
      'title': 'پیگیری مشتری نمونه',
      'status': status,
      'priority': 'HIGH',
      'currentOwnerId': owner ? 'user-1' : 'user-2',
      'currentOwner': {
        'id': owner ? 'user-1' : 'user-2',
        'firstName': 'کارمند',
        'lastName': 'نمونه'
      },
      'isCurrentOwner': owner,
      'canEdit': owner,
      'canTransfer': true,
      'hasPendingAcceptanceForMe': pending,
      'description': 'شرح پرونده',
      'createdAt': '2026-09-01T10:00:00Z',
      'files': [],
      'reminders': [],
    };

class FakeCases extends CaseRepository {
  bool manager = false;
  Map<String, dynamic> data = fixture();
  List<Map<String, dynamic>> activities = [];
  final reads = <String>[];
  final writes = <(String, Object?)>[];
  Object? failure;
  Completer<void>? pendingPost;
  bool failCaseAfterPost = false;
  @override
  bool get isManager => manager;
  @override
  String get userId => 'user-1';
  @override
  Future<dynamic> get(String path) async {
    reads.add(path);
    if (failCaseAfterPost && writes.isNotEmpty && path == '/cases/case-1') {
      throw const ApiException(
          statusCode: 500, code: 'FAILED', message: 'به‌روزرسانی ناموفق');
    }
    if (path.endsWith('/activities')) return activities;
    if (path.endsWith('/assignments')) return {'items': []};
    if (path.startsWith('/cases?')) {
      return {
        'items': [data],
        'total': 1
      };
    }
    if (path.startsWith('/dashboard/')) {
      return {
        'cards': {},
        'urgentCases': [data],
        'remindersToday': [],
        'recentActivities': [
          {
            'caseId': 'case-1',
            'case': data,
            'type': 'CREATE',
            'createdAt': '2026-09-01T10:00:00Z'
          }
        ]
      };
    }
    if (path == '/members/transfer-candidates') {
      return {
        'items': [
          {'userId': 'user-2', 'fullName': 'همکار مقصد'}
        ]
      };
    }
    if (path == '/companies/current') return {'caseTypes': []};
    if (path.startsWith('/customers')) return {'items': []};
    return data;
  }

  @override
  Future<dynamic> post(String path, [Object? body]) async {
    writes.add((path, body));
    if (pendingPost != null) await pendingPost!.future;
    if (failure != null) throw failure!;
    if (path == '/cases') return {'case': data};
    if (path.endsWith('/result')) {
      final value = body as Map;
      data = {
        ...data,
        'result': value['result'],
        if (value['complete'] == true) 'status': 'DONE'
      };
    }
    return {'case': data, 'message': 'ثبت شد'};
  }
}

Widget app(Widget child) => MaterialApp(
      theme: buildFollowaPremiumTheme(),
      locale: const Locale('fa'),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate
      ],
      supportedLocales: const [Locale('fa')],
      home: Directionality(textDirection: TextDirection.rtl, child: child),
    );
Future<void> mount(WidgetTester tester, Widget child,
    {Size size = const Size(600, 1600)}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(app(child));
  await tester.pumpAndSettle();
}

Future<void> tapText(WidgetTester tester, String text) async {
  await tester.pump();
  final target = find.text(text).last;
  await tester.ensureVisible(target);
  await tester.tap(target);
  await tester.pumpAndSettle();
}

Future<void> enterResult(WidgetTester tester) async {
  await tester.enterText(
      find.byType(TextFormField).at(0), 'تماس انجام شد؛ منتظر پاسخ هستیم');
  await tester.enterText(find.byType(TextFormField).at(1), '۱۵');
}

void main() {
  setUp(CaseDrafts.clear);
  testWidgets(
      'successful POST followed by failed refresh does not reopen the composer',
      (tester) async {
    final repo = FakeCases()..failCaseAfterPost = true;
    await mount(tester, CaseDetailScreen(caseId: 'case-1', repository: repo));
    await tapText(tester, 'ثبت نتیجه');
    await enterResult(tester);
    await tapText(tester, 'ثبت نتیجه');
    expect(find.byType(ResultComposerScreen), findsNothing);
    expect(repo.writes.length, 1);
    expect(CaseDrafts.has('user-1', 'case-1'), false);
    expect(find.text('ثبت شد؛ به‌روزرسانی نمایش انجام نشد'), findsOneWidget);
  });
  testWidgets(
      'ownership changed while composing preserves writing and prevents POST',
      (tester) async {
    final initial = fixture();
    final repo = FakeCases()..data = fixture(owner: false);
    await mount(
        tester, ResultComposerScreen(caseData: initial, repository: repo));
    await enterResult(tester);
    await tapText(tester, 'ثبت نتیجه');
    expect(repo.writes, isEmpty);
    expect(find.text('تماس انجام شد؛ منتظر پاسخ هستیم'), findsOneWidget);
    expect(find.textContaining('وضعیت یا مسئول پرونده تغییر کرده'),
        findsOneWidget);
  });
  testWidgets(
      'composer toggles preserve scheduling values and completion omits reminder',
      (tester) async {
    final repo = FakeCases();
    await mount(
        tester, ResultComposerScreen(caseData: repo.data, repository: repo),
        size: const Size(600, 2200));
    await enterResult(tester);
    await tapText(tester, 'افزودن یادآوری بعدی');
    await tester.enterText(find.byType(TextFormField).at(2), '۱۴۱۰/۰۱/۰۱');
    await tester.enterText(find.byType(TextFormField).at(4), 'تماس بعدی');
    await tapText(tester, 'افزودن یادآوری بعدی');
    await tapText(tester, 'افزودن یادآوری بعدی');
    expect(find.text('تماس بعدی'), findsOneWidget);
    await tapText(tester, 'پرونده تکمیل شود');
    expect(find.text('تماس بعدی'), findsNothing);
    await tapText(tester, 'پیگیری ادامه دارد');
    expect(find.text('تماس بعدی'), findsOneWidget);
    await tapText(tester, 'پرونده تکمیل شود');
    await tapText(tester, 'ثبت نتیجه و تکمیل پرونده');
    expect(find.text('پرونده تکمیل شود؟'), findsOneWidget);
    await tapText(tester, 'ثبت نتیجه و تکمیل پرونده');
    final body = repo.writes.single.$2 as Map;
    expect(body['complete'], true);
    expect(body.containsKey('nextReminder'), false);
  });
  testWidgets(
      'small composer with keyboard has reachable submit and no overflow',
      (tester) async {
    final repo = FakeCases();
    await mount(
        tester, ResultComposerScreen(caseData: repo.data, repository: repo),
        size: const Size(320, 640));
    tester.view.viewInsets = const FakeViewPadding(bottom: 240);
    addTearDown(tester.view.resetViewInsets);
    await tester.pumpAndSettle();
    expect(find.widgetWithText(FilledButton, 'ثبت نتیجه'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  test(
      'result payload preserves next reminder values but omits them on completion',
      () {
    final draft = ResultDraft()
      ..result = 'نتیجه معتبر'
      ..effort = '١٥'
      ..reminder = true
      ..date = '۱۴۱۰/۰۱/۰۱'
      ..time = '09:00'
      ..note = 'تماس دوباره';
    final original = draft.payload()['nextReminder'];
    draft.reminder = false;
    expect(draft.payload().containsKey('nextReminder'), false);
    draft.reminder = true;
    expect(draft.payload()['nextReminder'], original);
    draft.complete = true;
    expect(draft.payload(),
        {'result': 'نتیجه معتبر', 'effortMinutes': 15, 'complete': true});
    expect(draft.note, 'تماس دوباره');
  });
  test('history filters retain the underlying immutable record', () {
    final records = [
      {
        'type': 'RESULT_ADDED',
        'payload': {'result': 'اول'}
      },
      {
        'type': 'REMINDER_DONE',
        'payload': {'result': 'دوم'}
      },
      {'type': 'ASSIGN'},
      {'type': 'LEGACY_UNKNOWN'},
    ];
    expect(records.where((e) => matchesHistoryFilter(e, 'results')).length, 2);
    expect(
        records.where((e) => matchesHistoryFilter(e, 'assignments')).length, 1);
    expect(
        records.where((e) => matchesHistoryFilter(e, 'other')).single['type'],
        'LEGACY_UNKNOWN');
    expect(records.where((e) => matchesHistoryFilter(e, 'all')).length, 4);
    expect(records.length, 4);
  });
  test(
      'history ordering is stable for simultaneous records and leaves source intact',
      () {
    final records = <Map<String, dynamic>>[
      {'id': 'a', 'createdAt': '2026-09-01T10:00:00Z'},
      {'id': 'b', 'createdAt': '2026-09-01T10:00:00Z'},
      {'id': 'c', 'createdAt': '2026-09-02T10:00:00Z'},
    ];
    expect(newestCaseEvents(records).map((e) => e['id']), ['c', 'a', 'b']);
    expect(records.map((e) => e['id']), ['a', 'b', 'c']);
  });
  test('drafts are user-scoped and explicitly clearable', () {
    CaseDrafts.obtain('a', 'c').result = 'متن';
    expect(CaseDrafts.has('a', 'c'), true);
    expect(CaseDrafts.has('b', 'c'), false);
    CaseDrafts.clear();
    expect(CaseDrafts.has('a', 'c'), false);
  });
  for (final status in ['DONE', 'CANCELLED']) {
    testWidgets('$status has no execution CTA', (tester) async {
      final repo = FakeCases()..data = fixture(status: status);
      await mount(tester, CaseDetailScreen(caseId: 'case-1', repository: repo));
      expect(find.text('ثبت نتیجه'), findsNothing);
      expect(find.text('عملیات'), findsNothing);
      expect(find.textContaining('فایل‌ها و مستندات'), findsOneWidget);
    });
  }
  testWidgets(
      'owned employee sees persistent result action and refreshes after success',
      (tester) async {
    final repo = FakeCases();
    await mount(tester, CaseDetailScreen(caseId: 'case-1', repository: repo));
    expect(find.text('ثبت نتیجه'), findsOneWidget);
    await tapText(tester, 'ثبت نتیجه');
    await enterResult(tester);
    await tapText(tester, 'ثبت نتیجه');
    expect(find.byType(ResultComposerScreen), findsNothing);
    expect(find.text('تماس انجام شد؛ منتظر پاسخ هستیم'), findsOneWidget);
    expect(repo.reads.where((p) => p == '/cases/case-1').length,
        greaterThanOrEqualTo(3));
    expect(repo.writes.single.$1, '/cases/case-1/result');
  });
  testWidgets('pending assignment has Accept/Reject, no execution',
      (tester) async {
    final repo = FakeCases()
      ..data =
          fixture(status: 'WAITING_ACCEPTANCE', owner: false, pending: true);
    await mount(tester, CaseDetailScreen(caseId: 'case-1', repository: repo));
    expect(find.text('پذیرش ارجاع'), findsOneWidget);
    expect(find.text('رد ارجاع'), findsOneWidget);
    expect(find.text('ثبت نتیجه'), findsNothing);
    expect(find.text('عملیات'), findsNothing);
  });
  testWidgets(
      'manager sees transfer but cannot open employee composer directly',
      (tester) async {
    final repo = FakeCases()..manager = true;
    await mount(tester, CaseDetailScreen(caseId: 'case-1', repository: repo));
    expect(find.text('ثبت نتیجه'), findsNothing);
    expect(find.text('انتقال پرونده'), findsOneWidget);
    await tester.pumpWidget(
        app(ResultComposerScreen(caseData: repo.data, repository: repo)));
    await tester.pumpAndSettle();
    expect(find.byType(TextFormField), findsNothing);
    expect(repo.writes, isEmpty);
  });
  testWidgets('view-only employee cannot transfer despite broad API flag',
      (tester) async {
    final repo = FakeCases()..data = fixture(owner: false);
    await mount(tester, CaseDetailScreen(caseId: 'case-1', repository: repo));
    expect(find.text('ثبت نتیجه'), findsNothing);
    expect(find.text('عملیات'), findsNothing);
  });
  testWidgets('validation and definite API failure preserve result and effort',
      (tester) async {
    final repo = FakeCases()
      ..failure = const ApiException(
          statusCode: 400, code: 'BAD', message: 'خطای آزمایشی');
    await mount(
        tester, ResultComposerScreen(caseData: repo.data, repository: repo));
    await tester.enterText(find.byType(TextFormField).at(0), 'متن نوشته‌شده');
    await tapText(tester, 'ثبت نتیجه');
    expect(find.text('متن نوشته‌شده'), findsOneWidget);
    expect(repo.writes, isEmpty);
    await tester.enterText(find.byType(TextFormField).at(1), '۲۰');
    await tapText(tester, 'ثبت نتیجه');
    expect(find.text('خطای آزمایشی'), findsOneWidget);
    expect(find.text('متن نوشته‌شده'), findsOneWidget);
    expect(find.text('۲۰'), findsOneWidget);
  });
  testWidgets(
      'dirty Back preserves an in-session draft and changes primary CTA',
      (tester) async {
    final repo = FakeCases();
    await mount(tester, CaseDetailScreen(caseId: 'case-1', repository: repo));
    await tapText(tester, 'ثبت نتیجه');
    await tester.enterText(find.byType(TextFormField).first, 'پیش‌نویس من');
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('ادامه ویرایش'), findsOneWidget);
    await tapText(tester, 'نگه‌داشتن پیش‌نویس');
    expect(find.text('ادامه پیش‌نویس'), findsOneWidget);
    await tapText(tester, 'ادامه پیش‌نویس');
    expect(find.text('پیش‌نویس من'), findsOneWidget);
  });
  testWidgets('in-flight submit cannot be duplicated', (tester) async {
    final repo = FakeCases()..pendingPost = Completer<void>();
    await mount(
        tester, ResultComposerScreen(caseData: repo.data, repository: repo));
    await enterResult(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'ثبت نتیجه'));
    await tester.pump();
    await tester.pump();
    expect(repo.writes.length, 1);
    final button = tester
        .widget<FilledButton>(find.widgetWithText(FilledButton, 'در حال ثبت…'));
    expect(button.onPressed, isNull);
    repo.pendingPost!.complete();
    await tester.pumpAndSettle();
  });
  testWidgets('uncertain POST never retries automatically', (tester) async {
    final repo = FakeCases()..failure = TimeoutException('timeout');
    await mount(
        tester, ResultComposerScreen(caseData: repo.data, repository: repo));
    await enterResult(tester);
    await tapText(tester, 'ثبت نتیجه');
    expect(repo.writes.length, 1);
    expect(find.text('بررسی وضعیت پرونده'), findsOneWidget);
    expect(
        tester
            .widget<FilledButton>(
                find.widgetWithText(FilledButton, 'ثبت نتیجه'))
            .onPressed,
        isNull);
    expect(find.text('تماس انجام شد؛ منتظر پاسخ هستیم'), findsOneWidget);
  });
  testWidgets('reminder-only completion sends no case completion or effort',
      (tester) async {
    final repo = FakeCases()..data = fixture(owner: false);
    await mount(
        tester,
        ReminderCompleteScreen(
            caseData: repo.data,
            reminder: {
              'id': 'r1',
              'status': 'ACTIVE',
              'assigneeId': 'user-1',
              'note': 'دستور اصلی'
            },
            repository: repo));
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text,
        isEmpty);
    await tapText(tester, 'ثبت انجام یادآوری');
    expect(repo.writes.single.$1, '/reminders/r1/complete');
    expect(repo.writes.single.$2, isEmpty);
  });
  testWidgets('transfer and rejection preserve fields on API failure',
      (tester) async {
    final repo = FakeCases()
      ..failure = const ApiException(
          statusCode: 409, code: 'CONFLICT', message: 'تلاش ناموفق');
    await mount(
        tester, CaseTransferScreen(caseData: repo.data, repository: repo));
    await tapText(tester, 'همکار مقصد');
    await tester.enterText(find.byType(TextField).last, 'توضیح انتقال');
    await tapText(tester, 'ارجاع به همکار مقصد');
    expect(find.text('توضیح انتقال'), findsOneWidget);
    expect(find.text('تلاش ناموفق'), findsOneWidget);
    await tester.pumpWidget(app(Scaffold(
        body: Builder(
            builder: (context) => TextButton(
                onPressed: () =>
                    showRejectAssignment(context, 'case-1', repository: repo),
                child: const Text('open'))))));
    await tapText(tester, 'open');
    await tester.enterText(find.byType(TextFormField), 'دلیل معتبر رد');
    await tapText(tester, 'ثبت رد ارجاع');
    expect(find.text('دلیل معتبر رد'), findsOneWidget);
    expect(find.text('تلاش ناموفق'), findsOneWidget);
  });
  testWidgets('related scope omits mine without changing archive semantics',
      (tester) async {
    final repo = FakeCases();
    await mount(tester, CasesScreen(mineOnly: true, repository: repo));
    expect(repo.reads.last, contains('mine=true'));
    await tapText(tester, 'پرونده‌های مرتبط با من');
    expect(repo.reads.last, isNot(contains('mine=')));
    expect(repo.reads.last, contains('archive=active'));
  });
  testWidgets('dashboard activity opens case', (tester) async {
    final repo = FakeCases();
    await mount(tester, DashboardScreen(repository: repo));
    await tapText(tester, 'پرونده ایجاد شد');
    expect(find.byType(CaseDetailScreen), findsOneWidget);
  });
  testWidgets('new case opens the created case', (tester) async {
    final repo = FakeCases();
    await mount(tester, NewCaseScreen(repository: repo));
    await tester.enterText(find.byType(TextField).first, 'پرونده تازه');
    await tapText(tester, 'ایجاد پرونده');
    expect(repo.writes.single.$1, '/cases');
    expect(find.byType(CaseDetailScreen), findsOneWidget);
  });
  testWidgets('long RTL case content fits a small screen with enlarged text',
      (tester) async {
    final repo = FakeCases()
      ..data = {
        ...fixture(),
        'title': List.filled(12, 'عنوان طولانی پرونده').join(' '),
        'description': List.filled(50, 'توضیحات فارسی').join(' '),
        'result': List.filled(50, 'نتیجه فارسی').join(' ')
      };
    await mount(
        tester,
        MediaQuery(
            data: const MediaQueryData(
                size: Size(320, 640), textScaler: TextScaler.linear(1.5)),
            child: CaseDetailScreen(caseId: 'case-1', repository: repo)),
        size: const Size(320, 640));
    expect(find.text('ثبت نتیجه'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
