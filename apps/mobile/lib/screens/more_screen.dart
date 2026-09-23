import 'package:flutter/material.dart';

import '../services/auth_service.dart';
import '../theme/premium_theme.dart';
import 'customer_report_screen.dart';
import 'notifications_screen.dart';
import 'profile_screen.dart';
import 'reports_tab.dart';
import 'settings_screen.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final manager = AuthService.instance.isManager;
    final items = manager
        ? <_MoreItem>[
            const _MoreItem(
              title: 'گزارش‌ها',
              subtitle: 'بار عملیاتی و وضعیت پرونده‌های تیم',
              icon: Icons.bar_chart_rounded,
              page: ReportsTab(),
            ),
            const _MoreItem(
              title: 'گزارش مشتری',
              subtitle: 'پرونده‌های هر مشتری با فیلتر وضعیت و تاریخ',
              icon: Icons.person_search_outlined,
              page: CustomerReportScreen(),
            ),
            const _MoreItem(
              title: 'تنظیمات',
              subtitle: 'شرکت، انواع پرونده و پیام‌رسان‌ها',
              icon: Icons.settings_outlined,
              page: SettingsScreen(),
            ),
            const _MoreItem(
              title: 'اعلان‌ها',
              subtitle: 'رویدادها و تغییرات مرتبط با پرونده‌ها',
              icon: Icons.notifications_outlined,
              page: NotificationsScreen(),
            ),
            const _MoreItem(
              title: 'پروفایل',
              subtitle: 'اطلاعات حساب و پروفایل سازمانی',
              icon: Icons.person_outline_rounded,
              page: ProfileScreen(),
            ),
          ]
        : <_MoreItem>[
            const _MoreItem(
              title: 'اعلان‌ها',
              subtitle: 'رویدادها و تغییرات مرتبط با پرونده‌ها',
              icon: Icons.notifications_outlined,
              page: NotificationsScreen(),
            ),
            const _MoreItem(
              title: 'تنظیمات پیام‌رسان',
              subtitle: 'اعلان‌های تلگرام، بله و کد یکبارمصرف',
              icon: Icons.settings_outlined,
              page: SettingsScreen(),
            ),
            const _MoreItem(
              title: 'پروفایل',
              subtitle: 'اطلاعات پرسنلی، عکس و ثبت نهایی',
              icon: Icons.badge_outlined,
              page: ProfileScreen(),
            ),
          ];

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
          children: [
            const Text(
              'فضای تکمیلی',
              style: TextStyle(
                color: FollowaColors.soft,
                fontSize: 10,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 3),
            const Text(
              'بیشتر',
              style: TextStyle(
                color: FollowaColors.ink,
                fontSize: 22,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              manager
                  ? 'گزارش، تنظیمات شرکت و حساب مدیریتی'
                  : 'اعلان‌ها و مدیریت پروفایل پرسنلی',
              style: const TextStyle(
                color: FollowaColors.muted,
                fontSize: 10.5,
              ),
            ),
            const SizedBox(height: 18),
            ...items.map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(18),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => item.page),
                    ),
                    child: Container(
                      padding: const EdgeInsets.all(15),
                      decoration: BoxDecoration(
                        color: FollowaColors.surface,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: FollowaColors.border),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 42,
                            height: 42,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: FollowaColors.elevated,
                              borderRadius: BorderRadius.circular(13),
                              border: Border.all(color: FollowaColors.border),
                            ),
                            child: Icon(
                              item.icon,
                              color: FollowaColors.brandSoft,
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 11),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.title,
                                  style: const TextStyle(
                                    color: FollowaColors.ink,
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  item.subtitle,
                                  style: const TextStyle(
                                    color: FollowaColors.soft,
                                    fontSize: 9.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(
                            Icons.chevron_left_rounded,
                            color: FollowaColors.soft,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MoreItem {
  final String title;
  final String subtitle;
  final IconData icon;
  final Widget page;

  const _MoreItem({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.page,
  });
}
