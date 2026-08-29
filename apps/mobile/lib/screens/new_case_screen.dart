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
  final _assignNote = TextEditingController();
  final _customerSearch = TextEditingController();
  String _priority = 'NORMAL';
  String? _caseTypeId;
  String? _assignTo;
  String? _customerId;
  List<dynamic> _caseTypes = [];
  List<dynamic> _members = [];
  List<dynamic> _customers = [];
  bool _busy = false;
  bool _customerLoading = false;
  String? _error;

  bool get _isManager => AuthService.instance.isManager;

  @override
  void initState() { super.initState(); _loadMeta(); _loadCustomers(); }

  @override
  void dispose() {
    _title.dispose(); _description.dispose(); _assignNote.dispose(); _customerSearch.dispose(); super.dispose();
  }

  Future<void> _loadMeta() async {
    try {
      final company = await AuthService.instance.get('/companies/current');
      if (mounted) setState(() => _caseTypes = company['caseTypes'] as List<dynamic>? ?? const []);
    } catch (_) {}
    if (_isManager) {
      try {
        final response = await AuthService.instance.get('/members');
        if (mounted) setState(() => _members = (response['items'] as List<dynamic>? ?? const []).where((raw) { final m = raw as Map<String, dynamic>; return m['isActive'] == true && m['role'] == 'EMPLOYEE'; }).toList());
      } catch (_) {}
    }
  }

  Future<void> _loadCustomers() async {
    setState(() => _customerLoading = true);
    try {
      final search = _customerSearch.text.trim();
      final response = await AuthService.instance.get('/customers?pageSize=30${search.isEmpty ? '' : '&search=${Uri.encodeComponent(search)}'}');
      if (mounted) setState(() => _customers = response['items'] as List<dynamic>? ?? const []);
    } catch (_) {
      if (mounted) setState(() => _customers = []);
    } finally {
      if (mounted) setState(() => _customerLoading = false);
    }
  }

  Future<void> _quickCustomer() async {
    var type = 'INDIVIDUAL';
    final name = TextEditingController();
    final mobile = TextEditingController();
    final phone = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, setD) => AlertDialog(
      title: const Text('مشتری سریع'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        DropdownButtonFormField<String>(initialValue: type, decoration: const InputDecoration(labelText: 'نوع'), items: const [DropdownMenuItem(value: 'INDIVIDUAL', child: Text('شخص حقیقی')), DropdownMenuItem(value: 'LEGAL', child: Text('شخص حقوقی'))], onChanged: (v) => setD(() => type = v ?? type)),
        const SizedBox(height: 9),
        TextField(controller: name, autofocus: true, decoration: const InputDecoration(labelText: 'نام *')),
        const SizedBox(height: 9),
        TextField(controller: mobile, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'موبایل (اختیاری)')),
        const SizedBox(height: 9),
        TextField(controller: phone, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'تلفن (اختیاری)')),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('انصراف')), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('ثبت و انتخاب'))],
    )));
    final customerName = name.text.trim();
    final customerMobile = mobile.text.trim();
    final customerPhone = phone.text.trim();
    name.dispose(); mobile.dispose(); phone.dispose();
    if (ok == true && customerName.length >= 2) {
      try {
        final response = await AuthService.instance.post('/customers', {'type': type, 'name': customerName, if (customerMobile.isNotEmpty) 'mobile': customerMobile, if (customerPhone.isNotEmpty) 'phone': customerPhone});
        final customer = response['customer'] as Map<String, dynamic>;
        if (mounted) setState(() { _customerId = customer['id'].toString(); _customers = [customer, ..._customers.where((raw) => (raw as Map<String, dynamic>)['id'] != customer['id'])]; });
      } catch (error) { _message(error.toString()); }
    }
  }

  Future<void> _submit() async {
    if (_busy || _title.text.trim().length < 3) return;
    setState(() { _busy = true; _error = null; });
    try {
      await AuthService.instance.post('/cases', {
        'title': _title.text.trim(),
        if (_description.text.trim().isNotEmpty) 'description': _description.text.trim(),
        'priority': _priority,
        if (_caseTypeId != null) 'caseTypeId': _caseTypeId,
        if (_customerId != null) 'customerId': _customerId,
        if (_assignTo != null) 'assignToUserId': _assignTo,
        if (_assignTo != null && _assignNote.text.trim().isNotEmpty) 'assignNote': _assignNote.text.trim(),
      });
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('پرونده جدید')),
      body: SingleChildScrollView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 30), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        PremiumPanel(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const _Title(icon: Icons.description_outlined, title: 'مشخصات پرونده', subtitle: 'عنوان و شرح عملیاتی پرونده را ثبت کنید.'),
          const SizedBox(height: 14),
          TextField(controller: _title, autofocus: true, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: 'عنوان *', hintText: 'مثلاً: تماس با مشتری برای پیش‌فاکتور')),
          const SizedBox(height: 11),
          TextField(controller: _description, maxLines: 4, decoration: const InputDecoration(labelText: 'توضیحات', alignLabelWithHint: true)),
        ])),
        const SizedBox(height: 11),
        PremiumPanel(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const _Title(icon: Icons.tune_rounded, title: 'طبقه‌بندی', subtitle: 'اولویت و نوع پرونده را مشخص کنید.'),
          const SizedBox(height: 14),
          DropdownButtonFormField<String>(initialValue: _priority, decoration: const InputDecoration(labelText: 'اولویت'), dropdownColor: FollowaColors.elevated, items: const [DropdownMenuItem(value: 'LOW', child: Text('کم')), DropdownMenuItem(value: 'NORMAL', child: Text('معمولی')), DropdownMenuItem(value: 'HIGH', child: Text('زیاد')), DropdownMenuItem(value: 'URGENT', child: Text('فوری'))], onChanged: (v) => setState(() => _priority = v ?? 'NORMAL')),
          if (_caseTypes.isNotEmpty) ...[const SizedBox(height: 10), DropdownButtonFormField<String>(value: _caseTypeId, decoration: const InputDecoration(labelText: 'نوع پرونده'), dropdownColor: FollowaColors.elevated, items: [const DropdownMenuItem(value: null, child: Text('— بدون نوع —')), for (final raw in _caseTypes) DropdownMenuItem(value: (raw as Map<String, dynamic>)['id'].toString(), child: Text(raw['name'].toString()))], onChanged: (v) => setState(() => _caseTypeId = v))],
        ])),
        const SizedBox(height: 11),
        PremiumPanel(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [const Expanded(child: _Title(icon: Icons.people_alt_outlined, title: 'مشتری (اختیاری)', subtitle: 'پرونده داخلی می‌تواند بدون مشتری باشد.')), TextButton.icon(onPressed: _quickCustomer, icon: const Icon(Icons.add_rounded, size: 17), label: const Text('مشتری سریع'))]),
          const SizedBox(height: 12),
          TextField(controller: _customerSearch, textInputAction: TextInputAction.search, onSubmitted: (_) => _loadCustomers(), decoration: InputDecoration(labelText: 'جستجوی مشتری', prefixIcon: const Icon(Icons.search_rounded), suffixIcon: _customerLoading ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))) : null)),
          const SizedBox(height: 10),
          DropdownButtonFormField<String>(value: _customerId, decoration: const InputDecoration(labelText: 'انتخاب مشتری'), dropdownColor: FollowaColors.elevated, items: [const DropdownMenuItem(value: null, child: Text('— بدون مشتری / پرونده داخلی —')), for (final raw in _customers) DropdownMenuItem(value: (raw as Map<String, dynamic>)['id'].toString(), child: Text('${raw['name']}${(raw['mobile'] ?? '').toString().isEmpty ? '' : ' — ${raw['mobile']}'}'))], onChanged: (v) => setState(() => _customerId = v)),
        ])),
        if (_isManager) ...[
          const SizedBox(height: 11),
          PremiumPanel(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const _Title(icon: Icons.forward_to_inbox_outlined, title: 'ارجاع اولیه', subtitle: 'فقط کارکنان فعال شرکت مقصد ارجاع هستند.'),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(value: _assignTo, decoration: const InputDecoration(labelText: 'ارجاع به'), dropdownColor: FollowaColors.elevated, items: [const DropdownMenuItem(value: null, child: Text('بدون ارجاع — فقط ثبت پرونده')), for (final raw in _members) DropdownMenuItem(value: (raw as Map<String, dynamic>)['userId'].toString(), child: Text(raw['fullName'].toString()))], onChanged: (v) => setState(() => _assignTo = v)),
            if (_assignTo != null) ...[const SizedBox(height: 10), TextField(controller: _assignNote, maxLines: 2, decoration: const InputDecoration(labelText: 'توضیح ارجاع'))],
          ])),
        ],
        if (_error != null) ...[const SizedBox(height: 11), Text(_error!, style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 10.5))],
        const SizedBox(height: 16),
        FilledButton.icon(onPressed: !_busy && _title.text.trim().length >= 3 ? _submit : null, icon: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.add_task_rounded), label: Text(_busy ? 'در حال ثبت…' : 'ایجاد پرونده')),
      ])),
    );
  }

  void _message(String text) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text))); }
}

class _Title extends StatelessWidget {
  final IconData icon; final String title; final String subtitle;
  const _Title({required this.icon, required this.title, required this.subtitle});
  @override
  Widget build(BuildContext context) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Container(width: 34, height: 34, alignment: Alignment.center, decoration: BoxDecoration(color: FollowaColors.elevated, borderRadius: BorderRadius.circular(11), border: Border.all(color: FollowaColors.border)), child: Icon(icon, color: FollowaColors.brandSoft, size: 17)), const SizedBox(width: 9), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: FollowaColors.ink, fontSize: 12, fontWeight: FontWeight.w900)), const SizedBox(height: 2), Text(subtitle, style: const TextStyle(color: FollowaColors.soft, fontSize: 9, height: 1.5))]))]);
}
