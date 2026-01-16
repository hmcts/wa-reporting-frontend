export type SortDirection = 'asc' | 'desc';

export type SortState<T extends string> = {
  by: T;
  dir: SortDirection;
};

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseDirection(value: unknown): SortDirection | undefined {
  const dir = toOptionalString(value);
  if (dir === 'asc' || dir === 'desc') {
    return dir;
  }
  return undefined;
}

export function parseSortBy<T extends string>(value: unknown, allowed: Set<T>): T | undefined {
  const raw = toOptionalString(value);
  if (!raw) {
    return undefined;
  }
  return allowed.has(raw as T) ? (raw as T) : undefined;
}
