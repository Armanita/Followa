import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
import 'forgot_password_screen.dart';
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
  bool _obscure = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.autoSkipHome) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const HomeShell()),
        );
      });
    }
  }

  @override
  void dispose() {
    _mobile.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AuthService.instance.login(
        _mobile.text.trim(),
        _password.text,
      );
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeShell()),
      );
    } catch (error) {
      if (mounted) setState(() => _error = userMessage(error));
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
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                children: [
                  const _BrandHeader(
                    eyebrow: 'فضای عملیاتی سازمان',
                    title: 'فالوآ',
                    subtitle:
                        'مدیریت پرونده، مسئولیت و پیگیری در یک فضای کاری یکپارچه',
                  ),
                  const SizedBox(height: 26),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: FollowaColors.surface,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: FollowaColors.border),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x30000000),
                          blurRadius: 36,
                          offset: Offset(0, 18),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'ورود به فضای کاری',
                          style: TextStyle(
                            color: FollowaColors.ink,
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 5),
                        const Text(
                          'با شماره موبایل سازمانی و رمز عبور وارد شوید.',
                          style: TextStyle(
                            color: FollowaColors.muted,
                            fontSize: 10.5,
                            height: 1.6,
                          ),
                        ),
                        const SizedBox(height: 18),
                        TextField(
                          controller: _mobile,
                          keyboardType: TextInputType.phone,
                          textDirection: TextDirection.ltr,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                            labelText: 'شماره موبایل',
                            hintText: '09123456789',
                            prefixIcon: Icon(
                              Icons.phone_iphone_rounded,
                              size: 19,
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),
                        TextField(
                          controller: _password,
                          obscureText: _obscure,
                          textDirection: TextDirection.ltr,
                          onSubmitted: (_) {
                            if (!_busy) _submit();
                          },
                          decoration: InputDecoration(
                            labelText: 'رمز عبور',
                            prefixIcon: const Icon(
                              Icons.lock_outline_rounded,
                              size: 19,
                            ),
                            suffixIcon: IconButton(
                              tooltip:
                                  _obscure ? 'نمایش رمز' : 'پنهان کردن رمز',
                              onPressed: () =>
                                  setState(() => _obscure = !_obscure),
                              icon: Icon(
                                _obscure
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                              ),
                            ),
                          ),
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.all(11),
                            decoration: BoxDecoration(
                              color: FollowaColors.red.withValues(alpha: .07),
                              borderRadius: BorderRadius.circular(13),
                              border: Border.all(
                                color: FollowaColors.red.withValues(alpha: .18),
                              ),
                            ),
                            child: Text(
                              _error!,
                              style: const TextStyle(
                                color: Color(0xFFFCA5A5),
                                fontSize: 10.5,
                                height: 1.6,
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 18),
                        FilledButton.icon(
                          onPressed: _busy ? null : _submit,
                          icon: _busy
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.login_rounded, size: 19),
                          label: Text(_busy ? 'در حال ورود…' : 'ورود'),
                        ),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: _busy
                              ? null
                              : () => Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) => const OtpSignupScreen(),
                                    ),
                                  ),
                          child: const Text(
                            'ورود اول / تعیین رمز با کد یکبارمصرف',
                          ),
                        ),
                        TextButton(
                          onPressed: _busy
                              ? null
                              : () => Navigator.of(context).push(
                                    MaterialPageRoute(
                                      builder: (_) =>
                                          const ForgotPasswordScreen(),
                                    ),
                                  ),
                          child: const Text('رمز عبور را فراموش کرده‌اید؟'),
                        ),
                      ],
                    ),
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

class OtpSignupScreen extends StatefulWidget {
  const OtpSignupScreen({super.key});

  @override
  State<OtpSignupScreen> createState() => _OtpSignupScreenState();
}

