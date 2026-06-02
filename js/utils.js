/**
 * utils.js - Shared utility functions
 * Common helpers used across the application
 */

/**
 * Normalize a turn number by removing any suffix after "-"
 * Examples: "12263-N" → "12263", "15281-R" → "15281", "12263" → "12263"
 * @param {string} turnr - The turn number to normalize
 * @returns {string} The normalized turn number
 */
function normalizeTurnNumber(turnr) {
  if (!turnr) return turnr;

  // Convert to string and trim whitespace
  const str = String(turnr).trim();

  // Split on "-" and take the first part
  const normalized = str.split('-')[0];

  return normalized;
}

/**
 * Check if a turn number matches another (with suffix normalization)
 * @param {string} turnr1 - First turn number (may have suffix)
 * @param {string} turnr2 - Second turn number (may have suffix)
 * @returns {boolean} True if they match when normalized
 */
function turnNumbersMatch(turnr1, turnr2) {
  return normalizeTurnNumber(turnr1) === normalizeTurnNumber(turnr2);
}
