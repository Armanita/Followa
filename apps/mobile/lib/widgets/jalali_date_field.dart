import 'package:flutter/material.dart';
import 'package:shamsi_date/shamsi_date.dart';
import '../utils/jalali_input.dart';
import 'common.dart';

Future<String?> pickCaseJalaliDate(BuildContext context, String initial) {
  var shown = Jalali.now();
  try {
    shown = JalaliInput.parseDateTime(initial, '09:00').toJalali();
  } catch (_) {}
  return showDialog<String>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, update) {
            return AlertDialog(
                title: const Text('انتخاب تاریخ شمسی'),
                content: SizedBox(
                    width: 330,
                    child: SingleChildScrollView(
                        child:
                            Column(mainAxisSize: MainAxisSize.min, children: [
                      Row(children: [
                        IconButton(
                            tooltip: 'ماه قبل',
                            onPressed: () =>
                                update(() => shown = shown.addMonths(-1)),
                            icon: const Icon(Icons.chevron_right)),
                        Expanded(
                            child: Text(
                                '${Fa.num(shown.year)}/${Fa.num(shown.month)}',
                                textAlign: TextAlign.center)),
                        IconButton(
                            tooltip: 'ماه بعد',
                            onPressed: () =>
                                update(() => shown = shown.addMonths(1)),
                            icon: const Icon(Icons.chevron_left))
                      ]),
                      Wrap(children: [
                        for (var day = 1; day <= shown.monthLength; day++)
                          SizedBox(
                              width: 48,
                              height: 48,
                              child: TextButton(
                                  onPressed: () => Navigator.pop(
                                      context,
                                      JalaliInput.format(
                                          Jalali(shown.year, shown.month, day)
                                              .toDateTime())),
                                  child: Text(Fa.num(day))))
                      ]),
                    ]))),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('انصراف'))
                ]);
          }));
}
