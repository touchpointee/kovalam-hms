export type MedicineFrequencyOption = {
  _id?: string;
  name: string;
  dosesPerDay?: number | null;
  isActive?: boolean;
};

function normalizeFrequencyName(value: string): string {
  return value.trim().toLowerCase();
}

export function inferDosesPerDayFromFrequencyName(frequency: string): number | null {
  const normalized = normalizeFrequencyName(frequency);
  if (!normalized) return null;

  const patternMatch = normalized.match(
    /(\d+(?:\.\d+)?(?:\s*(?:-|\+)\s*\d+(?:\.\d+)?)+)/
  );
  if (patternMatch) {
    const parts = patternMatch[1]
      .split(/(?:-|\+)/)
      .map((part) => Number(part.trim()))
      .filter((part) => Number.isFinite(part));
    const total = parts.reduce((sum, part) => sum + part, 0);
    return total > 0 ? total : null;
  }

  const qHourMatch =
    normalized.match(/\bq\s*(\d+(?:\.\d+)?)\s*h\b/) ??
    normalized.match(/\bevery\s*(\d+(?:\.\d+)?)\s*hours?\b/);
  if (qHourMatch) {
    const intervalHours = Number(qHourMatch[1]);
    if (Number.isFinite(intervalHours) && intervalHours > 0) {
      return 24 / intervalHours;
    }
  }

  if (
    normalized.includes("once weekly") ||
    normalized.includes("weekly once") ||
    normalized.includes("1/week") ||
    normalized.includes("1 per week") ||
    normalized.includes("one per week")
  ) {
    return 1 / 7;
  }
  if (
    normalized.includes("twice weekly") ||
    normalized.includes("2/week") ||
    normalized.includes("2 per week") ||
    normalized.includes("two per week")
  ) {
    return 2 / 7;
  }
  if (
    normalized.includes("thrice weekly") ||
    normalized.includes("3/week") ||
    normalized.includes("3 per week") ||
    normalized.includes("three per week")
  ) {
    return 3 / 7;
  }
  if (
    normalized.includes("qid") ||
    normalized.includes("q.i.d") ||
    normalized.includes("four times")
  ) {
    return 4;
  }
  if (
    normalized.includes("tds") ||
    normalized.includes("tid") ||
    normalized.includes("t.i.d") ||
    normalized.includes("thrice")
  ) {
    return 3;
  }
  if (
    normalized.includes("bd") ||
    normalized.includes("bid") ||
    normalized.includes("b.i.d") ||
    normalized.includes("twice")
  ) {
    return 2;
  }
  if (
    normalized.includes("od") ||
    normalized.includes("o.d") ||
    normalized.includes("daily") ||
    normalized.includes("once")
  ) {
    return 1;
  }

  return null;
}

export function resolveDosesPerDay(
  frequency: string,
  frequencies: MedicineFrequencyOption[] = []
): number | null {
  const normalized = normalizeFrequencyName(frequency);
  if (!normalized) return null;

  const configured = frequencies.find(
    (option) => normalizeFrequencyName(option.name) === normalized
  );
  const configuredDoses =
    configured?.dosesPerDay !== undefined && configured?.dosesPerDay !== null
      ? Number(configured.dosesPerDay)
      : null;
  if (configuredDoses && Number.isFinite(configuredDoses) && configuredDoses > 0) {
    return configuredDoses;
  }

  return inferDosesPerDayFromFrequencyName(frequency);
}

export function parseDurationToDays(duration: string): number | null {
  const normalized = duration.trim().toLowerCase();
  if (!normalized) return null;

  const amountMatch = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  if (normalized.includes("week")) return amount * 7;
  if (normalized.includes("month")) return amount * 30;
  return amount;
}

export function calculateSuggestedTabletQuantity(
  frequency: string,
  duration: string,
  frequencies: MedicineFrequencyOption[] = []
): number | null {
  const dosesPerDay = resolveDosesPerDay(frequency, frequencies);
  const days = parseDurationToDays(duration);
  if (!dosesPerDay || !days) return null;
  return Math.ceil(dosesPerDay * days);
}
