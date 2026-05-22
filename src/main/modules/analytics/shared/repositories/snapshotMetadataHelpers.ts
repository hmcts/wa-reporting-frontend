type SnapshotIdValue = bigint | number | string | null;

export type PublishedSnapshot = {
  snapshotId: number;
  publishedAt?: Date;
};

export function parseSnapshotId(value: SnapshotIdValue): number | null {
  if (value === null) {
    return null;
  }

  const parsed = typeof value === 'bigint' ? Number(value) : Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid published snapshot id: ${value}`);
  }
  return parsed;
}

export function parsePublishedAt(value: Date | string | null | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid published_at timestamp: ${value}`);
  }
  return parsed;
}
