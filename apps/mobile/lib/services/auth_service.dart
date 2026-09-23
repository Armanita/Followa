import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app_error.dart';
import 'upload_policy.dart';

class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  static const String baseUrl = String.fromEnvironment(
    'FOLLOWA_API',
    defaultValue: 'https://api.followa.ir/api/v1',
  );
  static const bool debugLoggingEnabled = bool.fromEnvironment(
    'FOLLOWA_DEBUG_LOGGING',
    defaultValue: false,
  );

  static const _tokenKey = 'followa_token';
  static const _userKey = 'followa_user';
  static const _secureStorage = FlutterSecureStorage();

  String? _token;
  Map<String, dynamic>? _user;
  Future<void> Function()? onSessionInvalidated;

  String? get token => _token;
  Map<String, dynamic>? get user => _user;
  bool get isManager => _user?['role'] == 'COMPANY_MANAGER';
  String get fullName =>
      '${_user?['firstName'] ?? ''} ${_user?['lastName'] ?? ''}'.trim();

  Uri _uri(String path) => Uri.parse(
        '${baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl}${path.startsWith('/') ? path : '/$path'}',
      );

  void _debug(String message) {
    if (debugLoggingEnabled) debugPrint('[Followa API] $message');
  }

  Future<void> _loadPersistedSession() async {
    if (_token != null && _user != null) return;

    var token = await _secureStorage.read(key: _tokenKey);
    var rawUser = await _secureStorage.read(key: _userKey);

    // One-time migration from the previous SharedPreferences session storage.
    final preferences = await SharedPreferences.getInstance();
    token ??= preferences.getString(_tokenKey);
    rawUser ??= preferences.getString(_userKey);
    if (token != null) await _secureStorage.write(key: _tokenKey, value: token);
    if (rawUser != null) {
      await _secureStorage.write(key: _userKey, value: rawUser);
    }
    await preferences.remove(_tokenKey);
    await preferences.remove(_userKey);

    _token = token;
    if (rawUser != null && rawUser.isNotEmpty) {
      try {
        _user = jsonDecode(rawUser) as Map<String, dynamic>;
      } catch (_) {
        _user = null;
      }
    }
    if (_token == null || _user == null) {
      _token = null;
      _user = null;
    }
  }

  Future<bool> hasToken() async {
    await _loadPersistedSession();
    return _token != null && _user != null;
  }

  Future<bool> restoreSession() async {
    await _loadPersistedSession();
    if (_token == null || _user == null) return false;
    try {
      await get('/profile');
      return true;
    } on ApiException catch (error) {
      if (error.statusCode == 401) return false;
      return true;
    } catch (_) {
      // Keep a valid cached session during temporary connectivity failures.
      return true;
    }
  }

  Future<void> saveSession(String token, Map<String, dynamic> user) async {
    _token = token;
    _user = user;
    await _secureStorage.write(key: _tokenKey, value: token);
    await _secureStorage.write(key: _userKey, value: jsonEncode(user));
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    await _secureStorage.delete(key: _tokenKey);
    await _secureStorage.delete(key: _userKey);
    final preferences = await SharedPreferences.getInstance();
    await preferences.remove(_tokenKey);
    await preferences.remove(_userKey);
  }

  Future<Map<String, String>> _headers({bool json = true}) async {
    await _loadPersistedSession();
    return {
      if (_token != null) 'authorization': 'Bearer $_token',
      if (json) 'content-type': 'application/json',
    };
  }

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, [Object? body]) =>
      _send('POST', path, body);
  Future<dynamic> patch(String path, [Object? body]) =>
      _send('PATCH', path, body);

  Future<dynamic> _send(String method, String path, [Object? body]) async {
    try {
      final request = http.Request(method, _uri(path))
        ..headers.addAll(await _headers(json: body != null));
      if (body != null) request.body = jsonEncode(body);
      _debug('$method $path');
      final response =
          await request.send().timeout(const Duration(seconds: 25));
      final text = await response.stream.bytesToString();
      final decoded = _decode(text);
      _debug('$method $path -> ${response.statusCode}');
      if (response.statusCode >= 400) {
        await _throwApiError(response.statusCode, decoded);
      }
      return decoded;
    } on ApiException {
      rethrow;
    } catch (error) {
      _debug('$method $path -> transport failure (${error.runtimeType})');
      throw safeTransportError(error);
    }
  }

  dynamic _decode(String text) {
    if (text.isEmpty) return null;
    try {
      return jsonDecode(text);
    } catch (_) {
      return text;
    }
  }

  Future<Never> _throwApiError(int statusCode, dynamic decoded) async {
    final code = decoded is Map && decoded['code'] != null
        ? decoded['code'].toString()
        : 'ERROR';
    final hadAuthenticatedSession = _token != null;
    if (statusCode == 401 && hadAuthenticatedSession) {
      await logout();
      await onSessionInvalidated?.call();
    }
    throw ApiException(
      statusCode: statusCode,
      code: code,
      message: safeApiMessage(statusCode, code),
    );
  }

  Future<dynamic> uploadBytes(
    String path, {
    required String fieldName,
    required String filename,
    required Uint8List bytes,
  }) async {
    UploadPolicy.validate(filename, bytes);
    try {
      final contentType = UploadPolicy.mimeTypeFor(filename);
      final request = http.MultipartRequest('POST', _uri(path))
        ..headers.addAll(await _headers(json: false))
        ..files.add(
          http.MultipartFile.fromBytes(
            fieldName,
            bytes,
            filename: filename,
            contentType:
                contentType == null ? null : MediaType.parse(contentType),
          ),
        );
      _debug('POST $path (multipart, ${bytes.length} bytes)');
      final response =
          await request.send().timeout(const Duration(seconds: 60));
      final text = await response.stream.bytesToString();
      final decoded = _decode(text);
      _debug('POST $path -> ${response.statusCode}');
      if (response.statusCode >= 400) {
        await _throwApiError(response.statusCode, decoded);
      }
      return decoded;
    } on ApiException {
      rethrow;
    } catch (error) {
      _debug('POST $path -> upload failure (${error.runtimeType})');
      throw safeTransportError(error);
    }
  }

  Future<ApiBinary> download(String path) async {
    try {
      final request = http.Request('GET', _uri(path))
        ..headers.addAll(await _headers(json: false));
      _debug('GET $path (binary)');
      final response =
          await request.send().timeout(const Duration(seconds: 60));
      final bytes = await response.stream.toBytes();
      _debug('GET $path -> ${response.statusCode}');
      if (response.statusCode >= 400) {
        final text = utf8.decode(bytes, allowMalformed: true);
        await _throwApiError(response.statusCode, _decode(text));
      }
      final disposition = response.headers['content-disposition'] ?? '';
      return ApiBinary(
        bytes: Uint8List.fromList(bytes),
        contentType:
            response.headers['content-type'] ?? 'application/octet-stream',
        filename: _filenameFromDisposition(disposition),
      );
    } on ApiException {
      rethrow;
    } catch (error) {
      _debug('GET $path -> download failure (${error.runtimeType})');
      throw safeTransportError(error);
    }
  }

  String? _filenameFromDisposition(String value) {
    final utf8Match = RegExp(
      r"filename\*=UTF-8''([^;]+)",
      caseSensitive: false,
    ).firstMatch(value);
    if (utf8Match != null) return Uri.decodeComponent(utf8Match.group(1)!);
    final match = RegExp(
      r'filename="?([^";]+)"?',
      caseSensitive: false,
    ).firstMatch(value);
    return match?.group(1);
  }

  Future<void> login(String mobile, String password) async {
    try {
      final res = await post('/auth/login', {
        'mobile': mobile,
        'password': password,
      });
      await saveSession(
        res['token'] as String,
        res['user'] as Map<String, dynamic>,
      );
    } on ApiException catch (error) {
      if (error.statusCode == 401) {
        throw const AppError(
          'خطا در ورود\nاطلاعات وارد شده صحیح نیست',
          statusCode: 401,
          code: 'INVALID_LOGIN',
        );
      }
      rethrow;
    }
  }

  Future<void> requestOtp(String mobile) async {
    await post('/auth/otp/request', {'mobile': mobile});
  }

  Future<String> verifyOtp(String mobile, String code) async {
    final res = await post('/auth/otp/verify', {
      'mobile': mobile,
      'code': code,
    });
    return res['resetToken'] as String;
  }

  Future<void> createPassword(
    String mobile,
    String resetToken,
    String password,
  ) async {
    await post('/auth/password', {
      'mobile': mobile,
      'resetToken': resetToken,
      'password': password,
    });
    await login(mobile, password);
  }

  Future<void> requestPasswordReset(String mobile) async {
    await post('/auth/forgot-password/request', {'mobile': mobile});
  }

  Future<String> verifyPasswordReset(String mobile, String code) async {
    final res = await post('/auth/forgot-password/verify', {
      'mobile': mobile,
      'code': code,
    });
    return res['resetToken'] as String;
  }

  Future<void> resetPassword(
    String mobile,
    String resetToken,
    String password,
  ) async {
    await post('/auth/forgot-password/reset', {
      'mobile': mobile,
      'resetToken': resetToken,
      'password': password,
    });
  }

  Future<void> changePassword(
    String currentPassword,
    String newPassword,
  ) async {
    await post('/auth/change-password', {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }
}

class ApiBinary {
  final Uint8List bytes;
  final String contentType;
  final String? filename;
  const ApiBinary({
    required this.bytes,
    required this.contentType,
    required this.filename,
  });
}

class ApiException extends AppError {
  const ApiException({
    required int statusCode,
    required String code,
    required String message,
  }) : super(message, statusCode: statusCode, code: code);

  bool get isUnauthorized => statusCode == 401;
}

String userMessage(Object error) => safeTransportError(error).message;
