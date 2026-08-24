import 'package:flutter/material.dart';
import 'package:shamsi_date/shamsi_date.dart';

/// Jalali formatting helpers + Persian digits.
class Fa {
  static const digits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

  static String num(Object n) => n.toString().replaceAllMapped(
      RegExp(r'\d'), (m) => digits[int.parse(m.group(0)!)]);

  static String date(DateTime dt) {
    final j = dt.toJalali();
    const months = [
      'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
      'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
    ];
    return '${num(j.day)} ${months[j.month - 1]} ${num(j.year)}';
  }

  static String dateTime(DateTime dt) {
    final hh = dt.hour.toString().padLeft(2, '0');
    final mm = dt.minute.toString().padLeft(2, '0');
    return '${date(dt)}، ${num(hh)}:${num(mm)}';
  }

  static String duration(int seconds) {
    if (seconds < 60) return '$num(1) دقیقه';
    final h = seconds ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    if (h > 0 && m > 0) return '${num(h)} ساعت و ${num(m)} دقیقه';
    if (h > 0) return '${num(h)} ساعت';
    return '${num(m)} دقیقه';
  }
}

const statusLabels = {
  'OPEN': 'باز',
  'WAITING_ACCEPTANCE': 'در انتظار پذیرش',
  'IN_PROGRESS': 'در حال انجام',
  'WAITING_APPROVAL': 'در انتظار تأیید',
  'DONE': 'تکمیل شده',
  'CANCELLED': 'لغو شده',
};

const statusColors = {
  'OPEN': Color(0xFF0284C7),
  'WAITING_ACCEPTANCE': Color(0xFFF59E0B),
  'IN_PROGRESS': Color(0xFF2558EB),
  'WAITING_APPROVAL': Color(0xFF7C3AED),
  'DONE': Color(0xFF059669),
  'CANCELLED': Color(0xFF64748B),
};

const priorityLabels = {
  'LOW': 'کم',
  'NORMAL': 'معمولی',
  'HIGH': 'زیاد',
  'URGENT': 'فوری',
};

const activityLabels = {
  'CREATE': 'پرونده ایجاد شد',
  'ASSIGN': 'ارجاع داده شد',
  'ACCEPT': 'پذیرفته شد',
  'REJECT': 'رد شد',
  'START_WORK': 'شروع کار',
  'END_WORK': 'پایان کار',
  'RESULT_ADDED': 'نتیجه ثبت شد',
  'FILE_UPLOADED': 'فایل پیوست شد',
  'COMPLETE': 'تکمیل شد',
  'CANCEL': 'لغو شد',
  'REMINDER_CREATED': 'یادآوری ساخته شد',
  'REMINDER_DONE': 'یادآوری انجام شد',
};

class StatusChip extends StatelessWidget {
  final String status;
  const StatusChip({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final color = statusColors[status] ?? Colors.grey;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        statusLabels[status] ?? status,
        style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  final String title;
  final String? hint;
  const EmptyState({super.key, required this.title, this.hint});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.inbox_outlined, size: 48, color: Colors.grey.shade400),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            if (hint != null) ...[
              const SizedBox(height: 4),
              Text(hint!,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
            ],
          ],
        ),
      ),
    );
  }
}

class ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback? onRetry;
  const ErrorState({super.key, required this.message, this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 44, color: Color(0xFFDC2626)),
            const SizedBox(height: 10),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13.5)),
            if (onRetry != null)
              TextButton(onPressed: onRetry, child: const Text('تلاش دوباره')),
          ],
        ),
      ),
    );
  }
}
