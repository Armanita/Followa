import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/case_repository.dart';
import '../widgets/case_widgets.dart';

class CaseTransferScreen extends StatefulWidget {
  final Map<String, dynamic> caseData;
  final CaseRepository repository;
  const CaseTransferScreen(
      {super.key,
      required this.caseData,
      this.repository = const CaseRepository()});
  @override
  State<CaseTransferScreen> createState() => _CaseTransferScreenState();
}

class _CaseTransferScreenState extends State<CaseTransferScreen> {
  List<Map<String, dynamic>> _candidates = [];
  Map<String, dynamic>? _selected;
  final _note = TextEditingController();
  String _query = '';
  String? _error;
  bool _loading = true, _saving = false, _exit = false;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await widget.repository.get('/members/transfer-candidates');
      if (mounted) setState(() => _candidates = caseRows(r['items']));
    } catch (e) {
      if (mounted) setState(() => _error = userMessage(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _leave() async {
    if (_saving) return;
    if ((_selected != null || _note.text.isNotEmpty) &&
        !await confirmDiscard(context)) {
      return;
    }
    if (!mounted) return;
    setState(() => _exit = true);
    await WidgetsBinding.instance.endOfFrame;
    if (mounted) Navigator.pop(context);
  }

  Future<void> _submit() async {
    if (_saving || _selected == null) return;
    if (_note.text.trim().length > 1000) {
      setState(() => _error = 'توضیح حداکثر ۱۰۰۰ کاراکتر است');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.repository.post('/cases/${widget.caseData['id']}/transfer', {
        'toUserId': _selected!['userId'],
        if (_note.text.trim().isNotEmpty) 'note': _note.text.trim()
      });
      if (!mounted) return;
      setState(() => _exit = true);
      await WidgetsBinding.instance.endOfFrame;
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = userMessage(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final allowed = CaseAccess(widget.caseData, widget.repository.isManager,
            widget.repository.userId)
        .transfer;
    return PopScope(
        canPop: _exit,
        onPopInvokedWithResult: (didPop, _) {
          if (!didPop) _leave();
        },
        child: Scaffold(
            appBar: AppBar(
                title: const Text('انتقال پرونده'),
                leading: BackButton(onPressed: _leave)),
            body: !allowed
                ? const Center(child: Text('انتقال پرونده برای شما مجاز نیست.'))
                : ListView(padding: const EdgeInsets.all(16), children: [
                    Text(
                        'پرونده #${widget.caseData['number'] ?? '—'} · ${widget.caseData['title']}'),
                    const SizedBox(height: 16),
                    TextField(
                        enabled: !_saving,
                        decoration: const InputDecoration(
                            labelText: 'جستجوی همکار',
                            prefixIcon: Icon(Icons.search)),
                        onChanged: (v) => setState(() => _query = v.trim())),
                    if (_loading) const LinearProgressIndicator(),
                    if (_error != null)
                      CaseError(_error!,
                          retry: _candidates.isEmpty ? _load : null),
                    if (!_loading && _error == null && _candidates.isEmpty)
                      const Text('همکار واجد شرایطی برای انتقال وجود ندارد.'),
                    for (final candidate in _candidates.where((e) =>
                        '${e['fullName']} ${e['jobTitle'] ?? ''}'
                            .contains(_query)))
                      ListTile(
                          title: Text(personName(candidate)),
                          subtitle:
                              Text(candidate['jobTitle']?.toString() ?? ''),
                          leading: Icon(
                              _selected?['userId'] == candidate['userId']
                                  ? Icons.radio_button_checked
                                  : Icons.radio_button_off),
                          onTap: _saving
                              ? null
                              : () => setState(() => _selected = candidate)),
                    if (_selected != null)
                      Text('گیرنده انتخاب‌شده: ${personName(_selected)}'),
                    const SizedBox(height: 12),
                    TextField(
                        controller: _note,
                        enabled: !_saving,
                        minLines: 3,
                        maxLines: null,
                        maxLength: 1000,
                        decoration: const InputDecoration(
                            labelText: 'توضیح انتقال (اختیاری)')),
                    const Text(
                        'پرونده تا پذیرش گیرنده در وضعیت «در انتظار پذیرش» قرار می‌گیرد و مسئولیت فعلی پایان می‌یابد.'),
                  ]),
            bottomNavigationBar: !allowed
                ? null
                : CaseActionBar(
                    child: FilledButton(
                        onPressed:
                            _saving || _selected == null ? null : _submit,
                        child: Text(_saving
                            ? 'در حال ثبت…'
                            : _selected == null
                                ? 'گیرنده را انتخاب کنید'
                                : 'ارجاع به ${personName(_selected)}')))));
  }
}
