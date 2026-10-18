import 'package:flutter/material.dart';
import '../theme/premium_theme.dart';
import 'common.dart';

String caseTime(Object? value) {
  final date = DateTime.tryParse(value?.toString() ?? '');
  // Keep the existing display semantics; timezone correction is a separate task.
  return date == null ? '—' : Fa.dateTime(date);
}

class CaseSection extends StatelessWidget {
  final String title;
  final Widget child;
  const CaseSection({super.key, required this.title, required this.child});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(title,
              style:
                  const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          child,
        ]),
      );
}

class ExpandableCaseText extends StatefulWidget {
  final String text;
  final int lines;
  const ExpandableCaseText(this.text, {super.key, this.lines = 4});
  @override
  State<ExpandableCaseText> createState() => _ExpandableCaseTextState();
}

class _ExpandableCaseTextState extends State<ExpandableCaseText> {
  bool expanded = false;
  @override
  Widget build(BuildContext context) =>
      LayoutBuilder(builder: (context, constraints) {
        const style = TextStyle(fontSize: 16, height: 1.7);
        final painter = TextPainter(
            text: TextSpan(
                text: widget.text,
                style: style.copyWith(fontFamily: 'Estedad')),
            textDirection: Directionality.of(context),
            textScaler: MediaQuery.textScalerOf(context),
            maxLines: widget.lines)
          ..layout(maxWidth: constraints.maxWidth);
        final long = painter.didExceedMaxLines;
        painter.dispose();
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(widget.text,
              style: style,
              maxLines: expanded ? null : widget.lines,
              overflow: expanded ? null : TextOverflow.ellipsis),
          if (long)
            TextButton(
                onPressed: () => setState(() => expanded = !expanded),
                child: Text(expanded ? 'نمایش کمتر' : 'نمایش کامل')),
        ]);
      });
}

class CaseActionBar extends StatelessWidget {
  final Widget child;
  const CaseActionBar({super.key, required this.child});
  @override
  Widget build(BuildContext context) => Material(
      color: FollowaColors.surface,
      child: SafeArea(
          top: false,
          child: Padding(padding: const EdgeInsets.all(12), child: child)));
}

class CaseError extends StatelessWidget {
  final String message;
  final VoidCallback? retry;
  const CaseError(this.message, {super.key, this.retry});
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(message,
            style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 14)),
        if (retry != null)
          TextButton(onPressed: retry, child: const Text('تلاش دوباره')),
      ]));
}

Future<bool> confirmDiscard(BuildContext context) async =>
    await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
                title: const Text('تغییرات ذخیره نشده است'),
                content: const Text(
                    'از این صفحه خارج شوید و تغییرات را کنار بگذارید؟'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text('ادامه ویرایش')),
                  TextButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      child: const Text('خروج بدون ثبت'))
                ])) ??
    false;