class _OtpSignupScreenState extends State<OtpSignupScreen> {
  final _mobile = TextEditingController();
  final _code = TextEditingController();
  final _password = TextEditingController();
  final _password2 = TextEditingController();
  int _step = 0;
  String _resetToken = '';
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _mobile.dispose();
    _code.dispose();
    _password.dispose();
    _password2.dispose();
    super.dispose();
  }

  Future<void> _next() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final auth = AuthService.instance;
      if (_step == 0) {
        await auth.requestOtp(_mobile.text.trim());
        if (mounted) setState(() => _step = 1);
      } else if (_step == 1) {
        _resetToken = await auth.verifyOtp(
          _mobile.text.trim(),
          _code.text.trim(),
        );
        if (mounted) setState(() => _step = 2);
      } else {
        if (_password.text != _password2.text) {
          throw const ApiException(
            statusCode: 400,
            code: 'PASSWORD_MISMATCH',
            message: 'تکرار رمز عبور مطابقت ندارد',
          );
        }
        await auth.createPassword(
          _mobile.text.trim(),
          _resetToken,
          _password.text,
        );
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const HomeShell()),
          (_) => false,
        );
      }
    } catch (error) {
      if (mounted) setState(() => _error = userMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final labels = ['دریافت کد', 'تأیید کد', 'تعیین رمز'];
    return Scaffold(
      appBar: AppBar(title: const Text('فعال‌سازی حساب')),
      body: SafeArea(
        top: false,
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _BrandHeader(
                    eyebrow: 'فعال‌سازی امن حساب',
                    title: 'ورود اول',
                    subtitle:
                        'شماره موبایل را تأیید کنید و رمز شخصی خود را بسازید.',
                    compact: true,
                  ),
                  const SizedBox(height: 18),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: FollowaColors.surface,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: FollowaColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          children: [
                            for (var index = 0; index < labels.length; index++)
                              Expanded(
                                child: _StepIndicator(
                                  label: labels[index],
                                  active: index == _step,
                                  complete: index < _step,
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
                              prefixIcon: Icon(Icons.phone_iphone_rounded),
                            ),
                          )
                        else if (_step == 1)
                          TextField(
                            controller: _code,
                            keyboardType: TextInputType.number,
                            textDirection: TextDirection.ltr,
                            decoration: const InputDecoration(
                              labelText: 'کد یکبارمصرف',
                              prefixIcon: Icon(Icons.password_rounded),
                            ),
                          )
                        else ...[
                          TextField(
                            controller: _password,
                            obscureText: true,
                            textDirection: TextDirection.ltr,
                            decoration: const InputDecoration(
                              labelText: 'رمز عبور جدید',
                              prefixIcon: Icon(Icons.lock_outline_rounded),
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _password2,
                            obscureText: true,
                            textDirection: TextDirection.ltr,
                            onSubmitted: (_) => _next(),
                            decoration: const InputDecoration(
                              labelText: 'تکرار رمز عبور',
                              prefixIcon: Icon(Icons.lock_reset_rounded),
                            ),
                          ),
                        ],
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          Text(
                            _error!,
                            style: const TextStyle(
                              color: Color(0xFFFCA5A5),
                              fontSize: 10.5,
                            ),
                          ),
                        ],
                        const SizedBox(height: 18),
                        FilledButton(
                          onPressed: _busy ? null : _next,
                          child: Text(
                            _busy
                                ? 'در حال پردازش…'
                                : _step == 0
                                    ? 'ارسال کد'
                                    : _step == 1
                                        ? 'تأیید کد'
                                        : 'ثبت رمز و ورود',
                          ),
                        ),
                      ],
                    ),
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

class _BrandHeader extends StatelessWidget {
  final String eyebrow;
  final String title;
  final String subtitle;
  final bool compact;

  const _BrandHeader({
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: compact ? 48 : 56,
          height: compact ? 48 : 56,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [FollowaColors.brand, Color(0xFF5B21B6)],
              begin: Alignment.topRight,
              end: Alignment.bottomLeft,
            ),
            borderRadius: BorderRadius.circular(18),
            boxShadow: [
              BoxShadow(
                color: FollowaColors.brand.withValues(alpha: .28),
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Text(
            'ف',
            style: TextStyle(
              color: Colors.white,
              fontSize: compact ? 19 : 22,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        const SizedBox(width: 13),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                eyebrow,
                style: const TextStyle(
                  color: FollowaColors.brandSoft,
                  fontSize: 9.5,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                title,
                style: TextStyle(
                  color: FollowaColors.ink,
                  fontSize: compact ? 21 : 27,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: const TextStyle(
                  color: FollowaColors.muted,
                  fontSize: 10.5,
                  height: 1.6,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StepIndicator extends StatelessWidget {
  final String label;
  final bool active;
  final bool complete;

  const _StepIndicator({
    required this.label,
    required this.active,
    required this.complete,
  });

  @override
  Widget build(BuildContext context) {
    final color = complete
        ? FollowaColors.emerald
        : active
            ? FollowaColors.brandSoft
            : FollowaColors.soft;
    return Column(
      children: [
        Container(
          width: 30,
          height: 30,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: color.withValues(alpha: .10),
            shape: BoxShape.circle,
            border: Border.all(color: color.withValues(alpha: .26)),
          ),
          child: Icon(
            complete ? Icons.check_rounded : Icons.circle,
            color: color,
            size: complete ? 16 : 8,
          ),
        ),
        const SizedBox(height: 5),
        Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 8.5,
            fontWeight: active || complete ? FontWeight.w800 : FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
