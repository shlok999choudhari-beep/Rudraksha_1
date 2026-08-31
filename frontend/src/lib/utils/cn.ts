import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware class merge used by every component in the design system. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
