import React from 'react';

interface DockorLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export function DockorLogo({ size = 24, className, ...props }: DockorLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Col 1 - Solid Foundation */}
      <rect x="10" y="10" width="8" height="8" rx="2.5" fill="#2563EB" />
      <rect x="10" y="20" width="8" height="8" rx="2.5" fill="#2563EB" />
      <rect x="10" y="30" width="8" height="8" rx="2.5" fill="#2563EB" />

      {/* Col 2 - Crossbars */}
      <rect x="20" y="10" width="8" height="8" rx="2.5" fill="#3B82F6" />
      <rect x="20" y="30" width="8" height="8" rx="2.5" fill="#3B82F6" />

      {/* Col 3 - Outer Perimeter */}
      <rect x="30" y="10" width="8" height="8" rx="2.5" fill="#60A5FA" />
      <rect x="30" y="20" width="8" height="8" rx="2.5" fill="#60A5FA" />
      <rect x="30" y="30" width="8" height="8" rx="2.5" fill="#60A5FA" />
    </svg>
  );
}
