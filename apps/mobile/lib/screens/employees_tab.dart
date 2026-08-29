import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
import '../utils/jalali_input.dart';
import '../widgets/common.dart';

class EmployeesTab extends StatefulWidget {
  const EmployeesTab({super.key});
  @override
  State<EmployeesTab> createState() => _EmployeesTabState();
}

class _EmployeesTabState extends State<EmployeesTab> {
  List<dynamic> _items = [];
  String? _error;
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final response = await AuthService.instance.get('/members');
      if (mounted) setState(() => _items = response['items'] as List<dynamic>);
    } catch (error) { if (mounted) setState(() => _error = error.toString()); }
    finally { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _toggle(Map<String, dynamic> member) async {
    try { await AuthService.instance.patch('/members/${member['membershipId']}', {'isActive': member['isActive'] != true}); await _load(); }
    catch (error) { _message(error.toString()); }
  }

  Future<void> _resetPassword(Map<String, dynamic> member) async {
    final controller = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: Text('بازنشانی رمز ${member['fullName']}'),
      content: TextField(controller: controller, obscureText: true, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'رمز جدید (حداقل ۸ کاراکتر)')),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('انصراف')), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('بازنشانی'))],
    ));
    final value = controller.text; controller.dispose();
    if (ok == true && value.length >= 8) {
      try { await AuthService.instance.post('/members/${member['membershipId']}/reset-password', {'newPassword': value}); _message('رمز بازنشانی شد'); }
      catch (error) { _message(error.toString()); }
    }
  }

  Future<void> _create() async {
    final first = TextEditingController(); final last = TextEditingController(); final mobile = TextEditingController(); final job = TextEditingController(); final code = TextEditingController(); final password = TextEditingController();
    var role = 'EMPLOYEE'; var busy = false;
    final saved = await showDialog<bool>(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, setD) => AlertDialog(
      title: const Text('افزودن کارمند'),
      content: SizedBox(width: 500, child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Row(children: [Expanded(child: TextField(controller: first, autofocus: true, decoration: const InputDecoration(labelText: 'نام *'))), const SizedBox(width: 8), Expanded(child: TextField(controller: last, decoration: const InputDecoration(labelText: 'نام خانوادگی *')))]),
        const SizedBox(height: 9), TextField(controller: mobile, textDirection: TextDirection.ltr, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'موبایل *')),
        const SizedBox(height: 9), DropdownButtonFormField<String>(initialValue: role, decoration: const InputDecoration(labelText: 'نقش'), items: const [DropdownMenuItem(value: 'EMPLOYEE', child: Text('کارمند')), DropdownMenuItem(value: 'COMPANY_MANAGER', child: Text('مدیر'))], onChanged: (v) => setD(() => role = v ?? role)),
        const SizedBox(height: 9), TextField(controller: job, decoration: const InputDecoration(labelText: 'سمت سازمانی')),
        const SizedBox(height: 9), TextField(controller: code, decoration: const InputDecoration(labelText: 'کد پرسنلی')),
        const SizedBox(height: 9), TextField(controller: password, obscureText: true, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'رمز اولیه (اختیاری)')),
      ]))),
      actions: [TextButton(onPressed: busy ? null : () => Navigator.pop(ctx, false), child: const Text('انصراف')), FilledButton(onPressed: busy ? null : () async {
        if (first.text.trim().isEmpty || last.text.trim().isEmpty || mobile.text.trim().length < 10) return;
        setD(() => busy = true);
        try {
          await AuthService.instance.post('/members', {'firstName': first.text.trim(), 'lastName': last.text.trim(), 'mobile': mobile.text.trim(), 'role': role, if (job.text.trim().isNotEmpty) 'jobTitle': job.text.trim(), if (code.text.trim().isNotEmpty) 'employeeCode': code.text.trim(), if (password.text.isNotEmpty) 'password': password.text});
          if (ctx.mounted) Navigator.pop(ctx, true);
        } catch (error) { if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(error.toString()))); setD(() => busy = false); }
      }, child: Text(busy ? 'در حال ثبت…' : 'افزودن'))],
    )));
    first.dispose(); last.dispose(); mobile.dispose(); job.dispose(); code.dispose(); password.dispose();
    if (saved == true) await _load();
  }

  Future<void> _profile(Map<String, dynamic> member) async {
    try {
      final response = await AuthService.instance.get('/members/${member['membershipId']}/profile') as Map<String, dynamic>;
      Uint8List? photo;
      if ((response['user'] as Map<String, dynamic>)['hasPersonnelPhoto'] == true) {
        try { photo = (await AuthService.instance.download('/members/${member['membershipId']}/photo')).bytes; } catch (_) {}
      }
      if (!mounted) return;
      await showDialog<void>(context: context, builder: (ctx) => _PersonnelDialog(membershipId: member['membershipId'].toString(), initial: response, photo: photo, onChanged: _load));
    } catch (error) { _message(error.toString()); }
  }

  @override
  Widget build(BuildContext context) {
    final employees = _items.where((raw) => (raw as Map<String, dynamic>)['role'] == 'EMPLOYEE').length;
    final finalized = _items.where((raw) { final m = raw as Map<String, dynamic>; return m['role'] == 'EMPLOYEE' && m['profileFinalizedAt'] != null; }).length;
    return Scaffold(
      appBar: AppBar(title: const Text('کارکنان'), actions: [IconButton(onPressed: _create, icon: const Icon(Icons.person_add_alt_1_rounded))]),
      body: RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 110), children: [
        Row(children: [Expanded(child: _Metric(label: 'اعضا', value: _items.length)), const SizedBox(width: 7), Expanded(child: _Metric(label: 'کارکنان', value: employees)), const SizedBox(width: 7), Expanded(child: _Metric(label: 'ثبت نهایی', value: finalized))]),
        const SizedBox(height: 12),
        if (_loading) const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator()))
        else if (_error != null) ErrorState(message: _error!, onRetry: _load)
        else if (_items.isEmpty) const PremiumPanel(child: EmptyState(title: 'عضوی ثبت نشده است'))
        else ..._items.map((raw) {
          final m = raw as Map<String, dynamic>; final employee = m['role'] == 'EMPLOYEE'; final active = m['isActive'] == true;
          return Padding(padding: const EdgeInsets.only(bottom: 9), child: PremiumPanel(accent: active ? null : FollowaColors.red, child: Column(children: [
            Row(children: [CircleAvatar(backgroundColor: FollowaColors.elevated, child: Text(m['firstName'].toString().substring(0, 1), style: const TextStyle(color: FollowaColors.brandSoft, fontWeight: FontWeight.w900))), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(m['fullName'].toString(), style: const TextStyle(color: FollowaColors.ink, fontWeight: FontWeight.w900)), Text(employee ? (m['jobTitle'] ?? 'کارمند').toString() : 'مدیر شرکت', style: const TextStyle(color: FollowaColors.soft, fontSize: 9.5))])), Text(active ? 'فعال' : 'غیرفعال', style: TextStyle(color: active ? const Color(0xFF86EFAC) : const Color(0xFFFCA5A5), fontSize: 9.5, fontWeight: FontWeight.w800))]),
            const SizedBox(height: 9),
            Row(children: [Expanded(child: Text(m['mobile'].toString(), textDirection: TextDirection.ltr, style: const TextStyle(color: FollowaColors.muted, fontSize: 10))), if (employee) Text(m['profileFinalizedAt'] != null ? 'پروفایل نهایی' : 'در حال تکمیل', style: TextStyle(color: m['profileFinalizedAt'] != null ? const Color(0xFF86EFAC) : const Color(0xFFFDE68A), fontSize: 9))]),
            const SizedBox(height: 10),
            Wrap(spacing: 7, runSpacing: 7, children: [if (employee) OutlinedButton(onPressed: () => _profile(m), child: const Text('پروفایل پرسنلی')), OutlinedButton(onPressed: () => _resetPassword(m), child: const Text('رمز')), OutlinedButton(onPressed: () => _toggle(m), child: Text(active ? 'تعلیق' : 'فعال‌سازی'))]),
          ])));
        }),
      ])),
    );
  }

  void _message(String text) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text))); }
}

