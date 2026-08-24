import 'package:flutter/material.dart';
import '../main.dart';
import '../services/auth_service.dart';
import 'home_shell.dart';

class LoginScreen extends StatefulWidget {
  final bool autoSkipHome;
  const LoginScreen({super.key, this.autoSkipHome = false});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _mobile = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.autoSkipHome) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const HomeShell()),
        );
      });
    }
  }

  Future<void> _submit() async {
    setState(() { _busy = true; _error = null; });
    try {
      await AuthService.instance.login(_mobile.text.trim(), _password.text);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeShell()),
      );
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                Container(
                  width: 64, height: 64,
                  decoration: BoxDecoration(
                    color: const Color(0xFF2558EB),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  alignment: Alignment.center,
                  child: const Text('ف', style: TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w900)),
                ),
                const SizedBox(height: 14),
                const Text('فالوآ', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
                Text('سیستم پیگیری و گردش کار داخلی شرکت',
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                const SizedBox(height: 28),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        TextField(
                          controller: _mobile,
                          keyboardType: TextInputType.phone,
                          textAlign: TextAlign.left,
                          textDirection: TextDirection.ltr,
                          decoration: const InputDecoration(labelText: 'شماره موبایل', hintText: '09123456789'),
                        ),
                        const SizedBox(height: 14),
                        TextField(
                          controller: _password,
                          obscureText: true,
                          textDirection: TextDirection.ltr,
                          decoration: const InputDecoration(labelText: 'رمز عبور'),
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF2F2),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(_error!, style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 12.5)),
                          ),
                        ],
                        const SizedBox(height: 18),
                        FilledButton(
                          onPressed: _busy ? null : _submit,
                          child: Text(_busy ? 'در حال ورود…' : 'ورود'),
                        ),
                        const SizedBox(height: 6),
                        TextButton(
                          onPressed: () async {
                            await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const OtpScreen()));
                          },
                          child: const Text('ثبت‌نام / تعیین رمز با کد یکبارمصرف'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  int _step = 0; // 0 mobile, 1 code, 2 password
  final _mobile = TextEditingController();
  final _code = TextEditingController();
  final _password = TextEditingController();
  final _password2 = TextEditingController();
  String _resetToken = '';
  bool _busy = false;
  String? _error;

  Future<void> _next() async {
    setState(() { _busy = true; _error = null; });
    try {
      final auth = AuthService.instance;
      if (_step == 0) {
        await auth.requestOtp(_mobile.text.trim());
        setState(() => _step = 1);
      } else if (_step == 1) {
        _resetToken = await auth.verifyOtp(_mobile.text.trim(), _code.text.trim());
        setState(() => _step = 2);
      } else {
        if (_password.text != _password2.text) throw ApiException('تکرار رمز عبور مطابقت ندارد');
        await auth.createPassword(_mobile.text.trim(), _resetToken, _password.text);
        if (!mounted) return;
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const HomeShell()));
        return;
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const steps = ['شماره موبایل', 'کد تأیید', 'رمز عبور'];
    return Scaffold(
      appBar: AppBar(title: const Text('ثبت‌نام / تعیین رمز')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(children: List.generate(3, (i) => Expanded(child: Row(children: [
                    CircleAvatar(radius: 11, backgroundColor: i <= _step ? Theme.of(context).colorScheme.primary : Colors.grey.shade300,
                      child: Text('${i + 1}'.replaceAll('1', '۱').replaceAll('2', '۲').replaceAll('3', '۳'),
                        style: TextStyle(fontSize: 11, color: i <= _step ? Colors.white : Colors.grey.shade600)),),
                    if (i < 2) Expanded(child: Container(height: 1.5, color: Colors.grey.shade200)),
                  ])))),
                  const SizedBox(height: 18),
                  if (_step == 0) TextField(controller: _mobile, keyboardType: TextInputType.phone, textDirection: TextDirection.ltr,
                    decoration: const InputDecoration(labelText: 'شماره موبایل ثبت‌شده توسط مدیر')),
                  if (_step == 1) ...[
                    Text('کد ۶ رقمی پیامک‌شده را وارد کنید.', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                    const SizedBox(height: 12),
                    TextField(controller: _code, keyboardType: TextInputType.number, maxLength: 6, textDirection: TextDirection.ltr,
                      decoration: const InputDecoration(counterText: '', labelText: 'کد تأیید')),
                  ],
                  if (_step == 2) ...[
                    TextField(controller: _password, obscureText: true, textDirection: TextDirection.ltr,
                      decoration: const InputDecoration(labelText: 'رمز عبور جدید (حداقل ۸ کاراکتر)')),
                    const SizedBox(height: 12),
                    TextField(controller: _password2, obscureText: true, textDirection: TextDirection.ltr,
                      decoration: const InputDecoration(labelText: 'تکرار رمز عبور')),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 12.5)),
                  ],
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: _busy ? null : _next,
                    child: Text(_busy
                        ? 'لطفاً صبر کنید…'
                        : (_step == 0 ? 'ارسال کد' : (_step == 1 ? 'تأیید کد' : 'ساخت رمز و ورود'))),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
