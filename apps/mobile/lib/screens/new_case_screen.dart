import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../widgets/common.dart';

/// Minimal new-case form: title, description, priority, optional assignment.
class NewCaseScreen extends StatefulWidget {
  const NewCaseScreen({super.key});

  @override
  State<NewCaseScreen> createState() => _NewCaseScreenState();
}

class _NewCaseScreenState extends State<NewCaseScreen> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  String _priority = 'NORMAL';
  List<dynamic> _members = [];
  List<dynamic> _caseTypes = [];
  String? _assignTo;
  String? _caseTypeId;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    AuthService.instance.get('/companies/current').then((r) {
      if (mounted) setState(() => _caseTypes = r['caseTypes'] ?? []);
    }).catchError((_) {});
    AuthService.instance.get('/members').then((r) {
      if (mounted)
        setState(() =>
            _members = (r['items'] as List).where((m) => m['isActive']).toList());
    }).catchError((_) {});
  }

  Future<void> _submit() async {
    setState(() { _busy = true; _error = null; });
    try {
      await AuthService.instance.post('/cases', {
        'title': _title.text.trim(),
        'description': _description.text.trim().isEmpty ? null : _description.text.trim(),
        'priority': _priority,
        'caseTypeId': _caseTypeId,
        'assignToUserId': _assignTo,
      });
      if (!mounted) return;
      Navigator.pop(context);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('پرونده جدید')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _title,
              autofocus: true,
              decoration: const InputDecoration(labelText: 'عنوان *', hintText: 'مثلاً: تماس با مشتری برای پیش‌فاکتور'),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _description,
              maxLines: 4,
              decoration: const InputDecoration(labelText: 'توضیحات', hintText: 'شرح موضوع و مراحل…'),
            ),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              value: _priority,
              decoration: const InputDecoration(labelText: 'اولویت'),
              items: const [
                DropdownMenuItem(value: 'LOW', child: Text('کم')),
                DropdownMenuItem(value: 'NORMAL', child: Text('معمولی')),
                DropdownMenuItem(value: 'HIGH', child: Text('زیاد')),
                DropdownMenuItem(value: 'URGENT', child: Text('فوری')),
              ],
              onChanged: (v) => setState(() => _priority = v ?? 'NORMAL'),
            ),
            if (_caseTypes.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 14),
                child: DropdownButtonFormField<String>(
                  value: _caseTypeId,
                  decoration: const InputDecoration(labelText: 'نوع پرونده'),
                  items: [const DropdownMenuItem<String>(value: null, child: Text('— بدون نوع —'))] +
                      [for (final t in _caseTypes) DropdownMenuItem<String>(value: t['id'] as String?, child: Text(t['name'] as String))],
                  onChanged: (v) => setState(() => _caseTypeId = v),
                ),
              ),
            if (_members.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 14),
                child: DropdownButtonFormField<String>(
                  value: _assignTo,
                  decoration: const InputDecoration(labelText: 'ارجاع به (اختیاری)'),
                  items: [const DropdownMenuItem<String>(value: null, child: Text('خودم پیگیری می‌کنم'))] +
                      [for (final m in _members)
                        if (m['userId'] != AuthService.instance.user?['id'])
                          DropdownMenuItem<String>(value: m['userId'] as String?, child: Text(m['fullName'] as String))],
                  onChanged: (v) => setState(() => _assignTo = v),
                ),
              ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(10)),
                child: Text(_error!, style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 12.5)),
              ),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: (_busy || _title.text.trim().length < 3) ? null : _submit,
              child: Text(_busy ? 'در حال ثبت…' : 'ایجاد پرونده'),
            ),
          ],
        ),
      ),
    );
  }
}
