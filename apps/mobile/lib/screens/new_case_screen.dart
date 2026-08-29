import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
import '../widgets/common.dart';

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
    AuthService.instance.get('/companies/current').then((response) {
      if (mounted) setState(() => _caseTypes = response['caseTypes'] ?? []);
    }).catchError((_) {});
    AuthService.instance.get('/members').then((response) {
      if (mounted) {
        setState(() => _members = (response['items'] as List)
            .where((member) => member['isActive'])
            .toList());
      }
    }).catchError((_) {});
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AuthService.instance.post('/cases', {
        'title': _title.text.trim(),
        'description': _description.text.trim().isEmpty
            ? null
            : _description.text.trim(),
        'priority': _priority,
        'caseTypeId': _caseTypeId,
        'assignToUserId': _assignTo,
      });
      if (!mounted) return;
      Navigator.pop(context);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final canSubmit = !_busy && _title.text.trim().length >= 3;

    return Scaffold(
      appBar: AppBar(
        title: const Text('پرونده جدید'),
        leading: IconButton(
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.arrow_forward_rounded),
        ),
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const _NewCaseHeader(),
              const SizedBox(height: 16),
              PremiumPanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _SectionLabel(
                      icon: Icons.description_outlined,
                      title: 'مشخصات پرونده',
                      subtitle: 'عنوان و شرح عملیاتی پرونده را ثبت کنید.',
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _title,
                      autofocus: true,
                      onChanged: (_) => setState(() {}),
                      decoration: const InputDecoration(
                        labelText: 'عنوان *',
                        hintText: 'مثلاً: تماس با مشتری برای پیش‌فاکتور',
                      ),
                    ),
                    const SizedBox(height: 13),
                    TextField(
                      controller: _description,
                      maxLines: 4,
                      decoration: const InputDecoration(
                        labelText: 'توضیحات',
                        hintText: 'شرح موضوع، انتظار و مراحل پیگیری…',
                        alignLabelWithHint: true,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              PremiumPanel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _SectionLabel(
                      icon: Icons.tune_rounded,
                      title: 'طبقه‌بندی و مسئولیت',
                      subtitle: 'اولویت، نوع پرونده و ارجاع اولیه را مشخص کنید.',
                    ),
                    const SizedBox(height: 16),
                    DropdownButtonFormField<String>(
                      value: _priority,
                      decoration: const InputDecoration(labelText: 'اولویت'),
                      dropdownColor: FollowaColors.elevated,
                      items: const [
                        DropdownMenuItem(value: 'LOW', child: Text('کم')),
                        DropdownMenuItem(value: 'NORMAL', child: Text('معمولی')),
                        DropdownMenuItem(value: 'HIGH', child: Text('زیاد')),
                        DropdownMenuItem(value: 'URGENT', child: Text('فوری')),
                      ],
                      onChanged: (value) =>
                          setState(() => _priority = value ?? 'NORMAL'),
                    ),
                    if (_caseTypes.isNotEmpty) ...[
                      const SizedBox(height: 13),
                      DropdownButtonFormField<String>(
                        value: _caseTypeId,
                        decoration: const InputDecoration(labelText: 'نوع پرونده'),
                        dropdownColor: FollowaColors.elevated,
                        items: [
                          const DropdownMenuItem<String>(
                            value: null,
                            child: Text('— بدون نوع —'),
                          ),
                          for (final type in _caseTypes)
                            DropdownMenuItem<String>(
                              value: type['id'] as String?,
                              child: Text(type['name'] as String),
                            ),
                        ],
                        onChanged: (value) => setState(() => _caseTypeId = value),
                      ),
                    ],
                    if (_members.isNotEmpty) ...[
                      const SizedBox(height: 13),
                      DropdownButtonFormField<String>(
                        value: _assignTo,
                        decoration: const InputDecoration(
                          labelText: 'ارجاع به (اختیاری)',
                        ),
                        dropdownColor: FollowaColors.elevated,
                        items: [
                          const DropdownMenuItem<String>(
                            value: null,
                            child: Text('خودم پیگیری می‌کنم'),
                          ),
                          for (final member in _members)
                            if (member['userId'] != AuthService.instance.user?['id'])
                              DropdownMenuItem<String>(
                                value: member['userId'] as String?,
                                child: Text(member['fullName'] as String),
                              ),
                        ],
                        onChanged: (value) => setState(() => _assignTo = value),
                      ),
                    ],
                  ],
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: FollowaColors.red.withOpacity(.08),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: FollowaColors.red.withOpacity(.22)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(
                        Icons.error_outline_rounded,
                        color: Color(0xFFFCA5A5),
                        size: 18,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _error!,
                          style: const TextStyle(
                            color: Color(0xFFFCA5A5),
                            fontSize: 11.5,
                            height: 1.6,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: canSubmit ? _submit : null,
                icon: _busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.add_task_rounded, size: 19),
                label: Text(_busy ? 'در حال ثبت…' : 'ایجاد پرونده'),
              ),
              const SizedBox(height: 8),
              const Text(
                'پس از ایجاد، تاریخچه و تغییرات پرونده در فضای عملیاتی ثبت می‌شود.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: FollowaColors.soft,
                  fontSize: 9.5,
                  height: 1.6,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NewCaseHeader extends StatelessWidget {
  const _NewCaseHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            FollowaColors.brand.withOpacity(.16),
            FollowaColors.surface,
          ],
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: FollowaColors.brandSoft.withOpacity(.18)),
      ),
      child: const Row(
        children: [
          _HeaderIcon(),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ثبت پرونده عملیاتی',
                  style: TextStyle(
                    color: FollowaColors.ink,
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'اطلاعات اصلی را ثبت کنید؛ جزئیات تکمیلی بعداً در پرونده قابل پیگیری است.',
                  style: TextStyle(
                    color: FollowaColors.muted,
                    fontSize: 10,
                    height: 1.6,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeaderIcon extends StatelessWidget {
  const _HeaderIcon();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 46,
      height: 46,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: FollowaColors.brand.withOpacity(.14),
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: FollowaColors.brandSoft.withOpacity(.22)),
      ),
      child: const Icon(
        Icons.create_new_folder_outlined,
        color: FollowaColors.brandSoft,
        size: 22,
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _SectionLabel({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 36,
          height: 36,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: FollowaColors.elevated,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: FollowaColors.border),
          ),
          child: Icon(icon, color: FollowaColors.brandSoft, size: 18),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: FollowaColors.ink,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                subtitle,
                style: const TextStyle(
                  color: FollowaColors.soft,
                  fontSize: 9.5,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
