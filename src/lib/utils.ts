import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate initials from a full name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format currency values
 */
export function formatCurrency(
  amount: number,
  currency: string = 'INR',
  locale: string = 'en-IN'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Format large numbers with abbreviations (K, M, B)
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * Format a Date object or date string into a readable format
 * Default format: DD/MM/YYYY (e.g., 22/09/2025)
 * Uses consistent formatting to prevent hydration mismatches
 */
export function formatDate(
  date: Date | string,
  locale: string = 'en-GB', // Use en-GB for consistent DD/MM/YYYY format
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Kolkata'
  }
): string {
  const parsedDate = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat(locale, options).format(parsedDate);
}

/**
 * Format a Date object or date string into a readable date and time format
 * Default format: DD/MM/YYYY, HH:mm (e.g., 07/08/2025, 15:45)
 * Uses consistent formatting to prevent hydration mismatches
 */
export function formatDateTime(
  date: Date | string,
  locale: string = 'en-GB', // Use en-GB for consistent DD/MM/YYYY format
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata'
  }
): string {
  const parsedDate = typeof date === 'string' ? new Date(date) : date;
  
  return new Intl.DateTimeFormat(locale, options).format(parsedDate);
}
