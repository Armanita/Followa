import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/app_error.dart';
import '../services/case_repository.dart';
import '../services/case_drafts.dart';
import '../utils/jalali_input.dart';
import '../widgets/case_widgets.dart';
import '../widgets/jalali_date_field.dart';
import 'case_history_screen.dart';

class ResultComposerScreen extends StatefulWidget {
  final Map<String, dynamic> caseData;
  final Map<String, dynamic>? reminder;
  final CaseRepository repository;
  const ResultComposerScreen(
      {super.key,
      required this.caseData,
      this.reminder,
      this.repository = const CaseRepository()});
  @override
  State<ResultComposerScreen> createState() => _ResultComposerScreenState();
}

class _ResultComposerScreenState extends State<ResultComposerScreen> {
  final _form = GlobalKey<FormState>();
  final _focusNodes = List.generate(5, (_) => FocusNode());
  final _fields = List.generate(5, (_) => GlobalKey<FormFieldState<String>>());
  late final ResultDraft _draft;
  late final List<TextEditingController> _inputs;
  bool _saving = false,
      _allowExit = false,
      _attempted = false,
      _blocked = false;
  bool _edited = false;
  String? _error;
  String get _id => widget.caseData['id'].toString();
  CaseRepository get _repo => widget.repository;
  bool get _dirty => _edited || _draft.dirty;

  @override
  void initState() {
    super.initState();
    _draft = CaseDrafts.obtain(_repo.userId, _id);
    _inputs = [
      _draft.result,
      _draft.effort,
      _draft.date,
      _draft.time,
      _draft.note
    ].map((text) => TextEditingController(text: text)).toList();
    for (final input in _inputs) {
      input.addListener(_sync);
    }
  }

  void _sync() {
    _draft.touched = true;
    _draft.result = _inputs[0].text;
    _draft.effort = _inputs[1].text;
    _draft.date = _inputs[2].text;
    _draft.time = _inputs[3].text;
    _draft.note = _inputs[4].text;
    if (mounted) setState(() => _edited = true);
  }

  @override
  void dispose() {
    for (final node in _focusNodes) {
      node.dispose();
    }
    for (final input in _inputs) {
      input.dispose();
    }
    super.dispose();
  }

  Future<void> _pop([bool? saved]) async {
    setState(() => _allowExit = true);
    await WidgetsBinding.instance.endOfFrame;
    if (mounted) Navigator.pop(context, saved);
  }

