import 'dart:async';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:followa_mobile/services/app_error.dart';

void main() {
  group('safe user errors', () {
    test('maps API statuses without exposing server content', () {
      expect(safeApiMessage(401, 'UNAUTHORIZED'), contains('نشست'));
      expect(safeApiMessage(403, 'FORBIDDEN'), contains('اجازه'));
      expect(safeApiMessage(500, 'INTERNAL'), isNot(contains('INTERNAL')));
    });

    test('maps connectivity failures to Persian messages', () {
      expect(
        safeTransportError(const SocketException('host details')).message,
        contains('اینترنت'),
      );
      expect(
        safeTransportError(TimeoutException('request details')).message,
        contains('مهلت'),
      );
    });

    test('does not expose unexpected exception details', () {
      final message =
          safeTransportError(Exception('secret backend trace')).message;
      expect(message, isNot(contains('secret')));
      expect(message, contains('غیرمنتظره'));
    });
  });
}
