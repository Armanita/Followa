import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/case_repository.dart';
import '../widgets/case_widgets.dart';
import '../widgets/common.dart';
import 'case_detail_screen.dart';

class CustomerCaseHistoryScreen extends StatefulWidget {
  final String customerId, name;
  final CaseRepository repository;
  const CustomerCaseHistoryScreen(
      {super.key,
      required this.customerId,
      required this.name,
      this.repository = const CaseRepository()});
  @override
  State<CustomerCaseHistoryScreen> createState() =>
      _CustomerCaseHistoryScreenState();
}

class _CustomerCaseHistoryScreenState extends State<CustomerCaseHistoryScreen> {
  List<Map<String, dynamic>> _items = [];
  String? _error;
  bool _loading = true;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!widget.repository.isManager) {
      setState(() => _loading = false);
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await widget.repository
          .get('/customers/${widget.customerId}/history');
      if (mounted) setState(() => _items = caseRows(response['items']));
    } catch (e) {
      if (mounted) setState(() => _error = userMessage(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: Text(widget.name)),
      body: !widget.repository.isManager
          ? const Center(child: Text('دسترسی مجاز نیست'))
          : ListView(padding: const EdgeInsets.all(16), children: [
              if (_loading) const LinearProgressIndicator(),
              if (_error != null) CaseError(_error!, retry: _load),
              if (!_loading && _error == null && _items.isEmpty)
                const EmptyState(title: 'پرونده‌ای ثبت نشده است'),
              for (final item in _items)
                ListTile(
                    title: Text(item['title']?.toString() ?? 'پرونده'),
                    subtitle: Text(statusLabels[item['status']] ??
                        item['status']?.toString() ??
                        ''),
                    trailing: const Icon(Icons.chevron_left),
                    onTap: () async {
                      await Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => CaseDetailScreen(
                                  caseId: item['id'].toString(),
                                  repository: widget.repository)));
                      if (mounted) _load();
                    }),
            ]));
}
