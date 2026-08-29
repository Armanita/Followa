import 'package:flutter_test/flutter_test.dart';
import 'package:followa_mobile/utils/jalali_input.dart';

void main() {
  group('JalaliInput', () {
    test('normalizes Persian and Arabic digits', () {
      expect(JalaliInput.normalizeDigits('۱۴۰۵/٠٦/۰۷'), '1405/06/07');
    });

    test('parses a Jalali date and time into the expected local instant', () {
      final value = JalaliInput.parseDateTime('۱۴۰۵/۰۶/۰۷', '09:30');
      expect(JalaliInput.format(value), '1405/06/07');
      expect(value.hour, 9);
      expect(value.minute, 30);
    });

    test('rejects malformed date and time values', () {
      expect(
        () => JalaliInput.parseDateTime('۱۴۰۵/۰۶', '09:30'),
        throwsA(isA<FormatException>()),
      );
      expect(
        () => JalaliInput.parseDateTime('۱۴۰۵/۰۶/۰۷', '99:30'),
        throwsA(isA<FormatException>()),
      );
    });
  });
}
