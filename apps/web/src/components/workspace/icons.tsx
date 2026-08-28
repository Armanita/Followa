import type { ReactNode, SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  title?: string;
}

function IconFrame({ title, children, ...props }: IconProps & { children: ReactNode }) {
  const accessibility = title
    ? { role: 'img' as const, 'aria-label': title }
    : { 'aria-hidden': true as const };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
      {...accessibility}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M3.75 10.5 12 3.75l8.25 6.75" />
      <path d="M5.25 9.75v10.5h13.5V9.75" />
      <path d="M9.25 20.25v-6h5.5v6" />
    </IconFrame>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M3.75 6.75h6l1.5 1.5h9v9.75a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18V6.75Z" />
    </IconFrame>
  );
}

export function HandshakeIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m8.25 12 2.25-2.25a2.12 2.12 0 0 1 3 0l2.25 2.25" />
      <path d="m3.75 8.25 3-3 3 1.5-4.5 7.5-3-1.5 1.5-4.5Z" />
      <path d="m20.25 8.25-3-3-3 1.5 4.5 7.5 3-1.5-1.5-4.5Z" />
      <path d="m8.25 15 1.5 1.5a1.06 1.06 0 0 0 1.5 0l.75-.75.75.75a1.06 1.06 0 0 0 1.5 0l1.5-1.5" />
    </IconFrame>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.75 19.5a5.25 5.25 0 0 1 10.5 0" />
      <path d="M15.75 5.5a3 3 0 0 1 0 5.5" />
      <path d="M16.5 14.5a4.5 4.5 0 0 1 3.75 4.45" />
    </IconFrame>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4.5 19.5V13h3v6.5h-3Z" />
      <path d="M10.5 19.5V8.5h3v11h-3Z" />
      <path d="M16.5 19.5V4.5h3v15h-3Z" />
    </IconFrame>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.12 2.12-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51v.13h-3v-.13a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06-2.12-2.12.06-.06A1.65 1.65 0 0 0 7.2 15a1.65 1.65 0 0 0-1.51-1H5.5v-3h.19A1.65 1.65 0 0 0 7.2 10a1.65 1.65 0 0 0-.33-1.82l-.06-.06L8.93 6l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51v-.13h3v.13a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06 2.12 2.12-.06.06A1.65 1.65 0 0 0 19.4 10a1.65 1.65 0 0 0 1.51 1h.19v3h-.19a1.65 1.65 0 0 0-1.51 1Z" />
    </IconFrame>
  );
}

export function InboxIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4.5 5.25h15l1.5 10.5H15.5l-1.5 2.25h-4l-1.5-2.25H3L4.5 5.25Z" />
      <path d="M8.25 11.25h7.5" />
    </IconFrame>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5V12l3 1.5" />
    </IconFrame>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M6.75 9.75a5.25 5.25 0 0 1 10.5 0c0 6 2.25 6 2.25 6H4.5s2.25 0 2.25-6Z" />
      <path d="M9.75 18.75a2.5 2.5 0 0 0 4.5 0" />
    </IconFrame>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </IconFrame>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M10.5 5.25H6.75A2.25 2.25 0 0 0 4.5 7.5v9a2.25 2.25 0 0 0 2.25 2.25h3.75" />
      <path d="M14.25 8.25 18 12l-3.75 3.75" />
      <path d="M9 12h9" />
    </IconFrame>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4.5 7.5h15" />
      <path d="M4.5 12h15" />
      <path d="M4.5 16.5h15" />
    </IconFrame>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m7.5 7.5 9 9" />
      <path d="m16.5 7.5-9 9" />
    </IconFrame>
  );
}
