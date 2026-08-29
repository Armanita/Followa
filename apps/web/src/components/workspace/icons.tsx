import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function BaseIcon({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function DashboardIcon(props: IconProps) {
  return <BaseIcon {...props}><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="4" rx="2" /><rect x="14" y="11" width="7" height="10" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /></BaseIcon>;
}
export function CasesIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M3 7.5h6l1.8 2H21v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5Z" /><path d="M3 7.5V6a2 2 0 0 1 2-2h4l1.8 2H19a2 2 0 0 1 2 2v1.5" /></BaseIcon>;
}
export function CustomersIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M2.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 8h5M18.5 5.5v5" /><path d="M15.5 14.5h5" /></BaseIcon>;
}
export function EmployeesIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M17 8.5a3 3 0 1 0 0-5.5" /><path d="M17 14a5 5 0 0 1 5 5" /></BaseIcon>;
}
export function ReportsIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></BaseIcon>;
}
export function SettingsIcon(props: IconProps) {
  return <BaseIcon {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.05.05-2.83 2.83-.05-.05a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65V21h-4v-.08A1.8 1.8 0 0 0 8.7 19.3a1.8 1.8 0 0 0-2 .36l-.05.05-2.83-2.83.05-.05a1.8 1.8 0 0 0 .36-2A1.8 1.8 0 0 0 2.6 13.7H2v-4h.6A1.8 1.8 0 0 0 4.23 8.6a1.8 1.8 0 0 0-.36-2l-.05-.05 2.83-2.83.05.05a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 9.8 2.5V2h4v.5a1.8 1.8 0 0 0 1.1 1.63 1.8 1.8 0 0 0 2-.36l.05-.05 2.83 2.83-.05.05a1.8 1.8 0 0 0-.36 2 1.8 1.8 0 0 0 1.63 1.1h.9v4h-.9A1.8 1.8 0 0 0 19.4 15Z" /></BaseIcon>;
}
export function AssignmentsIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M4 5h16v14H4z" /><path d="m4 7 8 6 8-6" /></BaseIcon>;
}
export function RemindersIcon(props: IconProps) {
  return <BaseIcon {...props}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5" /><path d="M8 2 5 5M16 2l3 3" /></BaseIcon>;
}
export function NotificationsIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></BaseIcon>;
}
export function ProfileIcon(props: IconProps) {
  return <BaseIcon {...props}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></BaseIcon>;
}
export function LogoutIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5" /><path d="m15 16 4-4-4-4M19 12H9" /></BaseIcon>;
}
export function MenuIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M4 7h16M4 12h16M4 17h16" /></BaseIcon>;
}
export function CloseIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="m6 6 12 12M18 6 6 18" /></BaseIcon>;
}
export function BellIcon(props: IconProps) { return <NotificationsIcon {...props} />; }
export function AlertIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M10.3 3.7 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></BaseIcon>;
}
export function CheckIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="m5 12 4 4L19 6" /></BaseIcon>;
}
export function ClockIcon(props: IconProps) {
  return <BaseIcon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></BaseIcon>;
}
export function ActivityIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M3 12h4l2.5-6 5 12 2.5-6h4" /></BaseIcon>;
}
export function ArrowLeftIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M19 12H5M11 18l-6-6 6-6" /></BaseIcon>;
}
export function PlusIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M12 5v14M5 12h14" /></BaseIcon>;
}
export function SearchIcon(props: IconProps) {
  return <BaseIcon {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></BaseIcon>;
}
export function CalendarIcon(props: IconProps) {
  return <BaseIcon {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></BaseIcon>;
}
