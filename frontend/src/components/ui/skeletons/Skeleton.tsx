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
      // These two classes are what keep a placeholder from pushing the page
      // sideways, and they are load-bearing.
      //
      // max-w-full caps an oversized placeholder at its container. Callers pass
      // fixed widths to shape the load — a w-80 heading, a w-96 paragraph — and
      // on a narrow viewport those are wider than the space available.
      //
      // No shrink-0, deliberately. It used to be here, which pinned every
      // placeholder to its declared width: max-w-full alone would cap each one
      // individually while the row as a whole still overflowed, because siblings
      // that cannot shrink add up past the container. Letting them shrink fixes
      // the row. Small fixed pieces are unaffected in practice — a w-16 avatar
      // never has to shrink, because the container is never narrower than it.
      className={`skeleton-shimmer border border-line/30 max-w-full min-w-0 ${getVariantClasses()} ${className}`}
      style={inlineStyles}
      {...props}
    />
  );
}
