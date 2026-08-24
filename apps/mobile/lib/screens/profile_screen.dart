import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../widgets/common.dart';
import 'login_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _profile;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final res = await AuthService.instance.get('/profile');
      setState(() => _profile = res as Map<String, dynamic>);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final u = _profile?['user'] as Map<String, dynamic>?;
    return Scaffold(
      appBar: AppBar(title: const Text('پروفایل')),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Card(child: Padding(padding: const EdgeInsets.all(18), child: Row(children: [
          CircleAvatar(radius: 28, backgroundColor: const Color(0xFF2558EB).withOpacity(0.1),
            child: Text(u != null ? '${u['firstName']}'[0] : '؟', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF2558EB)))),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${u?['firstName'] ?? ''} ${u?['lastName'] ?? ''}'.trim(), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17)),
            Text('${u?['mobile'] ?? ''}', style: TextStyle(color: Colors.grey.shade500, fontSize: 13)),
            Text(_profile?['role'] == 'COMPANY_MANAGER' ? 'مدیر شرکت' : 'کارمند',
                style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
          ])),
        ]))),
        if (_profile?['company'] != null)
          ListTile(leading: const Icon(Icons.business_outlined),
            title: Text('${_profile!['company']['name']}'),
            subtitle: Text('شرکت', style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500))),
        const SizedBox(height: 20),
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(foregroundColor: const Color(0xFFDC2626), side: const BorderSide(color: Color(0xFFFECACA)), minimumSize: const Size.fromHeight(48)),
          onPressed: () async {
            await AuthService.instance.logout();
            if (!mounted) return;
            Navigator.of(context).pushAndRemoveUntil(MaterialPageRoute(builder: (_) => const LoginScreen()), (r) => false);
          },
          icon: const Icon(Icons.logout), label: const Text('خروج از حساب')),
        const SizedBox(height: 10),
        Center(child: Text('فالوآ نسخه ۱.۰', style: TextStyle(fontSize: 11.5, color: Colors.grey.shade400))),
      ]),
    );
  }
}
