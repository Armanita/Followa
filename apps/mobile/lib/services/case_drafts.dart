import '../utils/jalali_input.dart';

class ResultDraft {
  String result = '';
  String effort = '';
  String date = JalaliInput.format(DateTime.now().add(const Duration(days: 1)));
  String time = '09:00';
  String note = '';
  bool complete = false;
  bool reminder = false;
  bool uncertain = false;
  bool touched = false;
  bool get dirty =>
      touched ||
      result.isNotEmpty ||
      effort.isNotEmpty ||
      note.isNotEmpty ||
      complete ||
      reminder;

  Map<String, dynamic> payload() {
    final minutes = int.tryParse(JalaliInput.normalizeDigits(effort));
    if (result.trim().length < 2 || result.trim().length > 5000) {
      throw const FormatException('نتیجه باید بین ۲ تا ۵۰۰۰ کاراکتر باشد');
    }
    if (minutes == null || minutes < 1 || minutes > 1440) {
      throw const FormatException('زمان صرف‌شده باید بین ۱ تا ۱۴۴۰ دقیقه باشد');
    }
    final body = <String, dynamic>{
      'result': result.trim(),
      'effortMinutes': minutes,
      'complete': complete
    };
    if (!complete && reminder) {
      final dt = JalaliInput.parseDateTime(date, time);
      if (dt.isBefore(DateTime.now().subtract(const Duration(minutes: 1)))) {
        throw const FormatException('زمان یادآوری نمی‌تواند در گذشته باشد');
      }
      if (note.trim().length > 1000) {
        throw const FormatException('یادداشت حداکثر ۱۰۰۰ کاراکتر است');
      }
      body['nextReminder'] = {
        'remindAt': dt.toUtc().toIso8601String(),
        if (note.trim().isNotEmpty) 'note': note.trim()
      };
    }
    return body;
  }
}

/// In-memory only; deliberately no disk or cross-device persistence.
class CaseDrafts {
  static final Map<String, ResultDraft> _items = {};
  static String _key(String user, String id) => '$user::$id';
  static ResultDraft obtain(String user, String id) =>
      _items.putIfAbsent(_key(user, id), ResultDraft.new);
  static bool has(String user, String id) =>
      _items[_key(user, id)]?.dirty == true;
  static void remove(String user, String id) => _items.remove(_key(user, id));
  static void clear() => _items.clear();
}
