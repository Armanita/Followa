import 'dart:typed_data';

import 'app_error.dart';

class UploadPolicy {
  static const int maxBytes = 20 * 1024 * 1024;
  static const Set<String> allowedExtensions = {
    'pdf',
    'jpg',
    'jpeg',
    'png',
    'webp',
    'gif',
    'mp3',
    'ogg',
    'wav',
    'm4a',
    'mp4',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
  };

  static String extensionOf(String filename) {
    final dot = filename.lastIndexOf('.');
    return dot < 0 ? '' : filename.substring(dot + 1).toLowerCase();
  }

  static String? mimeTypeFor(String filename) {
    return const {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'gif': 'image/gif',
      'mp3': 'audio/mpeg',
      'ogg': 'audio/ogg',
      'wav': 'audio/wav',
      'm4a': 'audio/mp4',
      'mp4': 'video/mp4',
      'doc': 'application/msword',
      'docx':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx':
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }[extensionOf(filename)];
  }

  static void validate(String filename, Uint8List bytes) {
    if (!allowedExtensions.contains(extensionOf(filename))) {
      throw const AppError(
        'نوع فایل مجاز نیست. فایل‌های PDF، آفیس، تصویر، صوت و MP4 پذیرفته می‌شوند.',
      );
    }
    if (bytes.isEmpty) {
      throw const AppError('فایل انتخاب‌شده خالی است.');
    }
    if (bytes.length > maxBytes) {
      throw const AppError('حجم فایل نباید بیشتر از ۲۰ مگابایت باشد.');
    }
  }
}
