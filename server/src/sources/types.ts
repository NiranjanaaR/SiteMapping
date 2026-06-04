// Common shape returned by every data source. `ok` is false only when the call
// itself failed (network / parse); `ok: true` with `value: null` means the
// source responded but has no coverage at that point.

export interface SourceOutcome<T> {
  ok: boolean;
  value: T | null;
  /** Human-readable source label, e.g. "MET oceanforecast". */
  source: string;
  error?: string;
  /** Optional extra detail (e.g. vessel count for shipping). */
  detail?: number;
}

export function fail<T>(source: string, error: unknown): SourceOutcome<T> {
  return {
    ok: false,
    value: null,
    source,
    error: error instanceof Error ? error.message : String(error),
  };
}
