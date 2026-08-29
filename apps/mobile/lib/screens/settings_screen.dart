import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
import '../widgets/common.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  Map<String, dynamic>? _company;
  String? _error;
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final response = await AuthService.instance.get('/companies/current');
      if (mounted) setState(() => _company = response as Map<String, dynamic>);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _addType() async {
    final name = TextEditingController();
    var color = '#7c4dff';
    final ok = await showDialog<bool>(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, setD) => AlertDialog(
      title: const Text('نوع پرونده جدید'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: name, autofocus: true, decoration: const InputDecoration(labelText: 'نام نوع پرونده')),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(initialValue: color, decoration: const InputDecoration(labelText: 'رنگ'), items: const [
          DropdownMenuItem(value: '#7c4dff', child: Text('بنفش')),
          DropdownMenuItem(value: '#2563eb', child: Text('آبی')),
          DropdownMenuItem(value: '#059669', child: Text('سبز')),
          DropdownMenuItem(value: '#d97706', child: Text('نارنجی')),
          DropdownMenuItem(value: '#dc2626', child: Text('قرمز')),
        ], onChanged: (v) => setD(() => color = v ?? color)),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('انصراف')), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('افزودن'))],
    )));
    final value = name.text.trim(); name.dispose();
    if (ok == true && value.length >= 2) {
      try { await AuthService.instance.post('/case-types', {'name': value, 'color': color}); await _load(); }
      catch (error) { _message(error.toString()); }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('تنظیمات')),
      body: RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 36), children: [
        if (_loading) const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator()))
        else if (_error != null) ErrorState(message: _error!, onRetry: _load)
        else if (_company != null) ...[
          PremiumPanel(child: Row(children: [
            Container(width: 48, height: 48, alignment: Alignment.center, decoration: BoxDecoration(color: FollowaColors.brand.withOpacity(.12), borderRadius: BorderRadius.circular(15), border: Border.all(color: FollowaColors.brandSoft.withOpacity(.20))), child: Text(_company!['name'].toString().substring(0, 1), style: const TextStyle(color: FollowaColors.brandSoft, fontWeight: FontWeight.w900))),
            const SizedBox(width: 11),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(_company!['name'].toString(), style: const TextStyle(color: FollowaColors.ink, fontWeight: FontWeight.w900, fontSize: 15)), const Text('شرکت جاری فالوآ', style: TextStyle(color: FollowaColors.soft, fontSize: 9.5))])),
          ])),
          const SizedBox(height: 12),
          PremiumPanel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('انواع پرونده', style: TextStyle(color: FollowaColors.ink, fontWeight: FontWeight.w900)), SizedBox(height: 3), Text('دسته‌بندی‌های قابل انتخاب هنگام ایجاد پرونده', style: TextStyle(color: FollowaColors.soft, fontSize: 9.5))])), FilledButton.tonalIcon(onPressed: _addType, icon: const Icon(Icons.add_rounded, size: 17), label: const Text('افزودن'))]),
            const SizedBox(height: 14),
            Wrap(spacing: 8, runSpacing: 8, children: [for (final raw in (_company!['caseTypes'] as List<dynamic>? ?? const [])) _TypeChip(type: raw as Map<String, dynamic>)]),
          ])),
        ],
      ])),
    );
  }

  void _message(String text) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text))); }
}

class _TypeChip extends StatelessWidget {
  final Map<String, dynamic> type;
  const _TypeChip({required this.type});
  Color _color() {
    final raw = type['color']?.toString();
    if (raw == null || !raw.startsWith('#') || raw.length != 7) return FollowaColors.soft;
    return Color(int.parse('FF${raw.substring(1)}', radix: 16));
  }
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8), decoration: BoxDecoration(color: FollowaColors.elevated, borderRadius: BorderRadius.circular(11), border: Border.all(color: FollowaColors.border)), child: Row(mainAxisSize: MainAxisSize.min, children: [Container(width: 8, height: 8, decoration: BoxDecoration(color: _color(), shape: BoxShape.circle)), const SizedBox(width: 7), Text(type['name'].toString(), style: const TextStyle(color: FollowaColors.muted, fontSize: 10.5, fontWeight: FontWeight.w700))]));
}
