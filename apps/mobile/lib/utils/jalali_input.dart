import 'package:shamsi_date/shamsi_date.dart';

class JalaliInput {
  static const _faDigits = '۰۱۲۳۴۵۶۷۸۹';
  static const _arDigits = '٠١٢٣٤٥٦٧٨٩';

  static String normalizeDigits(String input) {
    var value = input.trim();
    for (var i = 0; i < 10; i++) {
      value = value.replaceAll(_faDigits[i], '$i');
      value = value.replaceAll(_arDigits[i], '$i');
    }
    return value;
  }

  static String format(DateTime dateTime) {
    final j = dateTime.toJalali();
    return '${j.year.toString().padLeft(4, '0')}/'
        '${j.month.toString().padLeft(2, '0')}/'
        '${j.day.toString().padLeft(2, '0')}';
  }

  static DateTime parseDateTime(String date, String time) {
    final normalizedDate = normalizeDigits(date);
    final normalizedTime = normalizeDigits(time);
    final parts = normalizedDate.split(RegExp(r'[/\-.]'));
    if (parts.length != 3) {
      throw const FormatException('تاریخ شمسی را به شکل ۱۴۰۵/۰۶/۰۷ وارد کنید');
    }
    final year = int.tryParse(parts[0]);
    final month = int.tryParse(parts[1]);
    final day = int.tryParse(parts[2]);
    if (year == null || month == null || day == null) {
      throw const FormatException('تاریخ شمسی معتبر نیست');
    }

    final timeParts = normalizedTime.split(':');
    if (timeParts.length != 2) {
      throw const FormatException('ساعت معتبر نیست');
    }
    final hour = int.tryParse(timeParts[0]);
    final minute = int.tryParse(timeParts[1]);
    if (hour == null || minute == null || hour > 23 || minute > 59) {
      throw const FormatException('ساعت معتبر نیست');
    }

    final gregorian = Jalali(year, month, day).toDateTime();
    return DateTime(
      gregorian.year,
      gregorian.month,
      gregorian.day,
      hour,
      minute,
    );
  }
}
