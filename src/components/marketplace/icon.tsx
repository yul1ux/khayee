import type { ReactNode, SVGProps } from "react";

const iconPaths = {
  arrowRight: (
    <>
      <path d="M4.5 12h15" />
      <path d="m13 5.5 6.5 6.5-6.5 6.5" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4L19 7" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.8 8.2-2.4 5.2-5.2 2.4 2.4-5.2 5.2-2.4Z" />
    </>
  ),
  mountain: <path d="m2.5 19 6-10 3.5 5 2.5-3.5 7 8.5H2.5Zm4.8-8.1L9 14m6-2 2.2 3" />,
  pin: (
    <>
      <path d="M19 10.1c0 5-7 10.4-7 10.4S5 15.1 5 10.1a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2.2" />
    </>
  ),
  users: (
    <>
      <path d="M16 20v-1.6a3.4 3.4 0 0 0-3.4-3.4H7.4A3.4 3.4 0 0 0 4 18.4V20" />
      <circle cx="10" cy="8" r="3.3" />
      <path d="M20 20v-1.6a3.4 3.4 0 0 0-2.8-3.3M16.5 4.8a3.3 3.3 0 0 1 0 6.4" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof iconPaths;

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
};

export function Icon({ name, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      {...props}
    >
      {iconPaths[name]}
    </svg>
  );
}
