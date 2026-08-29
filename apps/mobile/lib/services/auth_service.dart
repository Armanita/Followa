import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  static const String baseUrl = String.fromEnvironment(
    'FOLLOWA_API',
    defaultValue: 'http://10.0.2.2:3001/api/v1',
  );

  static const _tokenKey = 'followa_token';
  static const _userKey = 'followa_user';

  String? _token;
  Map<String, dynamic>? _user;

  String? get token => _token;
  Map<String, dynamic>? get user => _user;
  bool get isManager => _user?['role'] == 'COMPANY_MANAGER';
  String get fullName =>
      '${_user?['firstName'] ?? ''} ${_user?['lastName'] ?? ''}'.trim();

  Future<void> _loadPersistedSession() async {
    if (_token != null && _user != null) return;
    final sp = await SharedPreferences.getInstance();
    _token = sp.getString(_tokenKey);
    final rawUser = sp.getString(_userKey);
    if (rawUser != null && rawUser.isNotEmpty) {
      try {
        _user = jsonDecode(rawUser) as Map<String, dynamic>;
      } catch (_) {
        _user = null;
      }
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
      return true;
    }
  }

  Future<void> saveSession(String token, Map<String, dynamic> user) async {
    _token = token;
    _user = user;
    final sp = await SharedPreferences.getInstance();
    await sp.setString(_tokenKey, token);
    await sp.setString(_userKey, jsonEncode(user));
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    final sp = await SharedPreferences.getInstance();
    await sp.remove(_tokenKey);
    await sp.remove(_userKey);
  }

  Future<Map<String, String>> _headers({bool json = true}) async {
    await _loadPersistedSession();
    return {
      if (_token != null) 'authorization': 'Bearer $_token',
      if (json) 'content-type': 'application/json',
    };
  }

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body);
  Future<dynamic> patch(String path, [Object? body]) => _send('PATCH', path, body);

  Future<dynamic> _send(String method, String path, [Object? body]) async {
    final request = http.Request(method, Uri.parse('$baseUrl$path'))
      ..headers.addAll(await _headers());
    if (body != null) request.body = jsonEncode(body);
    final response = await request.send().timeout(const Duration(seconds: 25));
    final text = await response.stream.bytesToString();
    final decoded = _decode(text);
    if (response.statusCode >= 400) {
      await _throwApiError(response.statusCode, decoded);
    }
    return decoded;
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
    final message = decoded is Map && decoded['message'] != null
        ? decoded['message'].toString()
        : 'خطای غیرمنتظره ($statusCode)';
    final code = decoded is Map && decoded['code'] != null
        ? decoded['code'].toString()
        : 'ERROR';
    if (statusCode == 401) await logout();
    throw ApiException(statusCode: statusCode, code: code, message: message);
  }

  Future<dynamic> uploadBytes(
    String path, {
    required String fieldName,
    required String filename,
    required Uint8List bytes,
  }) async {
    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl$path'))
      ..headers.addAll(await _headers(json: false))
      ..files.add(http.MultipartFile.fromBytes(fieldName, bytes, filename: filename));
    final response = await request.send().timeout(const Duration(seconds: 60));
    final text = await response.stream.bytesToString();
    final decoded = _decode(text);
    if (response.statusCode >= 400) {
      await _throwApiError(response.statusCode, decoded);
    }
    return decoded;
  }

  Future<ApiBinary> download(String path) async {
    final request = http.Request('GET', Uri.parse('$baseUrl$path'))
      ..headers.addAll(await _headers(json: false));
    final response = await request.send().timeout(const Duration(seconds: 60));
    final bytes = await response.stream.toBytes();
    if (response.statusCode >= 400) {
      final text = utf8.decode(bytes, allowMalformed: true);
      await _throwApiError(response.statusCode, _decode(text));
    }
    final disposition = response.headers['content-disposition'] ?? '';
    return ApiBinary(
      bytes: Uint8List.fromList(bytes),
      contentType: response.headers['content-type'] ?? 'application/octet-stream',
      filename: _filenameFromDisposition(disposition),
    );
  }

  String? _filenameFromDisposition(String value) {
    final utf8Match =
        RegExp(r"filename\*=UTF-8''([^;]+)", caseSensitive: false).firstMatch(value);
    if (utf8Match != null) return Uri.decodeComponent(utf8Match.group(1)!);
    final match =
        RegExp(r'filename="?([^";]+)"?', caseSensitive: false).firstMatch(value);
    return match?.group(1);
  }

  Future<void> login(String mobile, String password) async {
    final res = await post('/auth/login', {'mobile': mobile, 'password': password});
    await saveSession(res['token'] as String, res['user'] as Map<String, dynamic>);
  }

  Future<void> requestOtp(String mobile) async {
    await post('/auth/otp/request', {'mobile': mobile});
  }

  Future<String> verifyOtp(String mobile, String code) async {
    final res = await post('/auth/otp/verify', {'mobile': mobile, 'code': code});
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

class ApiException implements Exception {
  final int statusCode;
  final String code;
  final String message;
  const ApiException({
    required this.statusCode,
    required this.code,
    required this.message,
  });
  bool get isUnauthorized => statusCode == 401;
  @override
  String toString() => message;
}
