import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../services/app_error.dart';
import '../services/auth_service.dart';
import '../services/upload_policy.dart';
import '../services/case_repository.dart';
import '../widgets/case_widgets.dart';
import '../widgets/common.dart';

class CaseDocumentsScreen extends StatefulWidget {
  final String caseId;
  final CaseRepository repository;
  const CaseDocumentsScreen(
      {super.key,
      required this.caseId,
      this.repository = const CaseRepository()});
  @override
  State<CaseDocumentsScreen> createState() => _CaseDocumentsScreenState();
}

class _CaseDocumentsScreenState extends State<CaseDocumentsScreen> {
  Map<String, dynamic>? _case;
  bool _busy = false, _loading = true;
  String? _error, _pendingName;
  Uint8List? _pendingBytes;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final data = await widget.repository.get('/cases/${widget.caseId}');
      if (mounted) setState(() => _case = Map<String, dynamic>.from(data));
    } catch (e) {
      if (mounted) setState(() => _error = userMessage(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final files = caseRows(_case?['files']);
    final upload = _case != null &&
        CaseAccess(
                _case!, widget.repository.isManager, widget.repository.userId)
            .execute;
    return PopScope(
        canPop: !_busy,
        child: Scaffold(
            appBar: AppBar(title: const Text('فایل‌ها و مستندات')),
            body: RefreshIndicator(
                onRefresh: _load,
                child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(16),
                    children: [
                      if (_busy || _loading) const LinearProgressIndicator(),
                      if (_busy) const Text('در حال انتقال فایل…'),
                      if (_error != null)
                        CaseError(_error!, retry: _busy ? null : _load),
                      if (_pendingBytes != null && !_busy) ...[
                        Text('فایل آماده ارسال: $_pendingName'),
                        const Text(
                            'اگر وضعیت ارسال مشخص نیست، پیش از ارسال دوباره فهرست فایل‌ها را بررسی کنید.'),
                        TextButton(
                            onPressed: upload
                                ? () => _uploadDocument(
                                    _pendingName!, _pendingBytes!)
                                : null,
                            child: const Text('ارسال دوباره فایل')),
                        TextButton(
                            onPressed: () => setState(() {
                                  _pendingBytes = null;
                                  _pendingName = null;
                                }),
                            child: const Text('کنار گذاشتن فایل')),
                      ],
                      if (!_loading && _error == null && files.isEmpty)
                        const EmptyState(title: 'فایلی ثبت نشده است'),
                      for (final file in files)
                        ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading:
                                const Icon(Icons.insert_drive_file_outlined),
                            title: Text(file['filename']?.toString() ?? 'فایل'),
                            subtitle: Text(personName(file['uploader'])),
                            trailing: const Icon(Icons.download),
                            onTap: _busy ? null : () => _openFile(file)),
                    ])),
            bottomNavigationBar: !upload
                ? null
                : CaseActionBar(
                    child: FilledButton.icon(
                        onPressed: _busy ? null : _pickAndUpload,
                        icon: const Icon(Icons.attach_file),
                        label: const Text('پیوست فایل')))));
  }

  Future<void> _pickAndUpload() async {
    final source = await showModalBottomSheet<_DocumentSource>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.folder_open_rounded),
                title: const Text('📁 انتخاب از گالری / فایل'),
                onTap: () => Navigator.pop(ctx, _DocumentSource.file),
              ),
              ListTile(
                leading: const Icon(Icons.camera_alt_rounded),
                title: const Text('📷 گرفتن عکس با دوربین'),
                onTap: () => Navigator.pop(ctx, _DocumentSource.camera),
              ),
            ],
          ),
        ),
      ),
    );
    if (source == _DocumentSource.file) await _pickFileAndUpload();
    if (source == _DocumentSource.camera) await _captureAndUpload();
  }

  Future<void> _pickFileAndUpload() async {
    try {
      final file = await FilePicker.pickFile(
        type: FileType.custom,
        allowedExtensions: UploadPolicy.allowedExtensions.toList(),
      );
      if (file == null) return;
      final bytes = await file.readAsBytes();
      UploadPolicy.validate(file.name, bytes);
      await _uploadDocument(file.name, bytes);
    } catch (error) {
      _message(userMessage(error));
    }
  }

  Future<void> _captureAndUpload() async {
    XFile? photo;
    Uint8List? bytes;
    try {
      while (mounted) {
        if (photo == null) {
          photo = await ImagePicker().pickImage(
            source: ImageSource.camera,
            imageQuality: 82,
            maxWidth: 1920,
            maxHeight: 1920,
            requestFullMetadata: false,
          );
          if (photo == null) return;
          bytes = await photo.readAsBytes();
          final filename = UploadPolicy.extensionOf(photo.name).isEmpty
              ? 'followa-camera.jpg'
              : photo.name;
          UploadPolicy.validate(filename, bytes);
        }

        final action = await _reviewPhoto(bytes!);
        if (action == null) return;
        if (action == _PhotoAction.view) {
          if (!mounted) return;
          await showDialog<void>(
            context: context,
            builder: (_) => Dialog(
              child: InteractiveViewer(
                minScale: .5,
                maxScale: 4,
                child: Image.memory(bytes!, fit: BoxFit.contain),
              ),
            ),
          );
          continue;
        }
        if (action == _PhotoAction.retake) {
          photo = null;
          bytes = null;
          continue;
        }
        final filename = UploadPolicy.extensionOf(photo.name).isEmpty
            ? 'followa-camera.jpg'
            : photo.name;
        await _uploadDocument(filename, bytes);
        return;
      }
    } on PlatformException catch (error) {
      final denied = error.code.toLowerCase().contains('denied') ||
          error.code.toLowerCase().contains('permission');
      _message(
        denied
            ? 'دسترسی دوربین داده نشده است. آن را از تنظیمات دستگاه فعال کنید.'
            : 'باز کردن دوربین ممکن نشد. لطفاً دوباره تلاش کنید.',
      );
    } on AppError catch (error) {
      _message(error.message);
    } catch (_) {
      _message('گرفتن یا آماده‌سازی عکس ممکن نشد. لطفاً دوباره تلاش کنید.');
    }
  }

  Future<_PhotoAction?> _reviewPhoto(Uint8List bytes) {
    return showDialog<_PhotoAction>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Text('پیش‌نمایش عکس'),
        content: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: Image.memory(bytes, height: 300, fit: BoxFit.contain),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('انصراف')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, _PhotoAction.view),
            child: const Text('مشاهده'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, _PhotoAction.retake),
            child: const Text('گرفتن دوباره'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, _PhotoAction.upload),
            child: const Text('آپلود'),
          ),
        ],
      ),
    );
  }

  Future<void> _uploadDocument(String filename, Uint8List bytes) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _pendingName = filename;
      _pendingBytes = bytes;
    });
    try {
      await AuthService.instance.uploadBytes(
        '/cases/${widget.caseId}/files',
        fieldName: 'file',
        filename: filename,
        bytes: bytes,
      );
      _pendingBytes = null;
      _pendingName = null;
      _message('فایل پیوست شد');
      await _load();
    } catch (error) {
      if (mounted) setState(() => _error = userMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openFile(Map<String, dynamic> file) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final binary =
          await AuthService.instance.download('/files/${file['id']}/download');
      if (!mounted) return;
      if (binary.contentType.toLowerCase().startsWith('image/')) {
        await showDialog<void>(
            context: context,
            builder: (_) => Dialog(
                child: InteractiveViewer(
                    minScale: .5,
                    maxScale: 4,
                    child: Image.memory(binary.bytes, fit: BoxFit.contain))));
      } else {
        final saved = await FilePicker.saveFile(
            dialogTitle: 'ذخیره فایل',
            fileName: binary.filename ??
                file['filename']?.toString() ??
                'followa-file',
            bytes: binary.bytes);
        if (saved != null) _message('فایل ذخیره شد');
      }
    } catch (error) {
      _message(userMessage(error));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _message(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }
}

enum _DocumentSource { file, camera }

enum _PhotoAction { view, retake, upload }
