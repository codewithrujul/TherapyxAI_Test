// The product prices everything in Indian Rupees. Use these helpers for every
// amount shown to a user so the symbol and number format stay consistent.

export const CURRENCY_CODE = 'INR';
export const CURRENCY_SYMBOL = '₹';

/**
 * Format a number as Indian Rupees, e.g. 1500 -> "₹1,500", 150000 -> "₹1,50,000",
 * 1500.5 -> "₹1,500.50". Whole amounts show no decimals.
 * Blank / non-numeric input renders as "₹0".
 */
export function formatINR(amount) {
  const n = Number(amount);
  const value = Number.isFinite(n) ? n : 0;
  const hasFraction = Math.abs(value % 1) > 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: CURRENCY_CODE,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(value);
}