class _PersonnelDialog extends StatefulWidget {
  final String membershipId; final Map<String, dynamic> initial; final Uint8List? photo; final Future<void> Function() onChanged;
  const _PersonnelDialog({required this.membershipId, required this.initial, required this.photo, required this.onChanged});
  @override
  State<_PersonnelDialog> createState() => _PersonnelDialogState();
}

class _PersonnelDialogState extends State<_PersonnelDialog> {
  late Map<String, dynamic> _user;
  Uint8List? _photo;
  bool _busy = false;
  @override
  void initState() { super.initState(); _user = Map<String, dynamic>.from(widget.initial['user'] as Map<String, dynamic>); _photo = widget.photo; }

  Future<void> _edit() async {
    final first = TextEditingController(text: _user['firstName']?.toString() ?? ''); final last = TextEditingController(text: _user['lastName']?.toString() ?? ''); final national = TextEditingController(text: _user['nationalId']?.toString() ?? ''); final birth = TextEditingController(text: _user['birthDate'] == null ? '' : JalaliInput.format(DateTime.parse(_user['birthDate'].toString()))); final phone = TextEditingController(text: _user['phone']?.toString() ?? ''); final address = TextEditingController(text: _user['address']?.toString() ?? ''); final card = TextEditingController(text: _user['bankCardNumber']?.toString() ?? ''); final iban = TextEditingController(text: _user['bankIban']?.toString() ?? ''); final bank = TextEditingController(text: _user['bankName']?.toString() ?? ''); var marital = _user['maritalStatus']?.toString();
    final ok = await showDialog<bool>(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, setD) => AlertDialog(title: const Text('ویرایش اطلاعات پرسنلی'), content: SizedBox(width: 480, child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
      Row(children: [Expanded(child: TextField(controller: first, decoration: const InputDecoration(labelText: 'نام'))), const SizedBox(width: 7), Expanded(child: TextField(controller: last, decoration: const InputDecoration(labelText: 'نام خانوادگی')))]), const SizedBox(height: 8), TextField(controller: national, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'کد ملی')), const SizedBox(height: 8), TextField(controller: birth, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'تولد شمسی')), const SizedBox(height: 8), TextField(controller: phone, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'تلفن')), const SizedBox(height: 8), TextField(controller: address, maxLines: 2, decoration: const InputDecoration(labelText: 'آدرس')), const SizedBox(height: 8), DropdownButtonFormField<String>(initialValue: marital, decoration: const InputDecoration(labelText: 'تأهل'), items: const [DropdownMenuItem(value: null, child: Text('—')), DropdownMenuItem(value: 'SINGLE', child: Text('مجرد')), DropdownMenuItem(value: 'MARRIED', child: Text('متأهل'))], onChanged: (v) => setD(() => marital = v)), const SizedBox(height: 8), TextField(controller: card, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'شماره کارت')), const SizedBox(height: 8), TextField(controller: iban, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'شبا')), const SizedBox(height: 8), TextField(controller: bank, decoration: const InputDecoration(labelText: 'بانک')),
    ]))), actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('انصراف')), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('ذخیره'))])));
    if (ok == true) {
      try { setState(() => _busy = true); final response = await AuthService.instance.patch('/members/${widget.membershipId}/profile', {'firstName': first.text.trim(), 'lastName': last.text.trim(), 'nationalId': national.text.trim().isEmpty ? null : JalaliInput.normalizeDigits(national.text), 'birthDate': birth.text.trim().isEmpty ? null : JalaliInput.parseDateTime(birth.text, '00:00').toIso8601String(), 'phone': phone.text.trim().isEmpty ? null : phone.text.trim(), 'address': address.text.trim().isEmpty ? null : address.text.trim(), 'maritalStatus': marital, 'bankCardNumber': card.text.trim().isEmpty ? null : JalaliInput.normalizeDigits(card.text), 'bankIban': iban.text.trim().isEmpty ? null : iban.text.trim(), 'bankName': bank.text.trim().isEmpty ? null : bank.text.trim()}); setState(() => _user = response['user'] as Map<String, dynamic>); await widget.onChanged(); }
      catch (error) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString()))); } finally { if (mounted) setState(() => _busy = false); }
    }
    first.dispose(); last.dispose(); national.dispose(); birth.dispose(); phone.dispose(); address.dispose(); card.dispose(); iban.dispose(); bank.dispose();
  }

  Future<void> _uploadPhoto() async {
    final result = await FilePicker.pickFiles(type: FileType.image, allowMultiple: false, withData: true); if (result == null || result.files.isEmpty || result.files.single.bytes == null) return;
    try { setState(() => _busy = true); final response = await AuthService.instance.uploadBytes('/members/${widget.membershipId}/photo', fieldName: 'file', filename: result.files.single.name, bytes: result.files.single.bytes!); _user = response['user'] as Map<String, dynamic>; _photo = (await AuthService.instance.download('/members/${widget.membershipId}/photo')).bytes; await widget.onChanged(); if (mounted) setState(() {}); }
    catch (error) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString()))); } finally { if (mounted) setState(() => _busy = false); }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(title: Text('${_user['firstName']} ${_user['lastName']}'), content: SizedBox(width: 500, child: SingleChildScrollView(child: Column(children: [
    CircleAvatar(radius: 42, backgroundColor: FollowaColors.elevated, backgroundImage: _photo == null ? null : MemoryImage(_photo!), child: _photo == null ? const Icon(Icons.person_outline_rounded, size: 34) : null), const SizedBox(height: 8), TextButton.icon(onPressed: _busy ? null : _uploadPhoto, icon: const Icon(Icons.camera_alt_outlined), label: const Text('تغییر عکس')), const Divider(), _line('کد ملی', _user['nationalId']), _line('تولد', _user['birthDate'] == null ? null : Fa.date(DateTime.parse(_user['birthDate'].toString()))), _line('تلفن', _user['phone']), _line('آدرس', _user['address']), _line('تأهل', _user['maritalStatus'] == 'MARRIED' ? 'متأهل' : _user['maritalStatus'] == 'SINGLE' ? 'مجرد' : null), _line('کارت', _user['bankCardNumber']), _line('شبا', _user['bankIban']), _line('بانک', _user['bankName']), _line('وضعیت', _user['profileFinalizedAt'] == null ? 'در حال تکمیل' : 'ثبت نهایی'),
  ]))), actions: [TextButton(onPressed: _busy ? null : _edit, child: const Text('ویرایش')), TextButton(onPressed: () => Navigator.pop(context), child: const Text('بستن'))]);

  Widget _line(String key, Object? value) => Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [SizedBox(width: 78, child: Text(key, style: const TextStyle(color: FollowaColors.soft, fontSize: 9.5))), Expanded(child: Text(value == null || value.toString().isEmpty ? '—' : value.toString(), style: const TextStyle(color: FollowaColors.muted, fontSize: 10.5, fontWeight: FontWeight.w700))) ]));
}

class _Metric extends StatelessWidget {
  final String label; final int value;
  const _Metric({required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(11), decoration: BoxDecoration(color: FollowaColors.surface, borderRadius: BorderRadius.circular(15), border: Border.all(color: FollowaColors.border)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(Fa.num(value), style: const TextStyle(color: FollowaColors.brandSoft, fontSize: 20, fontWeight: FontWeight.w900)), const SizedBox(height: 3), Text(label, style: const TextStyle(color: FollowaColors.soft, fontSize: 8.5))]));
}
