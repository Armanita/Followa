import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
import '../widgets/common.dart';

class CustomerReportScreen extends StatefulWidget {
  const CustomerReportScreen({super.key});

  @override
  State<CustomerReportScreen> createState() => _CustomerReportScreenState();
}

class _CustomerReportScreenState extends State<CustomerReportScreen> {
  static const _pageSize = 15;

  final _customerSearch = TextEditingController();
  List<dynamic> _customers = [];
  bool _customerLoading = false;
  String? _customerId;
  String _archive = '';
  DateTime? _from;
  DateTime? _to;
  String? _ownerId;
  String? _caseTypeId;
  List<dynamic> _members = [];
  List<dynamic> _caseTypes = [];
  List<dynamic> _items = [];
  int _page = 1;
  int _total = 0;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadMeta();
    _loadCustomers();
  }

  @override
  void dispose() {
    _customerSearch.dispose();
    super.dispose();
  }

  bool get _isManager => AuthService.instance.isManager;

  Future<void> _loadMeta() async {
    try {
      final company = await AuthService.instance.get('/companies/current');
      if (mounted) {
        setState(() =>
            _caseTypes = company['caseTypes'] as List<dynamic>? ?? const []);
      }
    } catch (_) {}
    if (_isManager) {
      try {
        final response = await AuthService.instance.get('/members');
        if (mounted) {
          setState(() =>
              _members = (response['items'] as List<dynamic>? ?? const [])
                  .where((raw) =>
                      (raw as Map<String, dynamic>)['isActive'] == true)
                  .toList());
        }
      } catch (_) {}
    }
  }

  Future<void> _loadCustomers() async {
    setState(() => _customerLoading = true);
    try {
      final search = _customerSearch.text.trim();
      final response = await AuthService.instance.get(
          '/customers?pageSize=30${search.isEmpty ? '' : '&search=${Uri.encodeComponent(search)}'}');
      if (mounted) {
        setState(
            () => _customers = response['items'] as List<dynamic>? ?? const []);
      }
    } catch (_) {
      if (mounted) setState(() => _customers = []);
    } finally {
      if (mounted) setState(() => _customerLoading = false);
    }
  }

  String _dateParam(DateTime value, {required bool end}) {
    final y = value.year.toString().padLeft(4, '0');
    final m = value.month.toString().padLeft(2, '0');
    final d = value.day.toString().padLeft(2, '0');
    return end ? '$y-$m-${d}T23:59:59.999' : '$y-$m-${d}T00:00:00.000';
  }

  Future<void> _load() async {
    if (_customerId == null) {
      setState(() {
        _items = [];
        _total = 0;
        _error = null;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final params = <String>[
        'customerId=$_customerId',
        'page=$_page',
        'pageSize=$_pageSize',
      ];
      if (_archive.isNotEmpty) params.add('archive=$_archive');
      if (_from != null) params.add('from=${_dateParam(_from!, end: false)}');
      if (_to != null) params.add('to=${_dateParam(_to!, end: true)}');
      if (_ownerId != null) params.add('ownerId=$_ownerId');
      if (_caseTypeId != null) params.add('caseTypeId=$_caseTypeId');
      final response =
          await AuthService.instance.get('/cases?${params.join('&')}');
      if (!mounted) return;
      setState(() {
        _items = response['items'] as List<dynamic>? ?? const [];
        _total = (response['total'] as num?)?.toInt() ?? _items.length;
      });
    } catch (error) {
      if (mounted) setState(() => _error = userMessage(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickDate({required bool isFrom}) async {
    final initial = (isFrom ? _from : _to) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked == null) return;
    setState(() {
      if (isFrom) {
        _from = picked;
      } else {
        _to = picked;
      }
      _page = 1;
    });
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final hasPrev = _page > 1;
    final hasNext = _page * _pageSize < _total;
    return Scaffold(
      appBar: AppBar(title: const Text('گزارش مشتری')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 110),
          children: [
            PremiumPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('مشتری',
                      style: TextStyle(
                          color: FollowaColors.ink,
                          fontSize: 12,
                          fontWeight: FontWeight.w900)),
                  const SizedBox(height: 4),
                  const Text(
                    'مشتری را انتخاب کنید تا پرونده‌های مرتبط نمایش داده شود.',
                    style: TextStyle(
                        color: FollowaColors.soft, fontSize: 9.5, height: 1.5),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                      controller: _customerSearch,
                      textInputAction: TextInputAction.search,
                      onSubmitted: (_) => _loadCustomers(),
                      decoration: InputDecoration(
                          labelText: 'جستجوی مشتری',
                          prefixIcon: const Icon(Icons.search_rounded),
                          suffixIcon: _customerLoading
                              ? const Padding(
                                  padding: EdgeInsets.all(12),
                                  child: SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                          strokeWidth: 2)))
                              : null)),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                      initialValue: _customerId,
                      decoration:
                          const InputDecoration(labelText: 'انتخاب مشتری *'),
                      dropdownColor: FollowaColors.elevated,
                      items: [
                        const DropdownMenuItem(
                            value: null,
                            child: Text('— مشتری را انتخاب کنید —')),
                        for (final raw in _customers)
                          DropdownMenuItem(
                              value:
                                  (raw as Map<String, dynamic>)['id'].toString(),
                              child: Text(
                                  '${raw['name']}${(raw['mobile'] ?? '').toString().isEmpty ? '' : ' — ${raw['mobile']}'}'))
                      ],
                      onChanged: (v) {
                        setState(() {
                          _customerId = v;
                          _page = 1;
                        });
                        _load();
                      }),
                ],
              ),
            ),
            const SizedBox(height: 11),
            PremiumPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('فیلترها',
                      style: TextStyle(
                          color: FollowaColors.ink,
                          fontSize: 12,
                          fontWeight: FontWeight.w900)),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                      initialValue: _archive,
                      decoration: const InputDecoration(labelText: 'وضعیت'),
                      dropdownColor: FollowaColors.elevated,
                      items: const [
                        DropdownMenuItem(value: '', child: Text('همه')),
                        DropdownMenuItem(
                            value: 'active', child: Text('در حال انجام')),
                        DropdownMenuItem(
                            value: 'archived', child: Text('بایگانی شده')),
                      ],
                      onChanged: (v) {
                        setState(() {
                          _archive = v ?? '';
                          _page = 1;
                        });
                        _load();
                      }),
                  const SizedBox(height: 10),
                  Row(children: [
                    Expanded(
                        child: OutlinedButton.icon(
                            onPressed: () => _pickDate(isFrom: true),
                            icon: const Icon(Icons.event_outlined, size: 17),
                            label: Text(_from == null
                                ? 'از تاریخ'
                                : Fa.date(_from!)),
                            style: OutlinedButton.styleFrom(
                                minimumSize: const Size(0, 48),
                                foregroundColor: FollowaColors.muted))),
                    const SizedBox(width: 8),
                    Expanded(
                        child: OutlinedButton.icon(
                            onPressed: () => _pickDate(isFrom: false),
                            icon: const Icon(Icons.event_outlined, size: 17),
                            label: Text(
                                _to == null ? 'تا تاریخ' : Fa.date(_to!)),
                            style: OutlinedButton.styleFrom(
                                minimumSize: const Size(0, 48),
                                foregroundColor: FollowaColors.muted))),
                  ]),
                  if ((_from != null || _to != null) &&
                      (_archive.isNotEmpty ||
                          _ownerId != null ||
                          _caseTypeId != null ||
                          _customerId != null)) ...[
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: TextButton.icon(
                          onPressed: () {
                            setState(() {
                              _from = null;
                              _to = null;
                              _archive = '';
                              _ownerId = null;
                              _caseTypeId = null;
                              _page = 1;
                            });
                            _load();
                          },
                          icon: const Icon(Icons.filter_alt_off_outlined,
                              size: 16),
                          label: const Text('حذف فیلترها')),
                    ),
                  ],
                  if (_isManager && _members.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    DropdownButtonFormField<String>(
                        initialValue: _ownerId,
                        decoration: const InputDecoration(labelText: 'کارمند'),
                        dropdownColor: FollowaColors.elevated,
                        items: [
                          const DropdownMenuItem(
                              value: null, child: Text('همه کارمندان')),
                          for (final raw in _members)
                            DropdownMenuItem(
                                value: (raw as Map<String, dynamic>)['userId']
                                    .toString(),
                                child: Text(raw['fullName'].toString()))
                        ],
                        onChanged: (v) {
                          setState(() {
                            _ownerId = v;
                            _page = 1;
                          });
                          _load();
                        }),
                  ],
                  if (_caseTypes.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                        initialValue: _caseTypeId,
                        decoration:
                            const InputDecoration(labelText: 'نوع پرونده'),
                        dropdownColor: FollowaColors.elevated,
                        items: [
                          const DropdownMenuItem(
                              value: null, child: Text('همه انواع')),
                          for (final raw in _caseTypes)
                            DropdownMenuItem(
                                value: (raw as Map<String, dynamic>)['id']
                                    .toString(),
                                child: Text(raw['name'].toString()))
                        ],
                        onChanged: (v) {
                          setState(() {
                            _caseTypeId = v;
                            _page = 1;
                          });
                          _load();
                        }),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (_customerId == null)
              const PremiumPanel(
                  child: EmptyState(
                      title: 'مشتری را انتخاب کنید',
                      hint:
                          'پس از انتخاب مشتری، پرونده‌ها با وضعیت، تاریخ ایجاد و تکمیل نمایش داده می‌شوند.'))
            else if (_loading)
              const Padding(
                  padding: EdgeInsets.all(48),
                  child: Center(child: CircularProgressIndicator()))
            else if (_error != null)
              ErrorState(message: _error!, onRetry: _load)
            else if (_items.isEmpty)
              const PremiumPanel(
                  child: EmptyState(
                      title: 'پرونده‌ای یافت نشد',
                      hint:
                          'فیلترها را تغییر دهید یا بازه زمانی را گسترده‌تر کنید.'))
            else ...[
              ..._items.map((raw) {
                final item = raw as Map<String, dynamic>;
                final owner = item['currentOwner'] as Map?;
                final ownerName = owner == null
                    ? '—'
                    : '${owner['firstName'] ?? ''} ${owner['lastName'] ?? ''}'
                        .trim();
                final caseType = item['caseType'] as Map?;
                final createdAt =
                    DateTime.tryParse(item['createdAt']?.toString() ?? '');
                final resultAt =
                    DateTime.tryParse(item['resultAt']?.toString() ?? '');
                final updatedAt =
                    DateTime.tryParse(item['updatedAt']?.toString() ?? '');
                final priority = item['priority']?.toString() ?? 'NORMAL';
                return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: PremiumPanel(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          Row(children: [
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                  color: FollowaColors.elevated,
                                  borderRadius: BorderRadius.circular(9),
                                  border:
                                      Border.all(color: FollowaColors.border)),
                              child: Text(
                                  '#${Fa.num(item['number'] ?? '—')}',
                                  style: const TextStyle(
                                      color: FollowaColors.muted,
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.w900)),
                            ),
                            const SizedBox(width: 7),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                  color: FollowaColors.amber
                                      .withValues(alpha: .09),
                                  borderRadius: BorderRadius.circular(9),
                                  border: Border.all(
                                      color: FollowaColors.amber
                                          .withValues(alpha: .18))),
                              child: Text(
                                  priorityLabels[priority] ?? priority,
                                  style: const TextStyle(
                                      color: FollowaColors.amber,
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.w900)),
                            ),
                            const Spacer(),
                            StatusChip(
                                status: item['status']?.toString() ?? ''),
                          ]),
                          const SizedBox(height: 11),
                          Text(item['title']?.toString() ?? 'پرونده',
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  color: FollowaColors.ink,
                                  fontWeight: FontWeight.w900,
                                  fontSize: 13.5,
                                  height: 1.5)),
                          const SizedBox(height: 10),
                          _metaRow(
                              Icons.category_outlined,
                              'نوع: ${caseType?['name'] ?? '—'}'),
                          const SizedBox(height: 5),
                          _metaRow(Icons.person_outline_rounded,
                              'مسئول: $ownerName'),
                          const SizedBox(height: 5),
                          _metaRow(Icons.event_outlined,
                              'ایجاد: ${createdAt == null ? '—' : Fa.date(createdAt)}'),
                          const SizedBox(height: 5),
                          _metaRow(
                              Icons.check_circle_outline_rounded,
                              'تکمیل: ${resultAt == null ? '—' : Fa.date(resultAt)}'),
                          const SizedBox(height: 5),
                          _metaRow(
                              Icons.update_rounded,
                              'آخرین بروزرسانی: ${updatedAt == null ? '—' : Fa.date(updatedAt)}'),
                        ])));
              }),
              if (_total > _pageSize)
                Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          OutlinedButton(
                              onPressed: hasPrev
                                  ? () {
                                      setState(() => _page--);
                                      _load();
                                    }
                                  : null,
                              child: const Text('قبلی')),
                          Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 12),
                              child: Text('صفحه ${Fa.num(_page)}',
                                  style: const TextStyle(
                                      color: FollowaColors.muted,
                                      fontSize: 10.5,
                                      fontWeight: FontWeight.w800))),
                          OutlinedButton(
                              onPressed: hasNext
                                  ? () {
                                      setState(() => _page++);
                                      _load();
                                    }
                                  : null,
                              child: const Text('بعدی')),
                        ])),
            ],
          ],
        ),
      ),
    );
  }

  Widget _metaRow(IconData icon, String text) {
    return Row(children: [
      Icon(icon, color: FollowaColors.soft, size: 15),
      const SizedBox(width: 5),
      Expanded(
          child: Text(text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style:
                  const TextStyle(color: FollowaColors.muted, fontSize: 10.5)))
    ]);
  }
}
