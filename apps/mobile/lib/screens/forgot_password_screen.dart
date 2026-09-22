import 'package:flutter/material.dart';

import '../services/app_error.dart';
import '../services/auth_service.dart';
import '../theme/premium_theme.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _mobile = TextEditingController();
  final _code = TextEditingController();
  final _password = TextEditingController();
  final _password2 = TextEditingController();
  var _step = 0;
  var _resetToken = '';
  var _busy = false;
  String? _error;

  @override
  void dispose() {
    _mobile.dispose();
    _code.dispose();
    _password.dispose();
    _password2.dispose();
    super.dispose();
  }

  Future<void> _continue() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final auth = AuthService.instance;
      if (_step == 0) {
        await auth.requestPasswordReset(_mobile.text.trim());
        if (mounted) setState(() => _step = 1);
      } else if (_step == 1) {
        _resetToken = await auth.verifyPasswordReset(
          _mobile.text.trim(),
          _code.text.trim(),
        );
        if (mounted) setState(() => _step = 2);
      } else {
        if (_password.text.length < 8) {
          throw const AppError('رمز عبور باید حداقل ۸ کاراکتر باشد.');
        }
        if (_password.text != _password2.text) {
          throw const AppError('تکرار رمز عبور مطابقت ندارد.');
        }
        await auth.resetPassword(
          _mobile.text.trim(),
          _resetToken,
          _password.text,
        );
        if (mounted) setState(() => _step = 3);
      }
    } catch (error) {
      if (mounted) setState(() => _error = userMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const labels = ['شماره موبایل', 'کد تأیید', 'رمز جدید'];
    return Scaffold(
      appBar: AppBar(title: const Text('بازیابی رمز عبور')),
      body: SafeArea(
        top: false,
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: FollowaColors.surface,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: FollowaColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'بازیابی امن حساب',
                      style: TextStyle(
                        color: FollowaColors.ink,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'کد یکبارمصرف را دریافت کنید و رمز جدید بسازید.',
                      style:
                          TextStyle(color: FollowaColors.muted, fontSize: 10.5),
                    ),
                    const SizedBox(height: 18),
                    if (_step < 3)
                      Row(
                        children: [
                          for (var index = 0; index < labels.length; index++)
                            Expanded(
                              child: Column(
                                children: [
                                  Icon(
                                    index < _step
                                        ? Icons.check_circle_rounded
                                        : Icons.circle_outlined,
                                    color: index <= _step
                                        ? FollowaColors.brandSoft
                                        : FollowaColors.soft,
                                    size: 20,
                                  ),
                                  const SizedBox(height: 5),
                                  Text(
                                    labels[index],
                                    style: TextStyle(
                                      color: index <= _step
                                          ? FollowaColors.muted
                                          : FollowaColors.soft,
                                      fontSize: 8.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    const SizedBox(height: 20),
                    if (_step == 0)
                      TextField(
                        controller: _mobile,
                        keyboardType: TextInputType.phone,
                        textDirection: TextDirection.ltr,
                        decoration: const InputDecoration(
                          labelText: 'شماره موبایل',
                          hintText: '09123456789',
                        ),
                      )
                    else if (_step == 1) ...[
                      const Text(
                        'در صورت وجود حساب، کد بازیابی ارسال شده است.',
                        style:
                            TextStyle(color: FollowaColors.soft, fontSize: 10),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _code,
                        keyboardType: TextInputType.number,
                        textDirection: TextDirection.ltr,
                        maxLength: 6,
                        decoration:
                            const InputDecoration(labelText: 'کد تأیید'),
                      ),
                    ] else if (_step == 2) ...[
                      TextField(
                        controller: _password,
                        obscureText: true,
                        textDirection: TextDirection.ltr,
                        decoration:
                            const InputDecoration(labelText: 'رمز عبور جدید'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _password2,
                        obscureText: true,
                        textDirection: TextDirection.ltr,
                        onSubmitted: (_) => _continue(),
                        decoration:
                            const InputDecoration(labelText: 'تکرار رمز عبور'),
                      ),
                    ] else ...[
                      const Icon(
                        Icons.check_circle_rounded,
                        color: FollowaColors.emerald,
                        size: 52,
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'رمز عبور با موفقیت تغییر کرد.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: FollowaColors.ink,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(
                        _error!,
                        style: const TextStyle(
                            color: Color(0xFFFCA5A5), fontSize: 10.5),
                      ),
                    ],
                    const SizedBox(height: 18),
                    if (_step < 3)
                      FilledButton(
                        onPressed: _busy ? null : _continue,
                        child: Text(_busy ? 'در حال پردازش…' : 'ادامه'),
                      )
                    else
                      FilledButton(
                        onPressed: () => Navigator.of(context).pop(),
                        child: const Text('بازگشت به ورود'),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
