import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
import 'common.dart';

class MessagingSettingsPanel extends StatefulWidget {
  final bool isManager;
  const MessagingSettingsPanel({super.key, required this.isManager});

  @override
  State<MessagingSettingsPanel> createState() => _MessagingSettingsPanelState();
}

class _MessagingSettingsPanelState extends State<MessagingSettingsPanel> {
  Map<String, dynamic>? _personal;
  Map<String, dynamic>? _company;
  bool _loading = true;
  bool _saving = false;
  String? _error;

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
      final values = await Future.wait<dynamic>([
        AuthService.instance.get('/messaging/settings/me'),
        if (widget.isManager)
          AuthService.instance.get('/messaging/settings/company'),
      ]);
      if (!mounted) return;
      setState(() {
        _personal = Map<String, dynamic>.from(values[0] as Map);
        _company = widget.isManager
            ? Map<String, dynamic>.from(values[1] as Map)
            : null;
      });
    } catch (error) {
      if (mounted) setState(() => _error = userMessage(error));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _choice(Object? value) => value == null
      ? 'inherit'
      : value == true
          ? 'on'
          : 'off';

  bool? _value(String value) => value == 'inherit' ? null : value == 'on';

  String _label(Object? channel) => channel == 'TELEGRAM' ? 'تلگرام' : 'بله';

  List<Map<String, dynamic>> _channels(Map<String, dynamic> source) =>
      (source['channels'] as List<dynamic>? ?? const [])
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();

  void _updateChannel(
    Map<String, dynamic> source,
    String channel,
    bool? value,
  ) {
    final channels = _channels(source);
    final index = channels.indexWhere((item) => item['channel'] == channel);
    if (index >= 0) channels[index]['notificationEnabled'] = value;
    source['channels'] = channels;
  }

  Future<void> _savePersonal() async {
    if (_personal == null || _saving) return;
    setState(() => _saving = true);
    try {
      await AuthService.instance.patch('/messaging/settings/me', {
        'channels': _channels(_personal!)
            .map(
              (item) => {
                'channel': item['channel'],
                'notificationEnabled': item['notificationEnabled'],
              },
            )
            .toList(),
        'otpChannel': _personal!['otpChannel'],
      });
      if (mounted) _message('ترجیحات پیام‌رسان ذخیره شد.');
      await _load();
    } catch (error) {
      if (mounted) _message(userMessage(error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _saveCompany() async {
    if (_company == null || _saving) return;
    setState(() => _saving = true);
    try {
      await AuthService.instance.patch('/messaging/settings/company', {
        'channels': _channels(_company!)
            .map(
              (item) => {
                'channel': item['channel'],
                'notificationEnabled': item['notificationEnabled'],
              },
            )
            .toList(),
      });
      if (mounted) _message('سیاست پیام‌رسان شرکت ذخیره شد.');
      await _load();
    } catch (error) {
      if (mounted) _message(userMessage(error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const PremiumPanel(
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null || _personal == null) {
      return PremiumPanel(
        child: ErrorState(
          message: _error ?? 'تنظیمات پیام‌رسان در دسترس نیست.',
          onRetry: _load,
        ),
      );
    }
    return PremiumPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'تنظیمات پیام‌رسان‌ها',
            style: TextStyle(
              color: FollowaColors.ink,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 3),
          const Text(
            'ترجیحات اعلان و کانال کد یکبارمصرف',
            style: TextStyle(color: FollowaColors.soft, fontSize: 9.5),
          ),
          if (widget.isManager && _company != null) ...[
            const SizedBox(height: 16),
            const Text(
              'سیاست اعلان شرکت',
              style: TextStyle(
                color: FollowaColors.muted,
                fontSize: 11,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            for (final row in _channels(_company!))
              _preferenceRow(
                row,
                (value) => setState(
                  () => _updateChannel(
                    _company!,
                    row['channel'].toString(),
                    value,
                  ),
                ),
              ),
            Align(
              alignment: Alignment.centerLeft,
              child: FilledButton.tonal(
                onPressed: _saving ? null : _saveCompany,
                child: const Text('ذخیره سیاست شرکت'),
              ),
            ),
          ],
          const SizedBox(height: 16),
          const Divider(color: FollowaColors.border),
          const SizedBox(height: 10),
          const Text(
            'ترجیحات شخصی',
            style: TextStyle(
              color: FollowaColors.muted,
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          for (final row in _channels(_personal!))
            _preferenceRow(
              row,
              (value) => setState(
                () => _updateChannel(
                  _personal!,
                  row['channel'].toString(),
                  value,
                ),
              ),
            ),
          DropdownButtonFormField<String?>(
            initialValue: _personal!['otpChannel']?.toString(),
            decoration: const InputDecoration(
              labelText: 'پیام‌رسان کد یکبارمصرف',
            ),
            items: [
              const DropdownMenuItem<String?>(
                value: null,
                child: Text('تنظیم نشده'),
              ),
              for (final row in _channels(_personal!)
                  .where((item) => item['otpAvailable'] == true))
                DropdownMenuItem<String?>(
                  value: row['channel'].toString(),
                  child: Text(_label(row['channel'])),
                ),
            ],
            onChanged: (value) =>
                setState(() => _personal!['otpChannel'] = value),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _savePersonal,
              child: Text(_saving ? 'در حال ذخیره…' : 'ذخیره ترجیحات شخصی'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _preferenceRow(
    Map<String, dynamic> row,
    ValueChanged<bool?> onChanged,
  ) {
    final connected = row['connected'];
    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _label(row['channel']),
                  style: const TextStyle(
                    color: FollowaColors.ink,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'وضعیت: ${row['effective'] == true ? 'مجاز' : 'غیرفعال'}'
                  '${connected == null ? '' : connected == true ? ' · متصل' : ' · متصل نیست'}',
                  style: const TextStyle(
                    color: FollowaColors.soft,
                    fontSize: 8.5,
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            width: 138,
            child: DropdownButtonFormField<String>(
              initialValue: _choice(row['notificationEnabled']),
              isDense: true,
              items: const [
                DropdownMenuItem(value: 'inherit', child: Text('ارث‌بری')),
                DropdownMenuItem(value: 'on', child: Text('فعال')),
                DropdownMenuItem(value: 'off', child: Text('غیرفعال')),
              ],
              onChanged: (choice) {
                if (choice != null) onChanged(_value(choice));
              },
            ),
          ),
        ],
      ),
    );
  }

  void _message(String text) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }
}
