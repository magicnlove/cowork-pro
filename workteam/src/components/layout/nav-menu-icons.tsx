import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

export function IconDashboard(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path
        d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-8H9v8H4a1 1 0 01-1-1v-9.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconChat(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path
        d="M21 12a7.5 7.5 0 01-7.5 7.5H8l-4 2 1.5-4A7.5 7.5 0 1113.5 4.5H14A7.5 7.5 0 0121 12z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconTasks(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path d="M9 11l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="4" width="18" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 2v4M16 2v4" strokeLinecap="round" />
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 3v4M8 3v4M3 11h18" strokeLinecap="round" />
    </svg>
  );
}

export function IconNotes(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path d="M8 6h8M8 10h8M8 14h4" strokeLinecap="round" />
      <rect x="4" y="3" width="16" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconArchive(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path d="M4 7h16M4 12h10M4 17h7" strokeLinecap="round" />
      <rect x="14" y="10" width="6" height="10" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconActivity(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path d="M4 19h16M6 16l3-6 4 3 5-8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="13" cy="13" r="1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconAdmin(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <path
        d="M12 11a3 3 0 100-6 3 3 0 000 6zM4 20a8 8 0 0116 0M4 4l2 2M20 4l-2 2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden {...props}>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 1v2.5M12 20.5V23M4.22 4.22l1.77 1.77M18.01 18.01l1.77 1.77M1 12h2.5M20.5 12H23M4.22 19.78l1.77-1.77M18.01 5.99l1.77-1.77"
        strokeLinecap="round"
      />
    </svg>
  );
}
