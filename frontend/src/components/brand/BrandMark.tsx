import React from 'react';

interface BrandMarkProps {
  size?: number;
  className?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ size = 28, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 transition-transform duration-200 hover:scale-105 ${className}`}
    >
      <rect
        width="32"
        height="32"
        rx="8"
        className="fill-card stroke-line"
        strokeWidth="1.2"
      />
      {/* Precision Ledger Vector Monogram */}
      <path
        d="M8.5 8.5V23.5H23.5"
        className="stroke-text-0"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 13H20M13.5 18H17"
        className="stroke-text-1"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="22" cy="18" r="2.5" className="fill-diff-green" />
    </svg>
  );
};
