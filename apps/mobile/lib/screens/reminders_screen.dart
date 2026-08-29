import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
import '../widgets/common.dart';
import 'case_detail_screen.dart';

class RemindersScreen extends StatefulWidget {
  const RemindersScreen({super.key});

  @override
  State<RemindersScreen> createState() => _RemindersScreenState();
}

class _RemindersScreenState extends State<RemindersScreen> {
  List<dynamic> _items = [];
  String _tab = 'ACTIVE';
  String? _error;
  bool _loading = true;
  String? _busyId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      try {
        await AuthService.instance
            .get('/reminders/due-check')
            .timeout(const Duration(seconds: 5));
      } catch (_) {}
      final path = _tab == 'TODAY'
          ? '/reminders?today=true&status=ACTIVE'
          : '/reminders?status=$_tab';
      final response = await AuthService.instance.get(path);
      if (mounted) {
        setState(() => _items = response['items'] as List<dynamic>? ?? const []);
      }
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _complete(Map<String, dynamic> reminder) async {
    final controller = TextEditingController(text: reminder['note']?.toString() ?? '');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('ثبت نتیجه یادآوری'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: FollowaColors.elevated,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: FollowaColors.border),
              ),
              child: Text(
                'نتیجه در تاریخچه پرونده «${reminder['case']?['title'] ?? ''}» نیز ثبت می‌شود.',
                style: const TextStyle(
                  color: FollowaColors.muted,
                  fontSize: 9.5,
                  height: 1.6,
                ),
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: controller,
              maxLines: 4,
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'نتیجه پیگیری',
                hintText: 'نتیجه انجام پیگیری را بنویسید…',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('انصراف'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('ثبت نتیجه و تکمیل'),
          ),
        ],
      ),
    );
    final result = controller.text.trim();
    controller.dispose();
    if (ok != true) return;

    final id = reminder['id'].toString();
    setState(() => _busyId = id);
    try {
      await AuthService.instance.post(
        '/reminders/$id/complete',
        {if (result.isNotEmpty) 'result': result},
      );
      if (!mounted) return;
      _message('یادآوری انجام شد');
      await _load();
    } catch (error) {
      _message(error.toString());
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _openCase(Map<String, dynamic> reminder) async {
    final caseId = reminder['caseId']?.toString() ?? reminder['case']?['id']?.toString();
    if (caseId == null || !mounted) return;
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => CaseDetailScreen(caseId: caseId)),
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    const tabs = <(String, String)>[
      ('ACTIVE', 'فعال'),
      ('TODAY', 'امروز'),
      ('DONE', 'انجام‌شده'),
      ('EXPIRED', 'گذشته'),
    ];
    final overdue = _items.where((raw) {
      final item = raw as Map<String, dynamic>;
      final date = DateTime.tryParse(item['remindAt']?.toString() ?? '');
      return item['status'] == 'ACTIVE' && date != null && date.isBefore(DateTime.now());
    }).length;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
            children: [
              const Text(
                'پیگیری شخصی',
                style: TextStyle(
                  color: FollowaColors.soft,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 3),
              const Text(
                'یادآوری‌ها',
                style: TextStyle(
                  color: FollowaColors.ink,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                overdue > 0
                    ? '${Fa.num(overdue)} مورد از سررسید عبور کرده'
                    : 'وضعیت پیگیری‌های شما',
                style: TextStyle(
                  color: overdue > 0 ? const Color(0xFFFCA5A5) : FollowaColors.muted,
                  fontSize: 10.5,
                  fontWeight: overdue > 0 ? FontWeight.w800 : FontWeight.w500,
                ),
              ),
              const SizedBox(height: 14),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (final tab in tabs)
                      Padding(
                        padding: const EdgeInsets.only(left: 7),
                        child: ChoiceChip(
                          label: Text(tab.$2),
                          selected: _tab == tab.$1,
                          onSelected: (_) {
                            setState(() => _tab = tab.$1);
                            _load();
                          },
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.all(48),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_error != null)
                ErrorState(message: _error!, onRetry: _load)
              else if (_items.isEmpty)
                const PremiumPanel(
                  child: EmptyState(
                    title: 'یادآوری‌ای در این بخش نیست',
                    hint: 'پیگیری بعدی هنگام ثبت نتیجه پرونده قابل ایجاد است.',
                  ),
                )
              else
                ..._items.map((raw) {
                  final reminder = raw as Map<String, dynamic>;
                  final date = DateTime.parse(reminder['remindAt'].toString());
                  final isOverdue = reminder['status'] == 'ACTIVE' && date.isBefore(DateTime.now());
                  final done = reminder['status'] == 'DONE';
                  final accent = isOverdue
                      ? FollowaColors.red
                      : done
                          ? FollowaColors.emerald
                          : FollowaColors.amber;
                  final busy = _busyId == reminder['id'];
                  final c = reminder['case'] as Map<String, dynamic>?;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: PremiumPanel(
                      accent: accent,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 40,
                                height: 40,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: accent.withOpacity(.08),
                                  borderRadius: BorderRadius.circular(13),
                                  border: Border.all(color: accent.withOpacity(.18)),
                                ),
                                child: Icon(
                                  done ? Icons.check_rounded : Icons.alarm_rounded,
                                  color: accent,
                                  size: 20,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      (reminder['note'] ?? c?['title'] ?? 'یادآوری').toString(),
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        color: FollowaColors.ink,
                                        fontSize: 11.5,
                                        height: 1.5,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    InkWell(
                                      onTap: () => _openCase(reminder),
                                      child: Text(
                                        c == null
                                            ? 'پرونده'
                                            : '#${Fa.num(c['number'] ?? '—')} · ${c['title']}',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          color: FollowaColors.brandSoft,
                                          fontSize: 9.5,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      '${Fa.dateTime(date)}${isOverdue ? ' · سررسید گذشته' : ''}',
                                      style: TextStyle(
                                        color: isOverdue
                                            ? const Color(0xFFFCA5A5)
                                            : FollowaColors.soft,
                                        fontSize: 9,
                                        fontWeight: isOverdue
                                            ? FontWeight.w800
                                            : FontWeight.w500,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          if (reminder['status'] == 'ACTIVE') ...[
                            const SizedBox(height: 12),
                            OutlinedButton.icon(
                              onPressed: busy ? null : () => _complete(reminder),
                              icon: const Icon(Icons.task_alt_rounded, size: 18),
                              label: Text(busy ? 'در حال ثبت…' : 'انجام شد + ثبت نتیجه'),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: const Color(0xFF86EFAC),
                                side: const BorderSide(color: Color(0x4434D399)),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                }),
            ],
          ),
        ),
      ),
    );
  }

  void _message(String text) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }
}
