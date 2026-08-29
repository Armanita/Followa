import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
import '../widgets/common.dart';
import 'case_detail_screen.dart';

class AssignmentsScreen extends StatefulWidget {
  const AssignmentsScreen({super.key});

  @override
  State<AssignmentsScreen> createState() => _AssignmentsScreenState();
}

class _AssignmentsScreenState extends State<AssignmentsScreen> {
  List<dynamic> _items = [];
  String? _error;
  bool _loading = true;
  String? _busyCaseId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _error = null;
        _loading = true;
      });
    }
    try {
      final response = await AuthService.instance.get('/assignments/pending');
      final items = (response['items'] as List<dynamic>? ?? const [])
          .where((raw) {
        final item = raw as Map<String, dynamic>;
        final c = item['case'] as Map<String, dynamic>?;
        return c?['status'] == 'WAITING_ACCEPTANCE';
      }).toList();
      if (mounted) setState(() => _items = items);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _accept(Map<String, dynamic> c) async {
    final id = c['id'].toString();
    if (_busyCaseId != null) return;
    setState(() => _busyCaseId = id);
    try {
      await AuthService.instance.post('/cases/$id/accept');
      if (!mounted) return;
      _message('پرونده پذیرفته شد');
      await _load();
    } catch (error) {
      _message(error.toString());
    } finally {
      if (mounted) setState(() => _busyCaseId = null);
    }
  }

  Future<void> _reject(Map<String, dynamic> c) async {
    final controller = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('رد کردن ارجاع'),
        content: TextField(
          controller: controller,
          maxLines: 4,
          autofocus: true,
          decoration: const InputDecoration(
            labelText: 'دلیل رد *',
            hintText: 'دلیل مشخص و قابل پیگیری را ثبت کنید…',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('انصراف'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('ثبت رد'),
          ),
        ],
      ),
    );
    final reason = controller.text.trim();
    controller.dispose();
    if (ok != true || reason.length < 3) return;

    final id = c['id'].toString();
    setState(() => _busyCaseId = id);
    try {
      await AuthService.instance.post('/cases/$id/reject', {'reason': reason});
      if (!mounted) return;
      _message('ارجاع رد و به فرستنده بازگشت داده شد');
      await _load();
    } catch (error) {
      _message(error.toString());
    } finally {
      if (mounted) setState(() => _busyCaseId = null);
    }
  }

  Future<void> _openCase(Map<String, dynamic> c) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => CaseDetailScreen(caseId: c['id'].toString()),
      ),
    );
    await _load();
  }

  @override
  Widget build(BuildContext context) {
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
                'صندوق مسئولیت',
                style: TextStyle(
                  color: FollowaColors.soft,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 3),
              const Text(
                'ارجاع‌های جدید',
                style: TextStyle(
                  color: FollowaColors.ink,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 5),
              Text(
                '${Fa.num(_items.length)} پرونده منتظر پذیرش یا رد',
                style: const TextStyle(
                  color: FollowaColors.muted,
                  fontSize: 10.5,
                ),
              ),
              const SizedBox(height: 16),
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
                    title: 'ارجاع در انتظاری ندارید',
                    hint: 'پرونده‌های جدیدی که نیازمند پذیرش شما باشند اینجا ظاهر می‌شوند.',
                  ),
                )
              else
                ..._items.map((raw) {
                  final item = raw as Map<String, dynamic>;
                  final c = item['case'] as Map<String, dynamic>;
                  final busy = _busyCaseId == c['id'];
                  final from = item['fromUser'] ?? item['fromUs'];
                  final fromName = from is Map
                      ? '${from['firstName'] ?? ''} ${from['lastName'] ?? ''}'.trim()
                      : '';
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: PremiumPanel(
                      accent: FollowaColors.amber,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: FollowaColors.elevated,
                                  borderRadius: BorderRadius.circular(9),
                                  border: Border.all(color: FollowaColors.border),
                                ),
                                child: Text(
                                  '#${Fa.num(c['number'] ?? '—')}',
                                  style: const TextStyle(
                                    color: FollowaColors.muted,
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ),
                              const Spacer(),
                              StatusChip(status: c['status']?.toString() ?? ''),
                            ],
                          ),
                          const SizedBox(height: 11),
                          InkWell(
                            onTap: () => _openCase(c),
                            child: Text(
                              c['title']?.toString() ?? 'پرونده',
                              style: const TextStyle(
                                color: FollowaColors.ink,
                                fontSize: 13.5,
                                height: 1.55,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                          if (fromName.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              'ارجاع از: $fromName',
                              style: const TextStyle(
                                color: FollowaColors.soft,
                                fontSize: 9.5,
                              ),
                            ),
                          ],
                          if ((item['note'] ?? '').toString().trim().isNotEmpty) ...[
                            const SizedBox(height: 9),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: FollowaColors.elevated,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: FollowaColors.border),
                              ),
                              child: Text(
                                item['note'].toString(),
                                style: const TextStyle(
                                  color: FollowaColors.muted,
                                  fontSize: 10,
                                  height: 1.6,
                                ),
                              ),
                            ),
                          ],
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: FilledButton.icon(
                                  onPressed: busy ? null : () => _accept(c),
                                  icon: const Icon(Icons.check_rounded, size: 18),
                                  label: Text(busy ? 'در حال ثبت…' : 'پذیرش'),
                                  style: FilledButton.styleFrom(
                                    backgroundColor: FollowaColors.emerald,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: busy ? null : () => _reject(c),
                                  icon: const Icon(Icons.close_rounded, size: 18),
                                  label: const Text('رد کردن'),
                                  style: OutlinedButton.styleFrom(
                                    foregroundColor: const Color(0xFFFCA5A5),
                                    side: const BorderSide(color: Color(0x44F87171)),
                                  ),
                                ),
                              ),
                            ],
                          ),
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
