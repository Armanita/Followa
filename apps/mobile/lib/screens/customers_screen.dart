import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
import '../widgets/common.dart';
import 'case_detail_screen.dart';

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  final _search = TextEditingController();
  List<dynamic> _items = [];
  bool _showArchived = false;
  bool _loading = true;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  @override
  void dispose() { _search.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final params = <String>['pageSize=100'];
      if (_search.text.trim().isNotEmpty) params.add('search=${Uri.encodeComponent(_search.text.trim())}');
      if (_showArchived) params.add('active=all');
      final response = await AuthService.instance.get('/customers?${params.join('&')}');
      if (mounted) setState(() => _items = response['items'] as List<dynamic>);
    } catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleArchive(Map<String, dynamic> customer) async {
    final active = customer['isActive'] == true;
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      title: Text(active ? 'بایگانی مشتری' : 'بازیابی مشتری'),
      content: Text(active ? 'پرونده‌های قبلی حفظ می‌شوند اما مشتری تا زمان بازیابی برای پرونده جدید قابل انتخاب نیست.' : 'مشتری دوباره برای اتصال به پرونده جدید فعال می‌شود.'),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('انصراف')), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(active ? 'بایگانی' : 'بازیابی'))],
    ));
    if (ok != true) return;
    try {
      await AuthService.instance.post('/customers/${customer['id']}/${active ? 'archive' : 'restore'}');
      await _load();
    } catch (error) { _message(error.toString()); }
  }

  Future<void> _form([Map<String, dynamic>? customer]) async {
    final type = ValueNotifier<String>(customer?['type']?.toString() ?? 'INDIVIDUAL');
    final name = TextEditingController(text: customer?['name']?.toString() ?? '');
    final mobile = TextEditingController(text: customer?['mobile']?.toString() ?? '');
    final phone = TextEditingController(text: customer?['phone']?.toString() ?? '');
    final nationalId = TextEditingController(text: customer?['nationalId']?.toString() ?? '');
    final economicCode = TextEditingController(text: customer?['economicCode']?.toString() ?? '');
    final email = TextEditingController(text: customer?['email']?.toString() ?? '');
    final address = TextEditingController(text: customer?['address']?.toString() ?? '');
    final notes = TextEditingController(text: customer?['notes']?.toString() ?? '');
    var busy = false;

    final saved = await showDialog<bool>(context: context, builder: (ctx) => StatefulBuilder(builder: (ctx, setD) => AlertDialog(
      title: Text(customer == null ? 'مشتری جدید' : 'ویرایش مشتری'),
      content: SizedBox(width: 520, child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        DropdownButtonFormField<String>(initialValue: type.value, decoration: const InputDecoration(labelText: 'نوع'), items: const [DropdownMenuItem(value: 'INDIVIDUAL', child: Text('شخص حقیقی')), DropdownMenuItem(value: 'LEGAL', child: Text('شخص حقوقی'))], onChanged: (v) { if (v != null) type.value = v; }),
        const SizedBox(height: 9),
        TextField(controller: name, decoration: const InputDecoration(labelText: 'نام *')),
        const SizedBox(height: 9),
        TextField(controller: mobile, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'موبایل')),
        const SizedBox(height: 9),
        TextField(controller: phone, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'تلفن')),
        const SizedBox(height: 9),
        TextField(controller: nationalId, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'کد/شناسه ملی')),
        const SizedBox(height: 9),
        TextField(controller: economicCode, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'کد اقتصادی')),
        const SizedBox(height: 9),
        TextField(controller: email, textDirection: TextDirection.ltr, decoration: const InputDecoration(labelText: 'ایمیل')),
        const SizedBox(height: 9),
        TextField(controller: address, maxLines: 2, decoration: const InputDecoration(labelText: 'آدرس')),
        const SizedBox(height: 9),
        TextField(controller: notes, maxLines: 2, decoration: const InputDecoration(labelText: 'یادداشت داخلی')),
      ]))),
      actions: [
        TextButton(onPressed: busy ? null : () => Navigator.pop(ctx, false), child: const Text('انصراف')),
        FilledButton(onPressed: busy || name.text.trim().length < 2 ? null : () async {
          setD(() => busy = true);
          final payload = {
            'type': type.value,
            'name': name.text.trim(),
            'mobile': mobile.text.trim().isEmpty ? null : mobile.text.trim(),
            'phone': phone.text.trim().isEmpty ? null : phone.text.trim(),
            'nationalId': nationalId.text.trim().isEmpty ? null : nationalId.text.trim(),
            'economicCode': economicCode.text.trim().isEmpty ? null : economicCode.text.trim(),
            'email': email.text.trim().isEmpty ? null : email.text.trim(),
            'address': address.text.trim().isEmpty ? null : address.text.trim(),
            'notes': notes.text.trim().isEmpty ? null : notes.text.trim(),
          };
          try {
            if (customer == null) { await AuthService.instance.post('/customers', payload); }
            else { await AuthService.instance.patch('/customers/${customer['id']}', payload); }
            if (ctx.mounted) Navigator.pop(ctx, true);
          } catch (error) {
            if (ctx.mounted) ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(error.toString())));
            setD(() => busy = false);
          }
        }, child: Text(busy ? 'در حال ذخیره…' : 'ذخیره')),
      ],
    )));
    type.dispose(); name.dispose(); mobile.dispose(); phone.dispose(); nationalId.dispose(); economicCode.dispose(); email.dispose(); address.dispose(); notes.dispose();
    if (saved == true) await _load();
  }

  Future<void> _history(Map<String, dynamic> customer) async {
    try {
      final response = await AuthService.instance.get('/customers/${customer['id']}/history');
      if (!mounted) return;
      final items = response['items'] as List<dynamic>? ?? const [];
      final summary = response['summary'] as Map<String, dynamic>? ?? const {};
      await showDialog<void>(context: context, builder: (ctx) => AlertDialog(
        title: Text('تاریخچه ${customer['name']}'),
        content: SizedBox(width: 520, child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(children: [Expanded(child: _HistoryMetric(label: 'کل', value: summary['totalCases'] ?? 0)), const SizedBox(width: 6), Expanded(child: _HistoryMetric(label: 'باز', value: summary['openCases'] ?? 0)), const SizedBox(width: 6), Expanded(child: _HistoryMetric(label: 'تکمیل', value: summary['doneCases'] ?? 0))]),
          const SizedBox(height: 12),
          Flexible(child: items.isEmpty ? const Padding(padding: EdgeInsets.all(20), child: Text('پرونده‌ای ثبت نشده است.')) : ListView.separated(shrinkWrap: true, itemCount: items.length, separatorBuilder: (_, __) => const Divider(), itemBuilder: (_, i) {
            final c = items[i] as Map<String, dynamic>;
            return ListTile(contentPadding: EdgeInsets.zero, title: Text(c['title'].toString(), style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text('#${Fa.num(c['number'])} · ${statusLabels[c['status']] ?? c['status']}'), onTap: () { Navigator.pop(ctx); Navigator.push(context, MaterialPageRoute(builder: (_) => CaseDetailScreen(caseId: c['id'].toString()))); });
          })),
        ])),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('بستن'))],
      ));
    } catch (error) { _message(error.toString()); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('مشتریان'), actions: [IconButton(onPressed: () => _form(), icon: const Icon(Icons.person_add_alt_1_rounded))]),
      body: RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 110), children: [
        PremiumPanel(child: Column(children: [
          TextField(controller: _search, textInputAction: TextInputAction.search, onSubmitted: (_) => _load(), decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'نام، موبایل یا شناسه…')),
          CheckboxListTile(contentPadding: EdgeInsets.zero, value: _showArchived, title: const Text('نمایش بایگانی‌شده‌ها', style: TextStyle(fontSize: 11.5)), onChanged: (v) { setState(() => _showArchived = v ?? false); _load(); }),
        ])),
        const SizedBox(height: 12),
        if (_loading) const Padding(padding: EdgeInsets.all(36), child: Center(child: CircularProgressIndicator()))
        else if (_error != null) ErrorState(message: _error!, onRetry: _load)
        else if (_items.isEmpty) const PremiumPanel(child: EmptyState(title: 'مشتری‌ای یافت نشد'))
        else ..._items.map((raw) {
          final c = raw as Map<String, dynamic>; final active = c['isActive'] == true;
          return Padding(padding: const EdgeInsets.only(bottom: 9), child: PremiumPanel(accent: active ? null : FollowaColors.amber, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [CircleAvatar(backgroundColor: FollowaColors.elevated, child: Text(c['name'].toString().substring(0, 1))), const SizedBox(width: 10), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(c['name'].toString(), style: const TextStyle(color: FollowaColors.ink, fontWeight: FontWeight.w900)), Text(c['type'] == 'LEGAL' ? 'حقوقی' : 'حقیقی', style: const TextStyle(color: FollowaColors.soft, fontSize: 9.5))])), if (!active) const Text('بایگانی', style: TextStyle(color: Color(0xFFFDE68A), fontSize: 10, fontWeight: FontWeight.w800))]),
            if ((c['mobile'] ?? '').toString().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text(c['mobile'].toString(), textDirection: TextDirection.ltr, style: const TextStyle(color: FollowaColors.muted, fontSize: 10.5))),
            const SizedBox(height: 10),
            Wrap(spacing: 7, runSpacing: 7, children: [OutlinedButton(onPressed: () => _history(c), child: const Text('تاریخچه')), OutlinedButton(onPressed: () => _form(c), child: const Text('ویرایش')), OutlinedButton(onPressed: () => _toggleArchive(c), child: Text(active ? 'بایگانی' : 'بازیابی'))]),
          ])));
        }),
      ])),
    );
  }

  void _message(String text) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text))); }
}

class _HistoryMetric extends StatelessWidget {
  final String label; final Object value;
  const _HistoryMetric({required this.label, required this.value});
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: FollowaColors.elevated, borderRadius: BorderRadius.circular(12)), child: Column(children: [Text(Fa.num(value), style: const TextStyle(color: FollowaColors.ink, fontWeight: FontWeight.w900)), Text(label, style: const TextStyle(color: FollowaColors.soft, fontSize: 9))]));
}
