import 'package:flutter/material.dart';

class FollowaColors {
  static const shell = Color(0xFF070B14);
  static const surface = Color(0xFF0D1422);
  static const elevated = Color(0xFF111B2D);
  static const hover = Color(0xFF162238);
  static const border = Color(0xFF22304A);
  static const borderStrong = Color(0xFF31415F);
  static const ink = Color(0xFFF8FAFC);
  static const muted = Color(0xFFA5B4CA);
  static const soft = Color(0xFF71819B);
  static const brand = Color(0xFF7C3AED);
  static const brandSoft = Color(0xFFA78BFA);
  static const blue = Color(0xFF3B82F6);
  static const cyan = Color(0xFF22D3EE);
  static const emerald = Color(0xFF10B981);
  static const amber = Color(0xFFF59E0B);
  static const red = Color(0xFFEF4444);
}

ThemeData buildFollowaPremiumTheme() {
  final scheme = const ColorScheme.dark(
    primary: FollowaColors.brand,
    secondary: FollowaColors.blue,
    surface: FollowaColors.surface,
    error: FollowaColors.red,
    onPrimary: Colors.white,
    onSecondary: Colors.white,
    onSurface: FollowaColors.ink,
    onError: Colors.white,
  );

  final outline = OutlineInputBorder(
    borderRadius: BorderRadius.circular(14),
    borderSide: const BorderSide(color: FollowaColors.border),
  );

  return ThemeData(
    brightness: Brightness.dark,
    colorScheme: scheme,
    useMaterial3: true,
    fontFamily: 'Vazirmatn',
    scaffoldBackgroundColor: FollowaColors.shell,
    dividerColor: FollowaColors.border,
    splashColor: FollowaColors.brand.withOpacity(.08),
    highlightColor: FollowaColors.brand.withOpacity(.04),
    appBarTheme: const AppBarTheme(
      backgroundColor: FollowaColors.shell,
      foregroundColor: FollowaColors.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: FollowaColors.ink,
        fontSize: 17,
        fontWeight: FontWeight.w900,
      ),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      margin: EdgeInsets.zero,
      color: FollowaColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: const BorderSide(color: FollowaColors.border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: FollowaColors.elevated,
      labelStyle: const TextStyle(color: FollowaColors.muted, fontSize: 12),
      hintStyle: const TextStyle(color: FollowaColors.soft, fontSize: 12),
      border: outline,
      enabledBorder: outline,
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: FollowaColors.brandSoft, width: 1.4),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: FollowaColors.red),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(50),
        backgroundColor: FollowaColors.brand,
        foregroundColor: Colors.white,
        disabledBackgroundColor: FollowaColors.border,
        disabledForegroundColor: FollowaColors.soft,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: FollowaColors.brandSoft),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 72,
      backgroundColor: const Color(0xFF0A111D),
      surfaceTintColor: Colors.transparent,
      indicatorColor: FollowaColors.brand.withOpacity(.18),
      labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(
            color: states.contains(WidgetState.selected)
                ? FollowaColors.ink
                : FollowaColors.soft,
            fontSize: 10,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w800
                : FontWeight.w600,
          )),
      iconTheme: WidgetStateProperty.resolveWith((states) => IconThemeData(
            color: states.contains(WidgetState.selected)
                ? FollowaColors.brandSoft
                : FollowaColors.soft,
            size: 22,
          )),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: FollowaColors.brandSoft,
      linearTrackColor: FollowaColors.elevated,
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: FollowaColors.elevated,
      contentTextStyle: const TextStyle(color: FollowaColors.ink),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      behavior: SnackBarBehavior.floating,
    ),
  );
}
