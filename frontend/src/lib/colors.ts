import { Domain, Difficulty } from '@/types';

export interface ColorBadgeStyle {
  badge: string;
  dot: string;
  border: string;
  name: string;
}

export const DOMAIN_COLOR_MAP: Record<Domain, ColorBadgeStyle> = {
  fintech: {
    badge: 'text-green-700 dark:text-green-400 bg-green-500/10 border-green-500/25',
    dot: 'bg-green-600 dark:bg-green-500',
    border: 'border-green-500/30',
    name: 'Fintech',
  },
  systems: {
    badge: 'text-blue-700 dark:text-blue-300 bg-blue-500/10 border-blue-500/25',
    dot: 'bg-blue-600 dark:bg-blue-400',
    border: 'border-blue-500/30',
    name: 'Systems',
  },
  logistics: {
    badge: 'text-amber-800 dark:text-amber-300 bg-amber-500/10 border-amber-500/25',
    dot: 'bg-amber-600 dark:bg-amber-400',
    border: 'border-amber-500/30',
    name: 'Logistics',
  },
  ai: {
    badge: 'text-violet-700 dark:text-violet-300 bg-violet-500/10 border-violet-500/25',
    dot: 'bg-violet-600 dark:bg-violet-400',
    border: 'border-violet-500/30',
    name: 'AI & Inference',
  },
  security: {
    badge: 'text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/25',
    dot: 'bg-rose-600 dark:bg-rose-400',
    border: 'border-rose-500/30',
    name: 'Security',
  },
  devtools: {
    badge: 'text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 border-indigo-500/25',
    dot: 'bg-indigo-600 dark:bg-indigo-400',
    border: 'border-indigo-500/30',
    name: 'DevTools',
  },
};

export const DIFFICULTY_COLOR_MAP: Record<Difficulty, { badge: string; name: string }> = {
  foundational: {
    badge: 'text-blue-700 dark:text-blue-300 bg-blue-500/10 border-blue-500/20',
    name: 'Foundational',
  },
  intermediate: {
    badge: 'text-green-700 dark:text-green-400 bg-green-500/10 border-green-500/20',
    name: 'Intermediate',
  },
  'production-grade': {
    badge: 'text-amber-800 dark:text-amber-300 bg-amber-500/20 border-amber-500/30',
    name: 'Production-Grade',
  },
};

export function getDomainStyle(domain: Domain): ColorBadgeStyle {
  return DOMAIN_COLOR_MAP[domain] || DOMAIN_COLOR_MAP.fintech;
}

export function getDifficultyStyle(difficulty: Difficulty): { badge: string; name: string } {
  return DIFFICULTY_COLOR_MAP[difficulty] || DIFFICULTY_COLOR_MAP.intermediate;
}
