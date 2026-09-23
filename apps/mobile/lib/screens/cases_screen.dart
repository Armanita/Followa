import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
import '../widgets/common.dart';
import 'case_detail_screen.dart';
import 'new_case_screen.dart';

class CasesScreen extends StatefulWidget {
  final bool mineOnly;
  const CasesScreen({super.key, this.mineOnly = false});

  @override
  State<CasesScreen> createState() => _CasesScreenState();
}

const _archivedStatuses = {'DONE', 'CANCELLED'};

class _CasesScreenState extends State<CasesScreen> {
  static const _pageSize = 15;
  final _searchController = TextEditingController();
  List<dynamic> _items = [];
  String? _error;
  String _search = '';
  String _status = '';
  String _archive = 'active';
  int _page = 1;
  int _total = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final params = <String>[
        'page=$_page',
        'pageSize=$_pageSize',
        'archive=$_archive',
      ];
      if (widget.mineOnly) params.add('mine=true');
      if (_search.isNotEmpty) {
        params.add('search=${Uri.encodeComponent(_search)}');
      }
      if (_status.isNotEmpty) params.add('status=$_status');
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

  void _switchArchive(String value) {
    if (value == _archive) return;
    setState(() {
      _archive = value;
      _status = '';
      _page = 1;
    });
    _load();
  }

  void _applySearch(String value) {
    _search = value.trim();
    _page = 1;
    _load();
  }

