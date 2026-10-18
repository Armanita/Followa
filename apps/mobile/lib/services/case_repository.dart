import 'auth_service.dart';

/// A small boundary shared by case subflows, also injectable in widget tests.
class CaseRepository {
  const CaseRepository();
  bool get isManager => AuthService.instance.isManager;
  String get userId => (AuthService.instance.user?['id'] ?? '').toString();
  Future<dynamic> get(String path) => AuthService.instance.get(path);
  Future<dynamic> post(String path, [Object? body]) =>
      AuthService.instance.post(path, body);
}

class CaseAccess {
  final Map<String, dynamic> data;
  final bool manager;
  final String userId;
  const CaseAccess(this.data, this.manager, this.userId);
  bool get closed => data['status'] == 'DONE' || data['status'] == 'CANCELLED';
  bool get owner =>
      data['isCurrentOwner'] == true ||
      (userId.isNotEmpty &&
          (data['currentOwnerId'] ?? data['currentOwner']?['id']) == userId);
  bool get pending =>
      !closed &&
      data['status'] == 'WAITING_ACCEPTANCE' &&
      data['hasPendingAcceptanceForMe'] == true;
  bool get execute =>
      !manager && owner && !closed && !pending && data['canEdit'] == true;
  // canTransfer alone is broader than the actual transfer endpoint permissions.
  bool get transfer =>
      !closed && (manager || owner) && data['canTransfer'] == true;
}

/// Stable newest-first presentation without changing or merging source records.
List<Map<String, dynamic>> newestCaseEvents(List<Map<String, dynamic>> source) {
  final indexed = source.indexed.toList();
  indexed.sort((a, b) {
    final aTime = DateTime.tryParse(a.$2['createdAt']?.toString() ?? '');
    final bTime = DateTime.tryParse(b.$2['createdAt']?.toString() ?? '');
    final order = aTime != null && bTime != null ? bTime.compareTo(aTime) : 0;
    return order == 0 ? a.$1.compareTo(b.$1) : order;
  });
  return indexed.map((entry) => entry.$2).toList();
}

List<Map<String, dynamic>> caseRows(Object? value) => value is List
    ? value.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
    : [];

String personName(Object? value, {String fallback = 'نامشخص'}) {
  if (value is! Map) return fallback;
  final name = (value['fullName'] ??
          '${value['firstName'] ?? ''} ${value['lastName'] ?? ''}')
      .toString()
      .trim();
  return name.isEmpty ? fallback : name;
}
