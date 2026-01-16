export type TableHeadCell = {
  text?: string;
  html?: string;
  format?: string;
  attributes?: Record<string, string>;
};

export function buildSortHeadCell(params: {
  label: string;
  sortKey: string;
  format?: string;
  activeSort: { by: string; dir: 'asc' | 'desc' };
}): TableHeadCell {
  const { label, sortKey, format, activeSort } = params;
  const isActive = activeSort.by === sortKey;
  const attributes: Record<string, string> = {
    'data-sort-key': sortKey,
  };
  if (isActive) {
    attributes['data-sort-dir'] = activeSort.dir;
    attributes['aria-sort'] = activeSort.dir === 'asc' ? 'ascending' : 'descending';
  }
  return {
    text: label,
    format,
    attributes,
  };
}
