import 'package:flutter/widgets.dart';

/// Retains tab state while allowing data refresh when returning to a workspace.
class WorkspaceVisibility extends InheritedWidget {
  final bool visible;
  const WorkspaceVisibility(
      {super.key, required this.visible, required super.child});
  static bool of(BuildContext context) =>
      context
          .dependOnInheritedWidgetOfExactType<WorkspaceVisibility>()
          ?.visible ??
      true;
  @override
  bool updateShouldNotify(WorkspaceVisibility oldWidget) =>
      visible != oldWidget.visible;
}
