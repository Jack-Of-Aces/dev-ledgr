'use client';

import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rectangular' | 'circular' | 'pill';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  variant = 'rectangular',
  width,
  height,
  className = '',
  style,
  ...props
}: SkeletonProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'text':
        return 'h-4 w-full rounded';
      case 'circular':
        return 'rounded-full aspect-square';
      case 'pill':
        return 'rounded-full';
      case 'rectangular':
      default:
        return 'rounded-radius';
    }
  };

  const inlineStyles: React.CSSProperties = {
    ...(width !== undefined ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
    ...(height !== undefined ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
    ...style,
  };

  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer border border-line/30 shrink-0 ${getVariantClasses()} ${className}`}
      style={inlineStyles}
      {...props}
    />
  );
}
