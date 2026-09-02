export type PeriodPreset = 'all' | 'last30' | 'last3Months' | 'last6Months' | 'custom';

const DAY_MS = 86400000;

/**
 * Resolves a period preset (spec 007) to the `from`/`to` epoch-ms bounds sent to the server.
 * `now` is injectable for deterministic testing. "all" (the default) returns an empty range,
 * meaning full history — unchanged server behavior.
 */
export function periodPresetToRange(
  preset: PeriodPreset,
  customFrom: Date | null,
  customTo: Date | null,
  now: number = Date.now()
): { from?: number; to?: number } {
  switch (preset) {
    case 'last30':
      return { from: now - 30 * DAY_MS };
    case 'last3Months':
      return { from: now - 90 * DAY_MS };
    case 'last6Months':
      return { from: now - 180 * DAY_MS };
    case 'custom':
      return { from: customFrom?.getTime(), to: customTo?.getTime() };
    default:
      return {};
  }
}
