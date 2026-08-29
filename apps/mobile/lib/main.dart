import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'screens/login_screen.dart';
import 'services/auth_service.dart';
import 'theme/premium_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const FollowaApp());
}

class FollowaApp extends StatelessWidget {
  const FollowaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'فالوآ',
      debugShowCheckedModeBanner: false,
      theme: buildFollowaPremiumTheme(),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('fa'), Locale('en')],
      locale: const Locale('fa'),
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child!,
      ),
      home: const RootGate(),
    );
  }
}

class RootGate extends StatefulWidget {
  const RootGate({super.key});

  @override
  State<RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<RootGate> {
  bool? _loggedIn;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    final value = await AuthService.instance.restoreSession();
    if (mounted) setState(() => _loggedIn = value);
  }

  @override
  Widget build(BuildContext context) {
    if (_loggedIn == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    return LoginScreen(autoSkipHome: _loggedIn!);
  }
}
