/**
 * Age Range Utilities — PlayLexi
 *
 * Provides helpers for converting between age ranges (UI) and birth years (storage).
 *
 * ## Design Decision: Birth Year Storage
 *
 * We store birth year instead of age or age range because:
 * 1. **Flexibility**: Age brackets can be changed without migrations
 * 2. **COPPA compliance**: Precise under-13 detection
 * 3. **Auto-updating**: Computed age updates each year
 * 4. **Analytics**: Any age grouping can be created in queries
 *
 * ## Usage
 *
 * ```tsx
 * // In UI: Show dropdown with age ranges
 * <Select>
 *   {AGE_RANGES.map(range => (
 *     <SelectItem key={range.value} value={range.value}>
 *       {range.label}
 *     </SelectItem>
 *   ))}
 * </Select>
 *
 * // On submit: Convert to birth year for storage
 * const birthYear = birthYearFromAgeRange(selectedRange)
 *
 * // When displaying: Convert back to range
 * const displayRange = ageRangeFromBirthYear(user.birthYear)
 * ```
 *
 * @see db/schema.ts users.birthYear
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Age range options for the profile form.
 *
 * Each range has:
 * - value: Identifier used in code
 * - label: Display text for UI
 * - minAge/maxAge: Bounds for calculation
 *
 * Note: "Prefer not to say" maps to null birthYear in the database.
 */
export const AGE_RANGES = [
  { value: "under_13", label: "Under 13", minAge: 0, maxAge: 12 },
  { value: "13_17", label: "13-17", minAge: 13, maxAge: 17 },
  { value: "18_24", label: "18-24", minAge: 18, maxAge: 24 },
  { value: "25_34", label: "25-34", minAge: 25, maxAge: 34 },
  { value: "35_44", label: "35-44", minAge: 35, maxAge: 44 },
  { value: "45_plus", label: "45+", minAge: 45, maxAge: 100 },
  { value: "prefer_not_to_say", label: "Prefer not to say", minAge: null, maxAge: null },
] as const

export type AgeRangeValue = (typeof AGE_RANGES)[number]["value"]

// =============================================================================
// CONVERSION FUNCTIONS
// =============================================================================

/**
 * Convert an age range selection to a birth year for storage.
 *
 * Uses the middle of the range to estimate birth year.
 * Returns null for "prefer_not_to_say" or invalid values.
 *
 * @param range - Age range value from dropdown
 * @returns Birth year (e.g., 2010) or null
 *
 * @example
 * birthYearFromAgeRange("13_17") // 2009 (if current year is 2024)
 * birthYearFromAgeRange("prefer_not_to_say") // null
 */
export function birthYearFromAgeRange(range: string): number | null {
  const config = AGE_RANGES.find((r) => r.value === range)

  if (!config || config.minAge === null || config.maxAge === null) {
    return null
  }

  const currentYear = new Date().getFullYear()

  // Use middle of range for best approximation
  // Cap maxAge at 80 for "45+" to avoid unrealistic values
  const effectiveMaxAge = Math.min(config.maxAge, 80)
  const midAge = Math.floor((config.minAge + effectiveMaxAge) / 2)

  return currentYear - midAge
}

/**
 * Convert a birth year to the corresponding age range.
 *
 * @param birthYear - Year of birth (e.g., 2010) or null/undefined
 * @returns Age range value (e.g., "13_17") or "prefer_not_to_say" if null
 *
 * @example
 * ageRangeFromBirthYear(2010) // "13_17" (if current year is 2024)
 * ageRangeFromBirthYear(null) // "prefer_not_to_say"
 */
export function ageRangeFromBirthYear(birthYear: number | null | undefined): AgeRangeValue {
  if (birthYear === null || birthYear === undefined) {
    return "prefer_not_to_say"
  }

  const currentYear = new Date().getFullYear()
  const age = currentYear - birthYear

  // Find matching range
  const range = AGE_RANGES.find(
    (r) => r.minAge !== null && r.maxAge !== null && age >= r.minAge && age <= r.maxAge
  )

  return (range?.value as AgeRangeValue) ?? "45_plus"
}

/**
 * Get the display label for an age range value.
 *
 * @param value - Age range value
 * @returns Display label (e.g., "13-17")
 */
export function getAgeRangeLabel(value: AgeRangeValue): string {
  const range = AGE_RANGES.find((r) => r.value === value)
  return range?.label ?? "Unknown"
}

/**
 * Calculate actual age from birth year.
 *
 * @param birthYear - Year of birth
 * @returns Age in years, or null if birthYear is null/undefined
 */
export function calculateAge(birthYear: number | null | undefined): number | null {
  if (birthYear === null || birthYear === undefined) {
    return null
  }

  const currentYear = new Date().getFullYear()
  return currentYear - birthYear
}

/**
 * Check if a user is under 13 (for COPPA compliance).
 *
 * @param birthYear - Year of birth
 * @returns true if under 13, false otherwise (including if birthYear is null)
 */
export function isUnder13(birthYear: number | null | undefined): boolean {
  const age = calculateAge(birthYear)
  return age !== null && age < 13
}
