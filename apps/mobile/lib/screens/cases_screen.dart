import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/case_repository.dart';
import '../widgets/common.dart';
import '../widgets/workspace_visibility.dart';
import '../widgets/case_widgets.dart';
import 'case_detail_screen.dart';
import 'new_case_screen.dart';

class CasesScreen extends StatefulWidget {
  final bool mineOnly;
  final CaseRepository repository;
  const CasesScreen(
      {super.key,
      this.mineOnly = false,
      this.repository = const CaseRepository()});
  @override
  State<CasesScreen> createState() => _CasesScreenState();
}

const _archivedStatuses = {'DONE', 'CANCELLED'};

class _CasesScreenState extends State<CasesScreen> {
  final _searchController = TextEditingController();
  final _scroll = ScrollController();
  List<Map<String, dynamic>> _items = [];
  String _archive = 'active', _status = '', _search = '';
  late bool _mine = widget.mineOnly;
  int _page = 1, _total = 0, _request = 0;
  static const _pageSize = 15;
  bool _loading = true;
  String? _error;
  bool? _wasVisible;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final visible = WorkspaceVisibility.of(context);
    if (_wasVisible == false && visible) {
      _load();
    }
    _wasVisible = visible;
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final request = ++_request;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final params = [
        'page=$_page',
        'pageSize=$_pageSize',
        'archive=$_archive',
        if (widget.mineOnly && _mine) 'mine=true',
        if (_status.isNotEmpty) 'status=$_status',
        if (_search.isNotEmpty) 'search=${Uri.encodeComponent(_search)}'
      ];
      final response =
          await widget.repository.get('/cases?${params.join('&')}');
      if (!mounted || request != _request) return;
      setState(() {
        _items = caseRows(response['items']);
        _total = (response['total'] as num?)?.toInt() ?? _items.length;
      });
      if (_items.isEmpty && _page > 1 && (_page - 1) * _pageSize >= _total) {
        _page--;
        await _load();
      }
    } catch (e) {
      if (mounted && request == _request) {
        setState(() => _error = userMessage(e));
      }
    } finally {
      if (mounted && request == _request) setState(() => _loading = false);
    }
  }

  void _filter(VoidCallback change) {
    setState(() {
      change();
      _page = 1;
    });
    _load();
  }

  Future<void> _new() async {
    await Navigator.push<bool>(
        context,
        MaterialPageRoute(
            builder: (_) => NewCaseScreen(repository: widget.repository)));
    if (mounted) await _load();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('پرونده‌ها'), actions: [
        TextButton.icon(
            onPressed: _new,
            icon: const Icon(Icons.add),
            label: const Text('پرونده جدید'))
      ]),
      body: RefreshIndicator(
          onRefresh: _load,
          child: ListView.builder(
              controller: _scroll,
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 110),
              itemCount: _items.length + 2,
              itemBuilder: (context, index) {
                if (index == 0) {
                  return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (widget.mineOnly)
                          Wrap(spacing: 8, children: [
                            ChoiceChip(
                                label: const Text('مسئولیت من'),
                                selected: _mine,
                                onSelected: (_) => _filter(() => _mine = true)),
                            ChoiceChip(
                                label: const Text('پرونده‌های مرتبط با من'),
                                selected: !_mine,
                                onSelected: (_) =>
                                    _filter(() => _mine = false)),
                          ]),
                        Wrap(spacing: 8, children: [
                          for (final tab in const [
                            ('active', 'پرونده‌های فعال'),
                            ('archived', 'پرونده‌های بایگانی شده')
                          ])
                            ChoiceChip(
                                label: Text(tab.$2),
                                selected: _archive == tab.$1,
                                onSelected: (_) => _filter(() {
                                      _archive = tab.$1;
                                      _status = '';
                                    }))
                        ]),
                        const SizedBox(height: 12),
                        TextField(
                            controller: _searchController,
                            textInputAction: TextInputAction.search,
                            onSubmitted: (v) =>
                                _filter(() => _search = v.trim()),
                            decoration: InputDecoration(
                                hintText: 'جستجو در عنوان پرونده',
                                prefixIcon: IconButton(
                                    tooltip: 'جستجو',
                                    onPressed: () => _filter(() => _search =
                                        _searchController.text.trim()),
                                    icon: const Icon(Icons.search)))),
                        ExpansionTile(
                            title: Text(_status.isEmpty
                                ? 'فیلتر وضعیت'
                                : 'وضعیت: ${statusLabels[_status]}'),
                            tilePadding: EdgeInsets.zero,
                            children: [
                              DropdownButtonFormField<String>(
                                  key: ValueKey('$_archive-$_status'),
                                  initialValue: _status,
                                  isExpanded: true,
                                  decoration: const InputDecoration(
                                      labelText: 'وضعیت پرونده'),
                                  items: [
                                    const DropdownMenuItem(
                                        value: '', child: Text('همه وضعیت‌ها')),
                                    for (final entry in statusLabels.entries)
                                      if (_archive == 'archived'
                                          ? _archivedStatuses
                                              .contains(entry.key)
                                          : !_archivedStatuses
                                              .contains(entry.key))
                                        DropdownMenuItem(
                                            value: entry.key,
                                            child: Text(entry.value))
                                  ],
                                  onChanged: (v) =>
                                      _filter(() => _status = v ?? '')),
                            ]),
                        if (_status.isNotEmpty || _search.isNotEmpty)
                          TextButton(
                              onPressed: () => _filter(() {
                                    _status = '';
                                    _search = '';
                                    _searchController.clear();
                                  }),
                              child: const Text('حذف فیلترها و جستجو')),
                        Text('${Fa.num(_total)} پرونده'),
                        if (_loading) const LinearProgressIndicator(),
                        if (_error != null)
                          CaseError('به‌روزرسانی انجام نشد: $_error',
                              retry: _load),
                        if (!_loading && _error == null && _items.isEmpty)
                          const EmptyState(
                              title: 'پرونده‌ای یافت نشد',
                              hint:
                                  'جستجو یا فیلتر را تغییر دهید یا پرونده جدید ایجاد کنید.'),
                      ]);
                }
                if (index == _items.length + 1) {
                  return Wrap(
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 12,
                      children: [
                        OutlinedButton(
                            onPressed: _page > 1 && !_loading
                                ? () {
                                    setState(() => _page--);
                                    _load();
                                  }
                                : null,
                            child: const Text('قبلی')),
                        Text('صفحه ${Fa.num(_page)}'),
                        OutlinedButton(
                            onPressed: _page * _pageSize < _total && !_loading
                                ? () {
                                    setState(() => _page++);
                                    _load();
                                  }
                                : null,
                            child: const Text('بعدی')),
                      ]);
                }
                final item = _items[index - 1];
                return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Card(
                        child: InkWell(
                            borderRadius: BorderRadius.circular(18),
                            onTap: () async {
                              await Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                      builder: (_) => CaseDetailScreen(
                                          caseId: item['id'].toString(),
                                          repository: widget.repository)));
                              if (mounted) await _load();
                            },
                            child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      Wrap(
                                          spacing: 8,
                                          runSpacing: 8,
                                          crossAxisAlignment:
                                              WrapCrossAlignment.center,
                                          children: [
                                            Text(
                                                '#${Fa.num(item['number'] ?? '—')}'),
                                            StatusChip(
                                                status: item['status']
                                                        ?.toString() ??
                                                    ''),
                                            Text(
                                                'اولویت: ${priorityLabels[item['priority']] ?? item['priority'] ?? 'معمولی'}')
                                          ]),
                                      const SizedBox(height: 10),
                                      Text(
                                          item['title']?.toString() ?? 'پرونده',
                                          style: const TextStyle(
                                              fontSize: 16,
                                              fontWeight: FontWeight.w700)),
                                      const SizedBox(height: 8),
                                      Text(
                                          'مسئول: ${personName(item['currentOwner'], fallback: item['status'] == 'WAITING_ACCEPTANCE' ? 'در انتظار پذیرش' : 'تعیین نشده')}'),
                                      if (item['dueDate'] != null)
                                        Text(
                                            'سررسید: ${Fa.date(DateTime.parse(item['dueDate'].toString()))}'),
                                      if (item['customer'] != null)
                                        Text(
                                            'مشتری: ${item['customer']['name']}${item['customer']['isActive'] == false ? ' · بایگانی' : ''}'),
                                    ])))));
              })));
}