  Future<void> _leave() async {
    if (_saving) return;
    if (!_dirty) {
      await _pop();
      return;
    }
    final choice = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
                title: const Text('نتیجه هنوز ثبت نشده است'),
                content: const Text(
                    'با نوشته‌های این پرونده چه کنیم؟ پیش‌نویس فقط در همین نشست برنامه نگه داشته می‌شود.'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('ادامه ویرایش')),
                  TextButton(
                      onPressed: () => Navigator.pop(ctx, 'keep'),
                      child: const Text('نگه‌داشتن پیش‌نویس')),
                  TextButton(
                      onPressed: () => Navigator.pop(ctx, 'discard'),
                      child: const Text('حذف پیش‌نویس'))
                ]));
    if (!mounted || choice == null) return;
    if (choice == 'discard') CaseDrafts.remove(_repo.userId, _id);
    await _pop();
  }

  Future<void> _save() async {
    if (_saving || _blocked || _draft.uncertain) return;
    setState(() => _attempted = true);
    if (!_form.currentState!.validate()) {
      for (final key in _fields) {
        if (key.currentState?.hasError == true) {
          _focusNodes[_fields.indexOf(key)].requestFocus();
          await Scrollable.ensureVisible(key.currentContext!,
              duration: const Duration(milliseconds: 200), alignment: .15);
          break;
        }
      }
      return;
    }
    Map<String, dynamic> body;
    try {
      body = _draft.payload();
    } on FormatException catch (error) {
      setState(() => _error = error.message);
      return;
    }
    if (_draft.complete) {
      final yes = await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
                  title: const Text('پرونده تکمیل شود؟'),
                  content: const Text(
                      'نتیجه ثبت می‌شود و وضعیت پرونده به «تکمیل شده» تغییر می‌کند. یادآوری‌های فعال شما برای این پرونده انجام‌شده می‌شوند.'),
                  actions: [
                    TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text('بازگشت به ویرایش')),
                    TextButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text('ثبت نتیجه و تکمیل پرونده'))
                  ]));
      if (yes != true || !mounted) return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    var posting = false;
    try {
      final fresh =
          Map<String, dynamic>.from(await _repo.get('/cases/$_id') as Map);
      if (!CaseAccess(fresh, _repo.isManager, _repo.userId).execute) {
        if (mounted) {
          setState(() {
            _blocked = true;
            _error =
                'وضعیت یا مسئول پرونده تغییر کرده است. نوشته شما محفوظ است؛ می‌توانید آن را کپی کنید و به پرونده برگردید.';
          });
        }
        return;
      }
      posting = true;
      await _repo.post('/cases/$_id/result', body);
      CaseDrafts.remove(_repo.userId, _id);
      if (mounted) await _pop(true);
    } catch (error) {
      if (!mounted) return;
      final definite = error is AppError &&
          error.statusCode != null &&
          error.statusCode! < 500;
      setState(() {
        _draft.uncertain = posting && !definite;
        _error = _draft.uncertain
            ? 'وضعیت ثبت مشخص نیست. پیش از تلاش دوباره، پرونده را بررسی کنید.'
            : userMessage(error);
      });
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _checkOutcome() async {
    await Navigator.push(
        context,
        MaterialPageRoute(
            builder: (_) => CaseHistoryScreen(caseId: _id, repository: _repo)));
    if (!mounted) return;
    final decision = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
                title: const Text('وضعیت نتیجه را بررسی کردید؟'),
                content: const Text(
                    'ارسال دوباره ممکن است یک نتیجه تکراری ایجاد کند. فقط اگر از ثبت‌نشدن مطمئن هستید دوباره تلاش کنید.'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('هنوز مشخص نیست')),
                  TextButton(
                      onPressed: () => Navigator.pop(ctx, 'saved'),
                      child: const Text('ثبت شده است')),
                  TextButton(
                      onPressed: () => Navigator.pop(ctx, 'retry'),
                      child: const Text('ثبت نشده؛ اجازه تلاش دوباره'))
                ]));
    if (!mounted) return;
    if (decision == 'saved') {
      CaseDrafts.remove(_repo.userId, _id);
      await _pop(true);
    }
    if (decision == 'retry') {
      setState(() {
        _draft.uncertain = false;
        _error = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final allowed =
        CaseAccess(widget.caseData, _repo.isManager, _repo.userId).execute;
    if (!allowed) {
      return Scaffold(
          appBar: AppBar(title: const Text('ثبت نتیجه')),
          body: const Center(
              child: Text('ثبت نتیجه برای شما در این پرونده مجاز نیست.')));
    }
    return PopScope(
        canPop: _allowExit || (!_dirty && !_saving),
        onPopInvokedWithResult: (didPop, result) {
          if (!didPop) _leave();
        },
        child: Scaffold(
          appBar: AppBar(
              title: const Text('ثبت نتیجه'),
              leading: BackButton(onPressed: _leave)),
          body: Form(
              key: _form,
              autovalidateMode: _attempted
                  ? AutovalidateMode.onUserInteraction
                  : AutovalidateMode.disabled,
              child: ListView(padding: const EdgeInsets.all(16), children: [
                Text(
                    'پرونده #${widget.caseData['number'] ?? '—'} · ${widget.caseData['title'] ?? ''}',
                    style: const TextStyle(fontSize: 14)),
                if (widget.reminder != null)
                  CaseSection(
                      title: 'پیگیری موردنظر',
                      child: Text(widget.reminder!['note']?.toString() ??
                          'بدون یادداشت')),
                const SizedBox(height: 16),
                TextFormField(
                    key: _fields[0],
                    focusNode: _focusNodes[0],
                    controller: _inputs[0],
                    enabled: !_saving,
                    autofocus: true,
                    minLines: 6,
                    maxLines: null,
                    textDirection: TextDirection.rtl,
                    maxLength: 5000,
                    decoration: const InputDecoration(
                        labelText: 'نتیجه پیگیری *',
                        hintText: 'چه اقدامی انجام شد و نتیجه چه بود؟',
                        alignLabelWithHint: true),
                    validator: (v) => (v ?? '').trim().length < 2
                        ? 'حداقل ۲ کاراکتر بنویسید'
                        : (v!.trim().length > 5000
                            ? 'حداکثر ۵۰۰۰ کاراکتر'
                            : null)),
                const SizedBox(height: 16),
                TextFormField(
                    key: _fields[1],
                    focusNode: _focusNodes[1],
                    controller: _inputs[1],
                    enabled: !_saving,
                    keyboardType: TextInputType.number,
                    textDirection: TextDirection.ltr,
                    decoration: const InputDecoration(
                        labelText: 'زمان صرف‌شده برای این پیگیری *',
                        suffixText: 'دقیقه',
                        helperText: 'بین ۱ تا ۱۴۴۰ دقیقه'),
                    validator: (v) {
                      final n =
                          int.tryParse(JalaliInput.normalizeDigits(v ?? ''));
                      return n == null || n < 1 || n > 1440
                          ? 'بین ۱ تا ۱۴۴۰ دقیقه وارد کنید'
                          : null;
                    }),
                CaseSection(
                    title: 'وضعیت پس از ثبت',
                    child: Column(children: [
                      for (final complete in [false, true])
                        ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: Icon(_draft.complete == complete
                                ? Icons.radio_button_checked
                                : Icons.radio_button_off),
                            title: Text(complete
                                ? 'پرونده تکمیل شود'
                                : 'پیگیری ادامه دارد'),
                            onTap: _saving
                                ? null
                                : () => setState(() {
                                      _draft.complete = complete;
                                      _draft.touched = true;
                                      _edited = true;
                                    })),
                    ])),
                if (_draft.complete)
                  const Text(
                      'با تکمیل پرونده، یادآوری جدیدی در این ثبت ایجاد نمی‌شود.')
                else ...[
                  CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('افزودن یادآوری بعدی'),
                      value: _draft.reminder,
                      onChanged: _saving
                          ? null
                          : (v) => setState(() {
                                _draft.reminder = v ?? false;
                                _draft.touched = true;
                                _edited = true;
                              })),
                  if (_draft.reminder) ...[
                    TextFormField(
                        key: _fields[2],
                        focusNode: _focusNodes[2],
                        controller: _inputs[2],
                        enabled: !_saving,
                        textDirection: TextDirection.ltr,
                        decoration: InputDecoration(
                            labelText: 'تاریخ پیگیری شمسی *',
                            hintText: '۱۴۰۵/۰۶/۰۷',
                            suffixIcon: IconButton(
                                tooltip: 'انتخاب تاریخ شمسی',
                                onPressed: _saving
                                    ? null
                                    : () async {
                                        FocusScope.of(context).unfocus();
                                        final value = await pickCaseJalaliDate(
                                            context, _inputs[2].text);
                                        if (value != null) {
                                          _inputs[2].text = value;
                                        }
                                      },
                                icon: const Icon(Icons.calendar_month))),
                        validator: (v) {
                          try {
                            JalaliInput.parseDateTime(v ?? '', '09:00');
                            return null;
                          } catch (_) {
                            return 'تاریخ شمسی معتبر وارد کنید';
                          }
                        }),
                    const SizedBox(height: 12),
                    TextFormField(
                        key: _fields[3],
                        focusNode: _focusNodes[3],
                        controller: _inputs[3],
                        enabled: !_saving,
                        textDirection: TextDirection.ltr,
                        decoration: InputDecoration(
                            labelText: 'ساعت *',
                            suffixIcon: IconButton(
                                tooltip: 'انتخاب ساعت',
                                onPressed: _saving
                                    ? null
                                    : () async {
                                        FocusScope.of(context).unfocus();
                                        final value = await showTimePicker(
                                            context: context,
                                            initialTime: const TimeOfDay(
                                                hour: 9, minute: 0));
                                        if (value != null) {
                                          _inputs[3].text =
                                              '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';
                                        }
                                      },
                                icon: const Icon(Icons.schedule))),
                        validator: (v) {
                          final parts =
                              JalaliInput.normalizeDigits(v ?? '').split(':');
                          final h = int.tryParse(parts.first);
                          final m = parts.length == 2
                              ? int.tryParse(parts.last)
                              : null;
                          if (h == null ||
                              m == null ||
                              h < 0 ||
                              h > 23 ||
                              m < 0 ||
                              m > 59) {
                            return 'ساعت معتبر وارد کنید';
                          }
                          try {
                            if (JalaliInput.parseDateTime(_inputs[2].text, v!)
                                .isBefore(DateTime.now()
                                    .subtract(const Duration(minutes: 1)))) {
                              return 'زمان یادآوری نمی‌تواند در گذشته باشد';
                            }
                          } catch (_) {}
                          return null;
                        }),
                    const SizedBox(height: 12),
                    TextFormField(
                        key: _fields[4],
                        focusNode: _focusNodes[4],
                        controller: _inputs[4],
                        enabled: !_saving,
                        minLines: 2,
                        maxLines: null,
                        maxLength: 1000,
                        decoration: const InputDecoration(
                            labelText: 'یادداشت پیگیری (اختیاری)'),
                        validator: (v) => (v ?? '').trim().length > 1000
                            ? 'حداکثر ۱۰۰۰ کاراکتر'
                            : null),
                  ],
                ],
                const CaseSection(
                    title: 'پیامد ثبت',
                    child: Text(
                        'با ثبت این نتیجه، یادآوری‌های فعال شما برای این پرونده انجام‌شده می‌شوند. یادآوری‌های دیگران با این اقدام انجام‌شده نمی‌شوند.')),
                if (!_draft.complete && _draft.reminder)
                  Text(
                      'یادآوری بعدی برای ${_draft.date} ساعت ${_draft.time} ثبت می‌شود.'),
                if (_error != null) CaseError(_error!),
                if (_draft.uncertain)
                  TextButton(
                      onPressed: _saving ? null : _checkOutcome,
                      child: const Text('بررسی وضعیت پرونده')),
              ])),
          bottomNavigationBar: Padding(
              padding: EdgeInsets.only(
                  bottom: MediaQuery.viewInsetsOf(context).bottom),
              child: CaseActionBar(
                  child: FilledButton(
                      onPressed: _saving || _blocked || _draft.uncertain
                          ? null
                          : _save,
                      child: Text(_saving
                          ? 'در حال ثبت…'
                          : _draft.complete
                              ? 'ثبت نتیجه و تکمیل پرونده'
                              : _draft.reminder
                                  ? 'ثبت نتیجه و یادآوری'
                                  : 'ثبت نتیجه')))),
        ));
  }
}
