import 'package:flutter_test/flutter_test.dart';
import 'package:followa_mobile/main.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('app builds login gate', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    FlutterSecureStorage.setMockInitialValues(<String, String>{});
    await tester.pumpWidget(const FollowaApp());
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.text('فالوآ'), findsWidgets);
  });
}
