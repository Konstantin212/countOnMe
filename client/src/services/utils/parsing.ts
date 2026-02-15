/**
 * Parsing utilities for API response transformation.
 *
 * Backend uses Python Decimal type for numeric precision, which Pydantic
 * serializes to JSON strings. These utilities safely parse string values
 * to JavaScript numbers while handling edge cases.
 */

/**
 * Parse a value that may be a string (from backend Decimal), number, or null/undefined
 * to a number or undefined.
 *
 * @param value - The value to parse (string from Decimal serialization, or already a number)
 * @returns Parsed number, or undefined if value is null/undefined/invalid
 *
 * @example
 * parseNumeric("75.50")    // => 75.5
 * parseNumeric(75.5)       // => 75.5
 * parseNumeric(null)       // => undefined
 * parseNumeric(undefined)  // => undefined
 * parseNumeric("invalid")  // => undefined (NaN filtered)
 * parseNumeric("")         // => undefined (NaN filtered)
 * parseNumeric(0)          // => 0 (valid zero)
 */
export const parseNumeric = (
  value: string | number | null | undefined,
): number | undefined => {
  if (value === null || value === undefined) return undefined;

  const parsed = typeof value === "string" ? parseFloat(value) : value;

  // Filter out NaN (invalid strings like "invalid", "")
  return isNaN(parsed) ? undefined : parsed;
};