  Future<void> _openNewCase() async {
    final created = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => const NewCaseScreen()),
    );
    if (created == true) {
      _page = 1;
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasPrev = _page > 1;
    final hasNext = _page * _pageSize < _total;
    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
              child: Column(
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.mineOnly
                                  ? 'فضای اجرای من'
                                  : 'مرکز پرونده‌ها',
                              style: const TextStyle(
                                color: FollowaColors.soft,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              widget.mineOnly ? 'پرونده‌های من' : 'پرونده‌ها',
                              style: const TextStyle(
                                color: FollowaColors.ink,
                                fontSize: 21,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${Fa.num(_total)} پرونده در نتیجه فعلی',
                              style: const TextStyle(
                                color: FollowaColors.muted,
                                fontSize: 10.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      FilledButton.tonalIcon(
                        onPressed: _openNewCase,
                        icon: const Icon(Icons.add_rounded, size: 18),
                        label: const Text('پرونده جدید'),
                        style: FilledButton.styleFrom(
                          minimumSize: const Size(0, 44),
                          backgroundColor:
                              FollowaColors.brand.withValues(alpha: .16),
                          foregroundColor: FollowaColors.brandSoft,
                          side: BorderSide(
                            color:
                                FollowaColors.brandSoft.withValues(alpha: .20),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        for (final tab in const [
                          ('active', 'پرونده‌های فعال'),
                          ('archived', 'پرونده‌های بایگانی شده'),
                        ])
                          Padding(
                            padding: const EdgeInsets.only(left: 7),
                            child: ChoiceChip(
                              label: Text(tab.$2),
                              selected: _archive == tab.$1,
                              onSelected: (_) => _switchArchive(tab.$1),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _searchController,
                    textInputAction: TextInputAction.search,
                    onSubmitted: _applySearch,
                    decoration: InputDecoration(
                      hintText: 'جستجو در عنوان پرونده…',
                      prefixIcon: const Icon(Icons.search_rounded, size: 20),
                      suffixIcon: _search.isEmpty
                          ? null
                          : IconButton(
                              onPressed: () {
                                _searchController.clear();
                                _applySearch('');
                              },
                              icon: const Icon(Icons.close_rounded, size: 18),
                            ),
                    ),
                  ),
                  const SizedBox(height: 9),
                  DropdownButtonFormField<String>(
                    initialValue: _status,
                    decoration: const InputDecoration(
                      labelText: 'وضعیت پرونده',
                      prefixIcon: Icon(Icons.filter_alt_outlined, size: 19),
                    ),
                    dropdownColor: FollowaColors.elevated,
                    items: [
                      const DropdownMenuItem(
                          value: '', child: Text('همه وضعیت‌ها')),
                      for (final entry in statusLabels.entries)
                        if (_archive == 'archived'
                            ? _archivedStatuses.contains(entry.key)
                            : !_archivedStatuses.contains(entry.key))
                          DropdownMenuItem(
                            value: entry.key,
                            child: Text(entry.value),
                          ),
                    ],
                    onChanged: (value) {
                      setState(() {
                        _status = value ?? '';
                        _page = 1;
                      });
                      _load();
                    },
                  ),
                ],
              ),
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _load,
                child: _error != null
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          ErrorState(message: _error!, onRetry: _load)
                        ],
                      )
                    : _loading
                        ? const Center(child: CircularProgressIndicator())
                        : _items.isEmpty
                            ? ListView(
                                physics: const AlwaysScrollableScrollPhysics(),
                                padding:
                                    const EdgeInsets.fromLTRB(16, 10, 16, 108),
                                    children: [
                                      PremiumPanel(
                                        child: EmptyState(
                                          title: _archive == 'archived'
                                              ? 'پرونده بایگانی‌شده‌ای نیست'
                                              : 'پرونده‌ای یافت نشد',
                                          hint:
                                              'جستجو یا فیلتر را تغییر دهید یا پرونده جدید ایجاد کنید.',
                                        ),
                                      ),
                                    ],
                              )
                            : ListView.separated(
                                padding:
                                    const EdgeInsets.fromLTRB(16, 8, 16, 108),
                                itemCount: _items.length + 1,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 10),
                                itemBuilder: (context, index) {
                                  if (index == _items.length) {
                                    return Padding(
                                      padding: const EdgeInsets.only(top: 4),
                                      child: Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          OutlinedButton(
                                            onPressed: hasPrev
                                                ? () {
                                                    setState(() => _page--);
                                                    _load();
                                                  }
                                                : null,
                                            child: const Text('قبلی'),
                                          ),
                                          Padding(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 12),
                                            child: Text(
                                              'صفحه ${Fa.num(_page)}',
                                              style: const TextStyle(
                                                color: FollowaColors.muted,
                                                fontSize: 10.5,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                          ),
                                          OutlinedButton(
                                            onPressed: hasNext
                                                ? () {
                                                    setState(() => _page++);
                                                    _load();
                                                  }
                                                : null,
                                            child: const Text('بعدی'),
                                          ),
                                        ],
                                      ),
                                    );
                                  }
                                  final item =
                                      _items[index] as Map<String, dynamic>;
                                  return _CaseCard(
                                    item: item,
                                    onTap: () async {
                                      await Navigator.push(
                                        context,
                                        MaterialPageRoute(
                                          builder: (_) => CaseDetailScreen(
                                            caseId: item['id'] as String,
                                          ),
                                        ),
                                      );
                                      await _load();
                                    },
                                  );
                                },
                              ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CaseCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final VoidCallback onTap;
  const _CaseCard({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final priority = item['priority']?.toString() ?? 'NORMAL';
    final isUrgent = priority == 'URGENT';
    final isHigh = priority == 'HIGH';
    final accent = isUrgent
        ? FollowaColors.red
        : isHigh
            ? FollowaColors.amber
            : statusColors[item['status']] ?? FollowaColors.brandSoft;
    final owner = item['currentOwner'] as Map?;
    final ownerName = owner == null
        ? 'در انتظار تعیین مسئول'
        : '${owner['firstName'] ?? ''} ${owner['lastName'] ?? ''}'.trim();
    final dueDate = DateTime.tryParse(item['dueDate']?.toString() ?? '');
    final customer = item['customer'] as Map?;
    final customerName =
        customer?['displayName']?.toString() ?? customer?['name']?.toString();

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: FollowaColors.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: accent.withValues(alpha: .18)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: FollowaColors.elevated,
                      borderRadius: BorderRadius.circular(9),
                      border: Border.all(color: FollowaColors.border),
                    ),
                    child: Text(
                      '#${Fa.num(item['number'] ?? '—')}',
                      style: const TextStyle(
                        color: FollowaColors.muted,
                        fontSize: 9.5,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  if (isUrgent || isHigh) ...[
                    const SizedBox(width: 7),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: .09),
                        borderRadius: BorderRadius.circular(9),
                        border:
                            Border.all(color: accent.withValues(alpha: .18)),
                      ),
                      child: Text(
                        priorityLabels[priority] ?? priority,
                        style: TextStyle(
                          color: accent,
                          fontSize: 9.5,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ],
                  const Spacer(),
                  StatusChip(status: item['status']?.toString() ?? ''),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                item['title']?.toString() ?? 'پرونده',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: FollowaColors.ink,
                  fontWeight: FontWeight.w900,
                  fontSize: 13.5,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 11),
              Row(
                children: [
                  const Icon(
                    Icons.person_outline_rounded,
                    color: FollowaColors.soft,
                    size: 16,
                  ),
                  const SizedBox(width: 5),
                  Expanded(
                    child: Text(
                      ownerName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: FollowaColors.muted,
                        fontSize: 10.5,
                      ),
                    ),
                  ),
                  if (dueDate != null) ...[
                    const SizedBox(width: 8),
                    const Icon(
                      Icons.event_outlined,
                      color: FollowaColors.soft,
                      size: 15,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      Fa.date(dueDate),
                      style: const TextStyle(
                        color: FollowaColors.soft,
                        fontSize: 9.5,
                      ),
                    ),
                  ],
                ],
              ),
              if (customerName != null && customerName.trim().isNotEmpty) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(
                      Icons.business_center_outlined,
                      color: FollowaColors.soft,
                      size: 15,
                    ),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(
                        customerName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: customer?['isActive'] == false
                              ? const Color(0xFFFDE68A)
                              : FollowaColors.soft,
                          fontSize: 9.5,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
