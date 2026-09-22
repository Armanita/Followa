import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
import '../utils/jalali_input.dart';
import '../widgets/common.dart';
import 'login_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _profile;
  Uint8List? _photo;
  String? _error;
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response =
          await AuthService.instance.get('/profile') as Map<String, dynamic>;
      Uint8List? photo;
      final user = response['user'] as Map<String, dynamic>;
      if (user['hasPersonnelPhoto'] == true) {
        try {
          photo = (await AuthService.instance.download('/profile/photo')).bytes;
        } catch (_) {}
      }
      if (mounted) {
        setState(() {
          _profile = response;
          _photo = photo;
        });
      }
    } catch (error) {
      if (mounted) setState(() => _error = userMessage(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _edit() async {
    final profile = _profile!;
    final user = profile['user'] as Map<String, dynamic>;
    final locked =
        profile['role'] == 'EMPLOYEE' && user['profileFinalizedAt'] != null;
    if (locked) {
      _message('اطلاعات ثبت نهایی شده و فقط مدیر می‌تواند آن را تغییر دهد');
      return;
    }

    final first =
        TextEditingController(text: user['firstName']?.toString() ?? '');
    final last =
        TextEditingController(text: user['lastName']?.toString() ?? '');
    final nationalId =
        TextEditingController(text: user['nationalId']?.toString() ?? '');
    final birthDate = TextEditingController(
        text: user['birthDate'] == null
            ? ''
            : JalaliInput.format(DateTime.parse(user['birthDate'].toString())));
    final phone = TextEditingController(text: user['phone']?.toString() ?? '');
    final address =
        TextEditingController(text: user['address']?.toString() ?? '');
    var marital = user['maritalStatus']?.toString();
    final card =
        TextEditingController(text: user['bankCardNumber']?.toString() ?? '');
    final iban =
        TextEditingController(text: user['bankIban']?.toString() ?? '');
    final bank =
        TextEditingController(text: user['bankName']?.toString() ?? '');
    var saving = false;

    final saved = await showDialog<bool>(
        context: context,
        builder: (ctx) => StatefulBuilder(
            builder: (ctx, setD) => AlertDialog(
                  title: const Text('ویرایش اطلاعات پرسنلی'),
                  content: SizedBox(
                      width: 520,
                      child: SingleChildScrollView(
                          child:
                              Column(mainAxisSize: MainAxisSize.min, children: [
                        Row(children: [
                          Expanded(
                              child: TextField(
                                  controller: first,
                                  decoration: const InputDecoration(
                                      labelText: 'نام *'))),
                          const SizedBox(width: 8),
                          Expanded(
                              child: TextField(
                                  controller: last,
                                  decoration: const InputDecoration(
                                      labelText: 'نام خانوادگی *')))
                        ]),
                        const SizedBox(height: 9),
                        TextField(
                            controller: nationalId,
                            textDirection: TextDirection.ltr,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                                labelText: 'کد ملی', hintText: '۱۰ رقم')),
                        const SizedBox(height: 9),
                        TextField(
                            controller: birthDate,
                            textDirection: TextDirection.ltr,
                            decoration: const InputDecoration(
                                labelText: 'تاریخ تولد شمسی',
                                hintText: '۱۳۷۰/۰۱/۰۱')),
                        const SizedBox(height: 9),
                        TextField(
                            controller: phone,
                            textDirection: TextDirection.ltr,
                            decoration:
                                const InputDecoration(labelText: 'تلفن')),
                        const SizedBox(height: 9),
                        TextField(
                            controller: address,
                            maxLines: 2,
                            decoration:
                                const InputDecoration(labelText: 'آدرس')),
                        const SizedBox(height: 9),
                        DropdownButtonFormField<String>(
                            initialValue: marital,
                            decoration:
                                const InputDecoration(labelText: 'وضعیت تأهل'),
                            items: const [
                              DropdownMenuItem(
                                  value: null, child: Text('— انتخاب نشده —')),
                              DropdownMenuItem(
                                  value: 'SINGLE', child: Text('مجرد')),
                              DropdownMenuItem(
                                  value: 'MARRIED', child: Text('متأهل'))
                            ],
                            onChanged: (v) => setD(() => marital = v)),
                        const SizedBox(height: 9),
                        TextField(
                            controller: card,
                            textDirection: TextDirection.ltr,
                            keyboardType: TextInputType.number,
                            decoration:
                                const InputDecoration(labelText: 'شماره کارت')),
                        const SizedBox(height: 9),
                        TextField(
                            controller: iban,
                            textDirection: TextDirection.ltr,
                            decoration:
                                const InputDecoration(labelText: 'شماره شبا')),
                        const SizedBox(height: 9),
                        TextField(
                            controller: bank,
                            decoration:
                                const InputDecoration(labelText: 'نام بانک')),
                      ]))),
                  actions: [
                    TextButton(
                        onPressed:
                            saving ? null : () => Navigator.pop(ctx, false),
                        child: const Text('انصراف')),
                    FilledButton(
                        onPressed: saving
                            ? null
                            : () async {
                                setD(() => saving = true);
                                try {
                                  String? birthIso;
                                  if (birthDate.text.trim().isNotEmpty) {
                                    birthIso = JalaliInput.parseDateTime(
                                            birthDate.text, '00:00')
                                        .toIso8601String();
                                  }
                                  await AuthService.instance.patch('/profile', {
                                    'firstName': first.text.trim(),
                                    'lastName': last.text.trim(),
                                    'nationalId': nationalId.text.trim().isEmpty
                                        ? null
                                        : JalaliInput.normalizeDigits(
                                            nationalId.text),
                                    'birthDate': birthIso,
                                    'phone': phone.text.trim().isEmpty
                                        ? null
                                        : phone.text.trim(),
                                    'address': address.text.trim().isEmpty
                                        ? null
                                        : address.text.trim(),
                                    'maritalStatus': marital,
                                    'bankCardNumber': card.text.trim().isEmpty
                                        ? null
                                        : JalaliInput.normalizeDigits(
                                            card.text),
                                    'bankIban': iban.text.trim().isEmpty
                                        ? null
                                        : iban.text.trim(),
                                    'bankName': bank.text.trim().isEmpty
                                        ? null
                                        : bank.text.trim(),
                                  });
                                  if (ctx.mounted) Navigator.pop(ctx, true);
                                } catch (error) {
                                  if (ctx.mounted) {
                                    ScaffoldMessenger.of(ctx).showSnackBar(
                                        SnackBar(
                                            content: Text(userMessage(error))));
                                  }
                                  setD(() => saving = false);
                                }
                              },
                        child: Text(saving ? 'در حال ذخیره…' : 'ذخیره')),
                  ],
                )));
    first.dispose();
    last.dispose();
    nationalId.dispose();
    birthDate.dispose();
    phone.dispose();
    address.dispose();
    card.dispose();
    iban.dispose();
    bank.dispose();
    if (saved == true) await _load();
  }

  Future<void> _uploadPhoto() async {
    final user = _profile!['user'] as Map<String, dynamic>;
    final locked =
        _profile!['role'] == 'EMPLOYEE' && user['profileFinalizedAt'] != null;
    if (locked) {
      _message('پس از ثبت نهایی، تغییر عکس فقط توسط مدیر انجام می‌شود');
      return;
    }
    try {
      final file = await FilePicker.pickFile(type: FileType.image);
      if (file == null) return;
      final bytes = await file.readAsBytes();
      setState(() => _busy = true);
      await AuthService.instance.uploadBytes('/profile/photo',
          fieldName: 'file', filename: file.name, bytes: bytes);
      await _load();
      _message('عکس پرسنلی به‌روزرسانی شد');
    } catch (error) {
      _message(userMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _finalize() async {
    final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
                title: const Text('ثبت نهایی اطلاعات'),
                content: const Text(
                    'پس از ثبت نهایی، تغییر اطلاعات و عکس توسط کارمند قفل می‌شود و فقط مدیر قادر به ویرایش خواهد بود.'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text('انصراف')),
                  FilledButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      child: const Text('ثبت نهایی'))
                ]));
    if (ok != true) return;
    try {
      setState(() => _busy = true);
      await AuthService.instance.post('/profile/finalize');
      await _load();
      _message('اطلاعات پرسنلی ثبت نهایی شد');
    } catch (error) {
      _message(userMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _changePassword() async {
    final current = TextEditingController();
    final password = TextEditingController();
    final confirmation = TextEditingController();
    var saving = false;
    final changed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('تغییر رمز عبور'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: current,
                obscureText: true,
                textDirection: TextDirection.ltr,
                decoration: const InputDecoration(labelText: 'رمز عبور فعلی'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: password,
                obscureText: true,
                textDirection: TextDirection.ltr,
                decoration: const InputDecoration(labelText: 'رمز عبور جدید'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: confirmation,
                obscureText: true,
                textDirection: TextDirection.ltr,
                decoration: const InputDecoration(
                  labelText: 'تکرار رمز عبور جدید',
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'رمز عبور جدید باید حداقل ۸ کاراکتر باشد.',
                style: TextStyle(color: FollowaColors.soft, fontSize: 9.5),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: saving ? null : () => Navigator.pop(ctx, false),
              child: const Text('انصراف'),
            ),
            FilledButton(
              onPressed: saving
                  ? null
                  : () async {
                      if (current.text.isEmpty || password.text.length < 8) {
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(
                            content:
                                Text('رمزهای عبور را کامل و صحیح وارد کنید.'),
                          ),
                        );
                        return;
                      }
                      if (password.text != confirmation.text) {
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          const SnackBar(
                            content: Text('تکرار رمز عبور جدید مطابقت ندارد.'),
                          ),
                        );
                        return;
                      }
                      setDialogState(() => saving = true);
                      try {
                        await AuthService.instance.changePassword(
                          current.text,
                          password.text,
                        );
                        if (ctx.mounted) Navigator.pop(ctx, true);
                      } catch (error) {
                        if (ctx.mounted) {
                          ScaffoldMessenger.of(ctx).showSnackBar(
                            SnackBar(content: Text(userMessage(error))),
                          );
                          setDialogState(() => saving = false);
                        }
                      }
                    },
              child: Text(saving ? 'در حال ثبت…' : 'تغییر رمز'),
            ),
          ],
        ),
      ),
    );
    current.dispose();
    password.dispose();
    confirmation.dispose();
    if (changed == true) _message('رمز عبور تغییر کرد.');
  }

  Future<void> _logout() async {
    await AuthService.instance.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _profile == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_profile == null) {
      return Scaffold(
          appBar: AppBar(title: const Text('پروفایل')),
          body: ErrorState(
              message: _error ?? 'پروفایل در دسترس نیست', onRetry: _load));
    }
    final p = _profile!;
    final u = p['user'] as Map<String, dynamic>;
    final employee = p['role'] == 'EMPLOYEE';
    final finalized = u['profileFinalizedAt'] != null;
    final fullName = '${u['firstName'] ?? ''} ${u['lastName'] ?? ''}'.trim();

    return Scaffold(
      appBar: AppBar(title: const Text('پروفایل')),
      body: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 36),
              children: [
                PremiumPanel(
                    child: Column(children: [
                  Stack(children: [
                    CircleAvatar(
                        radius: 46,
                        backgroundColor: FollowaColors.elevated,
                        backgroundImage:
                            _photo == null ? null : MemoryImage(_photo!),
                        child: _photo == null
                            ? Text(
                                fullName.isEmpty
                                    ? '؟'
                                    : fullName.substring(0, 1),
                                style: const TextStyle(
                                    color: FollowaColors.brandSoft,
                                    fontSize: 25,
                                    fontWeight: FontWeight.w900))
                            : null),
                    Positioned(
                        bottom: 0,
                        left: 0,
                        child: IconButton.filledTonal(
                            onPressed: _busy ? null : _uploadPhoto,
                            icon: const Icon(Icons.camera_alt_outlined,
                                size: 17))),
                  ]),
                  const SizedBox(height: 11),
                  Text(fullName,
                      style: const TextStyle(
                          color: FollowaColors.ink,
                          fontSize: 17,
                          fontWeight: FontWeight.w900)),
                  Text(
                      p['role'] == 'COMPANY_MANAGER'
                          ? 'مدیر شرکت'
                          : (p['jobTitle'] ?? 'کارمند').toString(),
                      style: const TextStyle(
                          color: FollowaColors.soft, fontSize: 10)),
                  if (employee) ...[
                    const SizedBox(height: 8),
                    Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                            color: finalized
                                ? FollowaColors.emerald.withValues(alpha: .08)
                                : FollowaColors.amber.withValues(alpha: .08),
                            borderRadius: BorderRadius.circular(99),
                            border: Border.all(
                                color: finalized
                                    ? FollowaColors.emerald
                                        .withValues(alpha: .20)
                                    : FollowaColors.amber
                                        .withValues(alpha: .20))),
                        child: Text(
                            finalized
                                ? 'اطلاعات ثبت نهایی شده'
                                : 'در حال تکمیل',
                            style: TextStyle(
                                color: finalized
                                    ? const Color(0xFF86EFAC)
                                    : const Color(0xFFFDE68A),
                                fontSize: 9.5,
                                fontWeight: FontWeight.w800)))
                  ],
                ])),
                const SizedBox(height: 11),
                PremiumPanel(
                    child: Column(children: [
                  _row('موبایل', u['mobile']),
                  _row('کد ملی', u['nationalId']),
                  _row(
                      'تاریخ تولد',
                      u['birthDate'] == null
                          ? null
                          : Fa.date(DateTime.parse(u['birthDate'].toString()))),
                  _row('تلفن', u['phone']),
                  _row('آدرس', u['address']),
                  _row(
                      'تأهل',
                      u['maritalStatus'] == 'MARRIED'
                          ? 'متأهل'
                          : u['maritalStatus'] == 'SINGLE'
                              ? 'مجرد'
                              : null),
                  _row('شماره کارت', u['bankCardNumber']),
                  _row('شماره شبا', u['bankIban']),
                  _row('بانک', u['bankName']),
                  _row('شرکت', p['company']?['name']),
                  _row('کد پرسنلی', p['employeeCode']),
                ])),
                const SizedBox(height: 11),
                FilledButton.icon(
                    onPressed: _busy || (employee && finalized) ? null : _edit,
                    icon: const Icon(Icons.edit_outlined),
                    label: Text(employee && finalized
                        ? 'پروفایل قفل شده است'
                        : 'ویرایش اطلاعات')),
                if (employee && !finalized) ...[
                  const SizedBox(height: 8),
                  OutlinedButton.icon(
                      onPressed: _busy ? null : _finalize,
                      icon: const Icon(Icons.lock_outline_rounded),
                      label: const Text('ثبت نهایی و قفل پروفایل'))
                ],
                const SizedBox(height: 8),
                OutlinedButton.icon(
                    onPressed: _busy ? null : _changePassword,
                    icon: const Icon(Icons.password_rounded),
                    label: const Text('تغییر رمز عبور')),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                    onPressed: _logout,
                    icon: const Icon(Icons.logout_rounded),
                    label: const Text('خروج از حساب'),
                    style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFFCA5A5),
                        side: const BorderSide(color: Color(0x44F87171)))),
              ])),
    );
  }

  Widget _row(String label, Object? value) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
            width: 92,
            child: Text(label,
                style:
                    const TextStyle(color: FollowaColors.soft, fontSize: 10))),
        Expanded(
            child: Text(
                value == null || value.toString().trim().isEmpty
                    ? '—'
                    : value.toString(),
                style: const TextStyle(
                    color: FollowaColors.muted,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w700)))
      ]));
  void _message(String text) {
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
    }
  }
}
