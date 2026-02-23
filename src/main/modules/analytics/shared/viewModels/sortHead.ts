export type TableHeadCell = {
  text?: string;
  html?: string;
  format?: string;
  attributes?: Record<string, string>;
};

export function buildSortHeadCell(params: {
  label: string;
  className?: string;
  sortKey: string;
  format?: string;
  defaultDir?: 'asc' | 'desc';
  activeSort: { by: string; dir: 'asc' | 'desc' };
}): TableHeadCell {
  const { label, className, sortKey, format, defaultDir, activeSort } = params;
  const isActive = activeSort.by === sortKey;
  const attributes: Record<string, string> = {
    'data-sort-key': sortKey,
    'aria-sort': 'none',
  };
  if (className) {
    attributes.class = className;
  }
  if (defaultDir) {
    attributes['data-sort-default-dir'] = defaultDir;
  }
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
