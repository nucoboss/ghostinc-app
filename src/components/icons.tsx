import type { ReactElement } from "react";

export type IconName =
  | "cases"
  | "building"
  | "users"
  | "landmark"
  | "clock"
  | "home"
  | "briefcase"
  | "user-check"
  | "shield"
  | "search"
  | "database"
  | "activity"
  | "lock";

const paths: Record<IconName, ReactElement> = {
  cases: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  building: (
    <>
      <path d="M4 20V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15" />
      <path d="M14 9h4a1 1 0 0 1 1 1v10" />
      <path d="M7.5 7h2M7.5 11h2M7.5 15h2" />
      <path d="M3 20h18" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M16 4.8a3.2 3.2 0 0 1 0 6.4" />
      <path d="M17.5 15.4c1.8.7 3 2.1 3 4.6" />
    </>
  ),
  landmark: (
    <>
      <path d="m3 10 9-6 9 6" />
      <path d="M4 20h16" />
      <path d="M6 10v8M10 10v8M14 10v8M18 10v8" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  home: (
    <>
      <path d="M3 11.2 12 4l9 7.2" />
      <path d="M5.5 12.5V20h13v-7.5" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7" />
      <path d="M3 13h18" />
    </>
  ),
  "user-check": (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 20c0-3.2 2.5-6 5.5-6" />
      <path d="m14.5 15.5 3 5 5.5-6.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.2-4.2" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5.5" rx="7" ry="2.5" />
      <path d="M5 5.5V12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V5.5" />
      <path d="M5 12v6.5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V12" />
    </>
  ),
  activity: <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
};

export function CardIcon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}