import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
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
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AuthService.instance.login(_mobile.text.trim(), _password.text);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeShell()),
      );
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const Positioned.fill(child: _AuthBackground()),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 28, 20, 32),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 480),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const _BrandLockup(),
                      const SizedBox(height: 28),
                      _AuthCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const Text(
                              'ورود به فضای کاری',
                              style: TextStyle(
                                color: FollowaColors.ink,
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 5),
                            const Text(
                              'اطلاعات حساب سازمانی خود را وارد کنید.',
                              style: TextStyle(
                                color: FollowaColors.soft,
                                fontSize: 11.5,
                                height: 1.7,
                              ),
                            ),
                            const SizedBox(height: 20),
                            TextField(
                              controller: _mobile,
                              keyboardType: TextInputType.phone,
                              textAlign: TextAlign.left,
                              textDirection: TextDirection.ltr,
                              decoration: const InputDecoration(
                                labelText: 'شماره موبایل',
                                hintText: '09123456789',
                                prefixIcon: Icon(Icons.phone_iphone_rounded, size: 19),
                              ),
                            ),
                            const SizedBox(height: 14),
                            TextField(
                              controller: _password,
                              obscureText: _obscure,
                              textDirection: TextDirection.ltr,
                              onSubmitted: (_) {
                                if (!_busy) {
                                  _submit();
                                }
                              },
                              decoration: InputDecoration(
                                labelText: 'رمز عبور',
                                prefixIcon: const Icon(Icons.lock_outline_rounded, size: 19),
                                suffixIcon: IconButton(
                                  onPressed: () => setState(() => _obscure = !_obscure),
                                  icon: Icon(
                                    _obscure
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                    size: 19,
                                  ),
                                ),
                              ),
                            ),
                            if (_error != null) ...[
                              const SizedBox(height: 14),
                              _ErrorBanner(message: _error!),
                            ],
                            const SizedBox(height: 18),
                            FilledButton.icon(
                              onPressed: _busy ? null : _submit,
                              icon: _busy
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    )
                                  : const Icon(Icons.arrow_back_rounded, size: 19),
                              label: Text(_busy ? 'در حال ورود…' : 'ورود به فالوآ'),
                            ),
                            const SizedBox(height: 6),
                            TextButton(
                              onPressed: _busy
                                  ? null
                                  : () async {
                                      await Navigator.of(context).push(
                                        MaterialPageRoute(
                                          builder: (_) => const OtpScreen(),
                                        ),
                                      );
                                    },
                              child: const Text('ثبت‌نام یا تعیین رمز با کد یکبارمصرف'),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),
                      const Text(
                        'مدیریت پیگیری، مسئولیت و گردش کار در یک فضای عملیاتی واحد',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: FollowaColors.soft,
                          fontSize: 10.5,
                          height: 1.7,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
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
  int _step = 0;
  final _mobile = TextEditingController();
  final _code = TextEditingController();
  final _password = TextEditingController();
  final _password2 = TextEditingController();
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
          throw ApiException('تکرار رمز عبور مطابقت ندارد');
        }
        await auth.createPassword(
          _mobile.text.trim(),
          _resetToken,
          _password.text,
        );
        if (!mounted) return;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const HomeShell()),
        );
      }
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    const titles = ['شماره موبایل', 'تأیید هویت', 'ساخت رمز عبور'];
    const descriptions = [
      'شماره‌ای را وارد کنید که مدیر شرکت برای شما ثبت کرده است.',
      'کد شش رقمی ارسال‌شده را وارد کنید.',
      'برای ورودهای بعدی یک رمز امن تعیین کنید.',
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('فعال‌سازی حساب'),
        leading: IconButton(
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.arrow_forward_rounded),
        ),
      ),
      body: Stack(
        children: [
          const Positioned.fill(child: _AuthBackground()),
          SafeArea(
            top: false,
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 18, 20, 32),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 480),
                  child: _AuthCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        _StepRail(step: _step),
                        const SizedBox(height: 22),
                        Text(
                          titles[_step],
                          style: const TextStyle(
                            color: FollowaColors.ink,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          descriptions[_step],
                          style: const TextStyle(
                            color: FollowaColors.soft,
                            fontSize: 11.5,
                            height: 1.7,
                          ),
                        ),
                        const SizedBox(height: 18),
                        if (_step == 0)
                          TextField(
                            controller: _mobile,
                            keyboardType: TextInputType.phone,
                            textDirection: TextDirection.ltr,
                            textAlign: TextAlign.left,
                            decoration: const InputDecoration(
                              labelText: 'شماره موبایل',
                              prefixIcon: Icon(Icons.phone_iphone_rounded, size: 19),
                            ),
                          ),
                        if (_step == 1)
                          TextField(
                            controller: _code,
                            keyboardType: TextInputType.number,
                            maxLength: 6,
                            textDirection: TextDirection.ltr,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              letterSpacing: 8,
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                            ),
                            decoration: const InputDecoration(
                              counterText: '',
                              labelText: 'کد تأیید',
                            ),
                          ),
                        if (_step == 2) ...[
                          TextField(
                            controller: _password,
                            obscureText: true,
                            textDirection: TextDirection.ltr,
                            decoration: const InputDecoration(
                              labelText: 'رمز عبور جدید',
                              prefixIcon: Icon(Icons.lock_outline_rounded, size: 19),
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _password2,
                            obscureText: true,
                            textDirection: TextDirection.ltr,
                            decoration: const InputDecoration(
                              labelText: 'تکرار رمز عبور',
                              prefixIcon: Icon(Icons.lock_reset_rounded, size: 19),
                            ),
                          ),
                        ],
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          _ErrorBanner(message: _error!),
                        ],
                        const SizedBox(height: 18),
                        FilledButton(
                          onPressed: _busy ? null : _next,
                          child: Text(
                            _busy
                                ? 'لطفاً صبر کنید…'
                                : (_step == 0
                                    ? 'ارسال کد'
                                    : (_step == 1
                                        ? 'تأیید و ادامه'
                                        : 'ساخت رمز و ورود')),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AuthCard extends StatelessWidget {
  final Widget child;
  const _AuthCard({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: FollowaColors.surface.withOpacity(.97),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: FollowaColors.border),
        boxShadow: const [
          BoxShadow(
            color: Color(0x55000000),
            blurRadius: 40,
            offset: Offset(0, 20),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  final String message;
  const _ErrorBanner({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
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
              message,
              style: const TextStyle(
                color: Color(0xFFFCA5A5),
                fontSize: 11.5,
                height: 1.6,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BrandLockup extends StatelessWidget {
  const _BrandLockup();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 70,
          height: 70,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF8B5CF6), Color(0xFF6D28D9)],
              begin: Alignment.topRight,
              end: Alignment.bottomLeft,
            ),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: FollowaColors.brandSoft.withOpacity(.30)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x557C3AED),
                blurRadius: 28,
                offset: Offset(0, 12),
              ),
            ],
          ),
          alignment: Alignment.center,
          child: const Text(
            'ف',
            style: TextStyle(
              color: Colors.white,
              fontSize: 32,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        const SizedBox(height: 14),
        const Text(
          'فالوآ',
          style: TextStyle(
            color: FollowaColors.ink,
            fontSize: 26,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'مدیریت پیگیری و گردش کار',
          style: TextStyle(
            color: FollowaColors.muted,
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _StepRail extends StatelessWidget {
  final int step;
  const _StepRail({required this.step});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(3, (index) {
        final active = index <= step;
        return Expanded(
          child: Row(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: active
                      ? FollowaColors.brand.withOpacity(.18)
                      : FollowaColors.elevated,
                  borderRadius: BorderRadius.circular(9),
                  border: Border.all(
                    color: active
                        ? FollowaColors.brandSoft.withOpacity(.35)
                        : FollowaColors.border,
                  ),
                ),
                alignment: Alignment.center,
                child: Text(
                  ['۱', '۲', '۳'][index],
                  style: TextStyle(
                    color: active ? FollowaColors.brandSoft : FollowaColors.soft,
                    fontWeight: FontWeight.w900,
                    fontSize: 11,
                  ),
                ),
              ),
              if (index < 2)
                Expanded(
                  child: Container(
                    height: 1,
                    margin: const EdgeInsets.symmetric(horizontal: 6),
                    color: index < step
                        ? FollowaColors.brand.withOpacity(.45)
                        : FollowaColors.border,
                  ),
                ),
            ],
          ),
        );
      }),
    );
  }
}

class _AuthBackground extends StatelessWidget {
  const _AuthBackground();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        color: FollowaColors.shell,
        gradient: RadialGradient(
          center: Alignment(0.75, -0.75),
          radius: 1.25,
          colors: [Color(0x332E1065), FollowaColors.shell],
        ),
      ),
      child: SizedBox.expand(),
    );
  }
}
