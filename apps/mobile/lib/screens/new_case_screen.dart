import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
import '../widgets/common.dart';
import '../widgets/case_widgets.dart';
import '../services/case_repository.dart';
import 'case_detail_screen.dart';

class NewCaseScreen extends StatefulWidget {
  final CaseRepository repository;
  const NewCaseScreen({super.key, this.repository = const CaseRepository()});
  @override
  State<NewCaseScreen> createState() => _NewCaseScreenState();
}

class _NewCaseScreenState extends State<NewCaseScreen> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _assignNote = TextEditingController();
  final _customerSearch = TextEditingController();
  String _priority = 'NORMAL';
  String? _caseTypeId;
  String? _assignTo;
  String? _customerId;
  List<dynamic> _caseTypes = [];
  List<dynamic> _members = [];
  List<dynamic> _customers = [];
  bool _busy = false;
  bool _customerLoading = false;
  String? _error;
  String? _metaError, _customerError;
  bool _allowExit = false;

  bool get _isManager => widget.repository.isManager;

  @override
  void initState() {
    super.initState();
    _loadMeta();
    _loadCustomers();
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _assignNote.dispose();
    _customerSearch.dispose();
    super.dispose();
  }

  Future<void> _loadMeta() async {
    if (mounted) setState(() => _metaError = null);
    try {
      final company = await widget.repository.get('/companies/current');
      if (mounted) {
        setState(() =>
            _caseTypes = company['caseTypes'] as List<dynamic>? ?? const []);
      }
    } catch (error) {
      if (mounted) setState(() => _metaError = userMessage(error));
    }
    if (_isManager) {
      try {
        final response = await widget.repository.get('/members');
        if (mounted) {
          setState(() => _members =
                  (response['items'] as List<dynamic>? ?? const [])
                      .where((raw) {
                final m = raw as Map<String, dynamic>;
                return m['isActive'] == true && m['role'] == 'EMPLOYEE';
              }).toList());
        }
      } catch (error) {
        if (mounted) setState(() => _metaError = userMessage(error));
      }
    }
  }

  Future<void> _loadCustomers() async {
    setState(() {
      _customerLoading = true;
      _customerError = null;
    });
    try {
      final search = _customerSearch.text.trim();
      final response = await widget.repository.get(
          '/customers?pageSize=30${search.isEmpty ? '' : '&search=${Uri.encodeComponent(search)}'}');
      if (mounted) {
        final selected =
            _customers.where((r) => r['id'] == _customerId).firstOrNull;
        final loaded = response['items'] as List<dynamic>? ?? const [];
        setState(() => _customers = [
              if (selected != null &&
                  !loaded.any((r) => r['id'] == _customerId))
                selected,
              ...loaded
            ]);
      }
    } catch (error) {
      if (mounted) setState(() => _customerError = userMessage(error));
    } finally {
      if (mounted) setState(() => _customerLoading = false);
    }
  }

  Future<void> _quickCustomer() async {
    var type = 'INDIVIDUAL';
    final name = TextEditingController(),
        mobile = TextEditingController(),
        phone = TextEditingController();
    String? error;
    bool busy = false;
    final customer = await showDialog<Map<String, dynamic>>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => StatefulBuilder(
            builder: (ctx, update) => PopScope(
                canPop: !busy,
                child: AlertDialog(
                  title: const Text('مشتری سریع'),
                  content: SingleChildScrollView(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                    DropdownButtonFormField<String>(
                        initialValue: type,
                        items: const [
                          DropdownMenuItem(
                              value: 'INDIVIDUAL', child: Text('شخص حقیقی')),
                          DropdownMenuItem(
                              value: 'LEGAL', child: Text('شخص حقوقی'))
                        ],
                        onChanged:
                            busy ? null : (v) => update(() => type = v!)),
                    TextField(
                        controller: name,
                        enabled: !busy,
                        decoration: const InputDecoration(labelText: 'نام *')),
                    TextField(
                        controller: mobile,
                        enabled: !busy,
                        textDirection: TextDirection.ltr,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(
                            labelText: 'موبایل (اختیاری)')),
                    TextField(
                        controller: phone,
                        enabled: !busy,
                        textDirection: TextDirection.ltr,
                        keyboardType: TextInputType.phone,
                        decoration:
                            const InputDecoration(labelText: 'تلفن (اختیاری)')),
                    if (error != null) CaseError(error!),
                  ])),
                  actions: [
                    TextButton(
                        onPressed: busy ? null : () => Navigator.pop(ctx),
                        child: const Text('انصراف')),
                    TextButton(
                        onPressed: busy
                            ? null
                            : () async {
                                if (name.text.trim().length < 2) {
                                  update(() =>
                                      error = 'نام باید حداقل ۲ کاراکتر باشد');
                                  return;
                                }
                                update(() {
                                  busy = true;
                                  error = null;
                                });
                                try {
                                  final r = await widget.repository
                                      .post('/customers', {
                                    'type': type,
                                    'name': name.text.trim(),
                                    if (mobile.text.trim().isNotEmpty)
                                      'mobile': mobile.text.trim(),
                                    if (phone.text.trim().isNotEmpty)
                                      'phone': phone.text.trim()
                                  });
                                  if (ctx.mounted) {
                                    update(() => busy = false);
                                    Navigator.pop(
                                        ctx,
                                        Map<String, dynamic>.from(
                                            r['customer']));
                                  }
                                } catch (e) {
                                  if (ctx.mounted) {
                                    update(() {
                                      busy = false;
                                      error = userMessage(e);
                                    });
                                  }
                                }
                              },
                        child: Text(busy ? 'در حال ثبت…' : 'ثبت و انتخاب'))
                  ],
                ))));
    name.dispose();
    mobile.dispose();
    phone.dispose();
    if (customer != null && mounted) {
      setState(() {
        _customerId = customer['id'].toString();
        _customers = [
          customer,
          ..._customers.where((raw) => raw['id'] != customer['id'])
        ];
      });
    }
  }

  Future<void> _leave() async {
    if (_busy) return;
    if ((_title.text.isNotEmpty ||
            _description.text.isNotEmpty ||
            _customerId != null ||
            _assignTo != null) &&
        !await confirmDiscard(context)) {
      return;
    }
    if (!mounted) return;
    setState(() => _allowExit = true);
    await WidgetsBinding.instance.endOfFrame;
    if (mounted) Navigator.pop(context);
  }

  Future<void> _submit() async {
    if (_busy || _title.text.trim().length < 3) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final response = await widget.repository.post('/cases', {
        'title': _title.text.trim(),
        if (_description.text.trim().isNotEmpty)
          'description': _description.text.trim(),
        'priority': _priority,
        if (_caseTypeId != null) 'caseTypeId': _caseTypeId,
        if (_customerId != null) 'customerId': _customerId,
        if (_assignTo != null) 'assignToUserId': _assignTo,
        if (_assignTo != null && _assignNote.text.trim().isNotEmpty)
          'assignNote': _assignNote.text.trim(),
      });
      if (!mounted) return;
      setState(() => _allowExit = true);
      await WidgetsBinding.instance.endOfFrame;
      if (!mounted) return;
      final id = response['case']?['id']?.toString();
      if (id != null) {
        Navigator.pushReplacement(
            context,
            MaterialPageRoute<bool>(
                builder: (_) => CaseDetailScreen(
                    caseId: id, repository: widget.repository)));
      } else {
        Navigator.pop(context, true);
      }
    } catch (error) {
      if (mounted) setState(() => _error = userMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
        canPop: _allowExit,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) _leave();
        },
        child: Scaffold(
          appBar: AppBar(
              title: const Text('پرونده جدید'),
              leading: BackButton(onPressed: _leave)),
          body: AbsorbPointer(
              absorbing: _busy,
              child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 30),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_metaError != null)
                          CaseError(
                              'اطلاعات طبقه‌بندی یا کارکنان بارگیری نشد: $_metaError',
                              retry: _loadMeta),
                        if (_customerError != null)
                          CaseError(
                              'فهرست مشتریان بارگیری نشد: $_customerError',
                              retry: _loadCustomers),
                        PremiumPanel(
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                              const _Title(
                                  icon: Icons.description_outlined,
                                  title: 'مشخصات پرونده',
                                  subtitle:
                                      'عنوان و شرح عملیاتی پرونده را ثبت کنید.'),
                              const SizedBox(height: 14),
                              TextField(
                                  controller: _title,
                                  autofocus: true,
                                  onChanged: (_) => setState(() {}),
                                  decoration: const InputDecoration(
                                      labelText: 'عنوان *',
                                      hintText:
                                          'مثلاً: تماس با مشتری برای پیش‌فاکتور')),
                              const SizedBox(height: 11),
                              TextField(
                                  controller: _description,
                                  maxLines: 4,
                                  decoration: const InputDecoration(
                                      labelText: 'توضیحات',
                                      alignLabelWithHint: true)),
                            ])),
                        const SizedBox(height: 11),
                        ExpansionTile(
                            title: const Text('طبقه‌بندی (اختیاری)'),
                            children: [
                              PremiumPanel(
                                  child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                    const _Title(
                                        icon: Icons.tune_rounded,
                                        title: 'طبقه‌بندی',
                                        subtitle:
                                            'اولویت و نوع پرونده را مشخص کنید.'),
                                    const SizedBox(height: 14),
                                    DropdownButtonFormField<String>(
                                        initialValue: _priority,
                                        decoration: const InputDecoration(
                                            labelText: 'اولویت'),
                                        dropdownColor: FollowaColors.elevated,
                                        items: const [
                                          DropdownMenuItem(
                                              value: 'LOW', child: Text('کم')),
                                          DropdownMenuItem(
                                              value: 'NORMAL',
                                              child: Text('معمولی')),
                                          DropdownMenuItem(
                                              value: 'HIGH',
                                              child: Text('زیاد')),
                                          DropdownMenuItem(
                                              value: 'URGENT',
                                              child: Text('فوری'))
                                        ],
                                        onChanged: (v) => setState(
                                            () => _priority = v ?? 'NORMAL')),
                                    if (_caseTypes.isNotEmpty) ...[
                                      const SizedBox(height: 10),
                                      DropdownButtonFormField<String>(
                                          initialValue: _caseTypeId,
                                          decoration: const InputDecoration(
                                              labelText: 'نوع پرونده'),
                                          dropdownColor: FollowaColors.elevated,
                                          items: [
                                            const DropdownMenuItem(
                                                value: null,
                                                child: Text('— بدون نوع —')),
                                            for (final raw in _caseTypes)
                                              DropdownMenuItem(
                                                  value: (raw as Map<String,
                                                          dynamic>)['id']
                                                      .toString(),
                                                  child: Text(
                                                      raw['name'].toString()))
                                          ],
                                          onChanged: (v) =>
                                              setState(() => _caseTypeId = v))
                                    ],
                                  ]))
                            ]),
                        const SizedBox(height: 11),
                        ExpansionTile(
                            title: const Text('مشتری (اختیاری)'),
                            children: [
                              PremiumPanel(
                                  child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                    Row(children: [
                                      const Expanded(
                                          child: _Title(
                                              icon: Icons.people_alt_outlined,
                                              title: 'مشتری (اختیاری)',
                                              subtitle:
                                                  'پرونده داخلی می‌تواند بدون مشتری باشد.')),
                                      TextButton.icon(
                                          onPressed: _quickCustomer,
                                          icon: const Icon(Icons.add_rounded,
                                              size: 17),
                                          label: const Text('مشتری سریع'))
                                    ]),
                                    const SizedBox(height: 12),
                                    TextField(
                                        controller: _customerSearch,
                                        textInputAction: TextInputAction.search,
                                        onSubmitted: (_) => _loadCustomers(),
                                        decoration: InputDecoration(
                                            labelText: 'جستجوی مشتری',
                                            prefixIcon: const Icon(
                                                Icons.search_rounded),
                                            suffixIcon: _customerLoading
                                                ? const Padding(
                                                    padding: EdgeInsets.all(12),
                                                    child: SizedBox(
                                                        width: 18,
                                                        height: 18,
                                                        child:
                                                            CircularProgressIndicator(
                                                                strokeWidth:
                                                                    2)))
                                                : null)),
                                    const SizedBox(height: 10),
                                    DropdownButtonFormField<String>(
                                        key: ValueKey(
                                            'customer-$_customerId-${_customers.length}'),
                                        initialValue: _customers.any(
                                                (r) => r['id'] == _customerId)
                                            ? _customerId
                                            : null,
                                        decoration: const InputDecoration(
                                            labelText: 'انتخاب مشتری'),
                                        dropdownColor: FollowaColors.elevated,
                                        items: [
                                          const DropdownMenuItem(
                                              value: null,
                                              child: Text(
                                                  '— بدون مشتری / پرونده داخلی —')),
                                          for (final raw in _customers)
                                            DropdownMenuItem(
                                                value: (raw as Map<String,
                                                        dynamic>)['id']
                                                    .toString(),
                                                child: Text(
                                                    '${raw['name']}${(raw['mobile'] ?? '').toString().isEmpty ? '' : ' — ${raw['mobile']}'}'))
                                        ],
                                        onChanged: (v) =>
                                            setState(() => _customerId = v)),
                                  ]))
                            ]),
                        if (_isManager) ...[
                          const SizedBox(height: 11),
                          ExpansionTile(
                              title: const Text('ارجاع اولیه (اختیاری)'),
                              children: [
                                PremiumPanel(
                                    child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.stretch,
                                        children: [
                                      const _Title(
                                          icon: Icons.forward_to_inbox_outlined,
                                          title: 'ارجاع اولیه',
                                          subtitle:
                                              'فقط کارکنان فعال شرکت مقصد ارجاع هستند.'),
                                      const SizedBox(height: 12),
                                      DropdownButtonFormField<String>(
                                          initialValue: _assignTo,
                                          decoration: const InputDecoration(
                                              labelText: 'ارجاع به'),
                                          dropdownColor: FollowaColors.elevated,
                                          items: [
                                            const DropdownMenuItem(
                                                value: null,
                                                child: Text(
                                                    'بدون ارجاع — فقط ثبت پرونده')),
                                            for (final raw in _members)
                                              DropdownMenuItem(
                                                  value: (raw as Map<String,
                                                          dynamic>)['userId']
                                                      .toString(),
                                                  child: Text(raw['fullName']
                                                      .toString()))
                                          ],
                                          onChanged: (v) =>
                                              setState(() => _assignTo = v)),
                                      if (_assignTo != null) ...[
                                        const SizedBox(height: 10),
                                        TextField(
                                            controller: _assignNote,
                                            maxLines: 2,
                                            decoration: const InputDecoration(
                                                labelText: 'توضیح ارجاع'))
                                      ],
                                    ]))
                              ]),
                        ],
                        if (_error != null) ...[
                          const SizedBox(height: 11),
                          Text(_error!,
                              style: const TextStyle(
                                  color: Color(0xFFFCA5A5), fontSize: 12))
                        ],
                        const SizedBox(height: 16),
                        FilledButton.icon(
                            onPressed: !_busy && _title.text.trim().length >= 3
                                ? _submit
                                : null,
                            icon: _busy
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2))
                                : const Icon(Icons.add_task_rounded),
                            label:
                                Text(_busy ? 'در حال ثبت…' : 'ایجاد پرونده')),
                      ]))),
        ));
  }
}

class _Title extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  const _Title(
      {required this.icon, required this.title, required this.subtitle});
  @override
  Widget build(BuildContext context) =>
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
                color: FollowaColors.elevated,
                borderRadius: BorderRadius.circular(11),
                border: Border.all(color: FollowaColors.border)),
            child: Icon(icon, color: FollowaColors.brandSoft, size: 17)),
        const SizedBox(width: 9),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style: const TextStyle(
                  color: FollowaColors.ink,
                  fontSize: 12,
                  fontWeight: FontWeight.w900)),
          const SizedBox(height: 2),
          Text(subtitle,
              style: const TextStyle(
                  color: FollowaColors.soft, fontSize: 12, height: 1.5))
        ]))
      ]);
}
