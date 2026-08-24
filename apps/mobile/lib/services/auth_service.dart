import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Central API + session service for the mobile app.
///
/// For a physical device on the same Wi-Fi, set host to your PC's LAN IP.
class AuthService {
  AuthService._();
  static final AuthService instance = AuthService._();

  // Android emulator reaches host machine via 10.0.2.2.
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

  Future<bool> hasToken() async {
    final sp = await SharedPreferences.getInstance();
    _token = sp.getString(_tokenKey);
    final rawUser = sp.getString(_userKey);
    if (rawUser != null) {
      _user = jsonDecode(rawUser) as Map<String, dynamic>;
    }
    return _token != null;
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

  Future<Map<String, String>> _headers() async {
    if (_token == null) await hasToken();
    return {
      if (_token != null) 'authorization': 'Bearer $_token',
      'content-type': 'application/json',
    };
  }

  Future<dynamic> get(String path) async => _send('GET', path);
  Future<dynamic> post(String path, [Object? body]) async =>
      _send('POST', path, body);
  Future<dynamic> patch(String path, [Object? body]) async =>
      _send('PATCH', path, body);

  Future<dynamic> _send(String method, String path, [Object? body]) async {
    final uri = Uri.parse('$baseUrl$path');
    final request = http.Request(method, uri)..headers.addAll(await _headers());
    if (body != null) request.body = jsonEncode(body);
    final streamed = await request.send().timeout(const Duration(seconds: 20));
    final text = await streamed.stream.bytesToString();
    dynamic decoded;
    try {
      decoded = text.isEmpty ? null : jsonDecode(text);
    } catch (_) {
      decoded = text;
    }
    if (streamed.statusCode >= 400) {
      final msg = decoded is Map && decoded['message'] != null
          ? decoded['message'] as String
          : 'خطای غیرمنتظره (${streamed.statusCode})';
      throw ApiException(msg);
    }
    return decoded;
  }

  // ---- Auth flows ----------------------------------------------------------

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
      String mobile, String resetToken, String password) async {
    await post('/auth/password',
        {'mobile': mobile, 'resetToken': resetToken, 'password': password});
    await login(mobile, password);
  }
}

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}
