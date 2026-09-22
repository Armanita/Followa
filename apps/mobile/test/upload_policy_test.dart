import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:followa_mobile/services/app_error.dart';
import 'package:followa_mobile/services/upload_policy.dart';

void main() {
  group('UploadPolicy', () {
    test('matches backend document MIME types', () {
      expect(UploadPolicy.mimeTypeFor('contract.PDF'), 'application/pdf');
      expect(UploadPolicy.mimeTypeFor('camera.jpeg'), 'image/jpeg');
      expect(
        UploadPolicy.mimeTypeFor('sheet.xlsx'),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });

    test('accepts a valid non-empty document', () {
      expect(
        () => UploadPolicy.validate('document.pdf', Uint8List.fromList([1])),
        returnsNormally,
      );
    });

    test('rejects unsupported and oversized files', () {
      expect(
        () => UploadPolicy.validate('payload.exe', Uint8List.fromList([1])),
        throwsA(isA<AppError>()),
      );
      expect(
        () => UploadPolicy.validate(
          'large.jpg',
          Uint8List(UploadPolicy.maxBytes + 1),
        ),
        throwsA(isA<AppError>()),
      );
    });
  });
}
