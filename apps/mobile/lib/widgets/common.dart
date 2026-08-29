import 'package:flutter/material.dart';
import 'package:shamsi_date/shamsi_date.dart';
import '../theme/premium_theme.dart';

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
    if (seconds < 60) return '${num(1)} دقیقه';
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
  'OPEN': FollowaColors.cyan,
  'WAITING_ACCEPTANCE': FollowaColors.amber,
  'IN_PROGRESS': FollowaColors.blue,
  'WAITING_APPROVAL': FollowaColors.brandSoft,
  'DONE': FollowaColors.emerald,
  'CANCELLED': FollowaColors.soft,
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
    final color = statusColors[status] ?? FollowaColors.soft;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(.10),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withOpacity(.22)),
      ),
      child: Text(
        statusLabels[status] ?? status,
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w800,
          color: color,
        ),
      ),
    );
  }
}

class PremiumPanel extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? accent;

  const PremiumPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.accent,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: FollowaColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: accent?.withOpacity(.24) ?? FollowaColors.border,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x24000000),
            blurRadius: 24,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: child,
    );
  }
}

class MetricTile extends StatelessWidget {
  final String label;
  final Object value;
  final IconData icon;
  final Color color;
  final String? hint;

  const MetricTile({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.color = FollowaColors.brandSoft,
    this.hint,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: FollowaColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withOpacity(.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: color.withOpacity(.11),
                  borderRadius: BorderRadius.circular(11),
                  border: Border.all(color: color.withOpacity(.20)),
                ),
                child: Icon(icon, size: 17, color: color),
              ),
              const Spacer(),
              Text(
                Fa.num(value),
                style: const TextStyle(
                  color: FollowaColors.ink,
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            label,
            style: const TextStyle(
              color: FollowaColors.muted,
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
          if (hint != null) ...[
            const SizedBox(height: 4),
            Text(
              hint!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: FollowaColors.soft,
                fontSize: 9.5,
              ),
            ),
          ],
        ],
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
        padding: const EdgeInsets.symmetric(vertical: 42, horizontal: 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                color: FollowaColors.elevated,
                borderRadius: BorderRadius.circular(17),
                border: Border.all(color: FollowaColors.border),
              ),
              child: const Icon(
                Icons.inbox_outlined,
                size: 26,
                color: FollowaColors.soft,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: FollowaColors.ink,
                fontWeight: FontWeight.w800,
                fontSize: 14,
              ),
            ),
            if (hint != null) ...[
              const SizedBox(height: 5),
              Text(
                hint!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: FollowaColors.soft,
                  fontSize: 11.5,
                  height: 1.6,
                ),
              ),
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
        child: PremiumPanel(
          accent: FollowaColors.red,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.error_outline_rounded,
                size: 38,
                color: FollowaColors.red,
              ),
              const SizedBox(height: 10),
              Text(
                message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFFFCA5A5),
                  fontSize: 12,
                  height: 1.6,
                ),
              ),
              if (onRetry != null) ...[
                const SizedBox(height: 8),
                TextButton(
                  onPressed: onRetry,
                  child: const Text('تلاش دوباره'),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
