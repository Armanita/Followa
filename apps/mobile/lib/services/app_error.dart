import 'dart:async';
import 'dart:io';

import 'package:http/http.dart' as http;

class AppError implements Exception {
  final String message;
  final int? statusCode;
  final String? code;

  const AppError(this.message, {this.statusCode, this.code});

  @override
  String toString() => message;
}

String safeApiMessage(int statusCode, String code) {
  if (code == 'FILE_TOO_LARGE') {
    return 'حجم فایل بیش از حد مجاز است.';
  }
  switch (statusCode) {
    case 400:
      return 'اطلاعات واردشده معتبر نیست. لطفاً موارد را بررسی کنید.';
    case 401:
      return 'نشست شما معتبر نیست. لطفاً دوباره وارد شوید.';
    case 403:
      return 'شما اجازه انجام این عملیات را ندارید.';
    case 404:
      return 'اطلاعات درخواستی پیدا نشد.';
    case 409:
      return 'این عملیات با وضعیت فعلی قابل انجام نیست.';
    case 413:
      return 'حجم فایل بیش از حد مجاز است.';
    default:
      return statusCode >= 500
          ? 'خطایی در سرور رخ داد. لطفاً کمی بعد دوباره تلاش کنید.'
          : 'انجام درخواست ممکن نشد. لطفاً دوباره تلاش کنید.';
  }
}

AppError safeTransportError(Object error) {
  if (error is AppError) return error;
  if (error is TimeoutException) {
    return const AppError(
      'مهلت ارتباط با سرور تمام شد. لطفاً دوباره تلاش کنید.',
    );
  }
  if (error is SocketException || error is http.ClientException) {
    return const AppError(
      'اتصال به اینترنت برقرار نیست. شبکه دستگاه را بررسی کنید.',
    );
  }
  if (error is FormatException) {
    return const AppError(
        'پاسخ سرور قابل پردازش نبود. لطفاً دوباره تلاش کنید.');
  }
  return const AppError('خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.');
}
