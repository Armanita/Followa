import 'package:flutter_test/flutter_test.dart';
import 'package:followa_mobile/main.dart';

void main() {
  testWidgets('app builds login gate', (WidgetTester tester) async {
    await tester.pumpWidget(const FollowaApp());
    await tester.pumpAndSettle(const Duration(seconds: 2));
    expect(find.text('فالوآ'), findsWidgets);
  });
}
