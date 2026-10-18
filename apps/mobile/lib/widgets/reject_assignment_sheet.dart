import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/case_repository.dart';
import 'case_widgets.dart';

Future<bool?> showRejectAssignment(BuildContext context, String caseId,
        {CaseRepository repository = const CaseRepository()}) =>
    showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        isDismissible: false,
        enableDrag: false,
        builder: (_) => _RejectSheet(caseId: caseId, repository: repository));

class _RejectSheet extends StatefulWidget {
  final String caseId;
  final CaseRepository repository;
  const _RejectSheet({required this.caseId, required this.repository});
  @override
  State<_RejectSheet> createState() => _RejectSheetState();
}

class _RejectSheetState extends State<_RejectSheet> {
  final _reason = TextEditingController();
  final _form = GlobalKey<FormState>();
  bool _busy = false, _exit = false;
  String? _error;
  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _leave() async {
    if (_busy) return;
    if (_reason.text.isNotEmpty && !await confirmDiscard(context)) return;
    if (!mounted) return;
    setState(() => _exit = true);
    await WidgetsBinding.instance.endOfFrame;
    if (mounted) Navigator.pop(context, false);
  }

  Future<void> _submit() async {
    if (_busy || !_form.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final response = await widget.repository.post(
          '/cases/${widget.caseId}/reject', {'reason': _reason.text.trim()});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(response?['message']?.toString() ?? 'ارجاع رد شد')));
      setState(() => _exit = true);
      await WidgetsBinding.instance.endOfFrame;
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => _error = userMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
      canPop: _exit,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _leave();
      },
      child: SafeArea(
          child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                  16, 20, 16, MediaQuery.viewInsetsOf(context).bottom + 16),
              child: Form(
                  key: _form,
                  child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text('رد ارجاع',
                            style: TextStyle(
                                fontSize: 20, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 16),
                        TextFormField(
                            controller: _reason,
                            autofocus: true,
                            enabled: !_busy,
                            minLines: 3,
                            maxLines: null,
                            maxLength: 1000,
                            decoration:
                                const InputDecoration(labelText: 'دلیل رد *'),
                            validator: (v) => (v ?? '').trim().length < 3
                                ? 'حداقل ۳ کاراکتر بنویسید'
                                : (v!.trim().length > 1000
                                    ? 'حداکثر ۱۰۰۰ کاراکتر'
                                    : null)),
                        if (_error != null) CaseError(_error!),
                        FilledButton(
                            onPressed: _busy ? null : _submit,
                            child:
                                Text(_busy ? 'در حال ثبت…' : 'ثبت رد ارجاع')),
                        TextButton(
                            onPressed: _busy ? null : _leave,
                            child: const Text('انصراف')),
                      ])))));
}
