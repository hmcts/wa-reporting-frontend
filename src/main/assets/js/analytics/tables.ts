import type { FetchSortedSection } from './ajax';
import { getAnalyticsFiltersForm, setHiddenInput } from './forms';

function escapeCsvValue(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function tableToCsv(table: HTMLTableElement): string {
  const rows = Array.from(table.querySelectorAll('tr'));
  const csvLines = rows.map(row => {
    const cells = Array.from(row.querySelectorAll('th, td'));
    const values = cells.map(cell => escapeCsvValue(cell.textContent?.trim() ?? ''));
    return values.join(',');
  });
  return csvLines.join('\n');
}

export function initTableExports(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-export-csv-button]');
  buttons.forEach(button => {
    if (button.dataset.exportBound === 'true') {
      return;
    }
    const container = button.closest('[data-export-csv-container]');
    const table =
      container?.querySelector<HTMLTableElement>('[data-export-csv="true"]') ??
      button.parentElement?.querySelector<HTMLTableElement>('[data-export-csv="true"]') ??
      (button.nextElementSibling instanceof HTMLTableElement ? button.nextElementSibling : null);
    if (!table) {
      return;
    }
    const filename = table.dataset.exportFilename || 'table.csv';
    button.addEventListener('click', () => {
      const csv = tableToCsv(table);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
    button.dataset.exportBound = 'true';
    table.dataset.exportBound = 'true';
  });
}

function getCellValue(row: HTMLTableRowElement, index: number): string {
  const cell = row.querySelectorAll<HTMLElement>('td, th')[index];
  return cell?.textContent?.trim() ?? '';
}

export function compareValues(a: string, b: string): number {
  const numA = Number.parseFloat(a.replace(/,/g, ''));
  const numB = Number.parseFloat(b.replace(/,/g, ''));
  const aIsNum = !Number.isNaN(numA) && a !== '';
  const bIsNum = !Number.isNaN(numB) && b !== '';
  if (aIsNum && bIsNum) {
    return numA - numB;
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function initTableSorting(fetchSortedSection: FetchSortedSection): void {
  const tables = document.querySelectorAll<HTMLTableElement>('[data-sortable="true"]');
  tables.forEach(table => {
    if (table.dataset.sortBound === 'true') {
      return;
    }
    const headers = table.querySelectorAll<HTMLTableHeaderCellElement>('thead th');
    const body = table.querySelector('tbody');
    if (!body || headers.length === 0) {
      return;
    }
    const isServerSort = table.dataset.serverSort === 'true';
    headers.forEach(th => {
      th.classList.add('analytics-sortable-header');
    });
    if (isServerSort) {
      const scope = table.dataset.sortScope;
      const sectionId = table.dataset.sortSection;
      const form = getAnalyticsFiltersForm();
      if (!scope || !form) {
        return;
      }
      headers.forEach(th => {
        const sortKey = th.dataset.sortKey;
        if (!sortKey) {
          return;
        }
        th.addEventListener('click', event => {
          const button = (event.target as HTMLElement | null)?.closest('button');
          if (button && button instanceof HTMLButtonElement && button.disabled) {
            return;
          }
          const nextDir = th.dataset.sortDir === 'asc' ? 'desc' : 'asc';
          setHiddenInput(form, `${scope}SortBy`, sortKey);
          setHiddenInput(form, `${scope}SortDir`, nextDir);
          if (scope === 'criticalTasks') {
            setHiddenInput(form, 'criticalTasksPage', '1');
          }
          if (scope === 'assigned') {
            setHiddenInput(form, 'assignedPage', '1');
          }
          if (scope === 'completed') {
            setHiddenInput(form, 'completedPage', '1');
          }
          void fetchSortedSection(form, scope, sectionId);
        });
      });
      table.dataset.sortBound = 'true';
      return;
    }

    const sortTable = (index: number, direction: 'asc' | 'desc', activeHeader?: HTMLTableHeaderCellElement) => {
      const rows = Array.from(body.querySelectorAll<HTMLTableRowElement>('tr'));
      const totals = rows.filter(row => getCellValue(row, 0).toLowerCase() === 'total');
      const sortableRows = rows.filter(row => !totals.includes(row));

      sortableRows.sort((rowA, rowB) => {
        const result = compareValues(getCellValue(rowA, index), getCellValue(rowB, index));
        return direction === 'asc' ? result : -result;
      });

      body.innerHTML = '';
      sortableRows.forEach(row => body.appendChild(row));
      totals.forEach(row => body.appendChild(row));

      if (activeHeader) {
        headers.forEach(header => {
          if (header !== activeHeader) {
            delete header.dataset.sortDir;
          }
        });
        activeHeader.dataset.sortDir = direction;
      }
    };

    headers.forEach((th, index) => {
      th.addEventListener('click', () => {
        const currentDir = th.dataset.sortDir === 'asc' ? 'desc' : 'asc';
        sortTable(index, currentDir, th);
      });
    });

    const defaultIndex = Number.parseInt(table.dataset.sortDefault ?? '', 10);
    const defaultDir = table.dataset.sortDefaultDir === 'desc' ? 'desc' : 'asc';
    if (!Number.isNaN(defaultIndex) && headers[defaultIndex]) {
      sortTable(defaultIndex, defaultDir, headers[defaultIndex]);
    }

    table.dataset.sortBound = 'true';
  });
}

export function initMojServerSorting(fetchSortedSection: FetchSortedSection): void {
  const tables = document.querySelectorAll<HTMLTableElement>(
    '[data-module="moj-sortable-table"][data-server-sort="true"]'
  );
  tables.forEach(table => {
    if (table.dataset.mojServerSortBound === 'true') {
      return;
    }
    const scope = table.dataset.sortScope;
    const head = table.querySelector('thead');
    const form = getAnalyticsFiltersForm();
    if (!scope || !head || !form) {
      return;
    }
    const sectionId = table.dataset.sortSection;
    head.addEventListener(
      'click',
      event => {
        const target = event.target as HTMLElement | null;
        const button = target?.closest('button');
        if (!button) {
          return;
        }
        const heading = button.closest('th');
        if (!heading) {
          return;
        }
        const sortKey = heading.dataset.sortKey;
        if (!sortKey) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        const currentDir = heading.getAttribute('aria-sort');
        const nextDir = currentDir === 'ascending' ? 'desc' : 'asc';
        setHiddenInput(form, `${scope}SortBy`, sortKey);
        setHiddenInput(form, `${scope}SortDir`, nextDir);
        if (scope === 'criticalTasks') {
          setHiddenInput(form, 'criticalTasksPage', '1');
        }
        if (scope === 'assigned') {
          setHiddenInput(form, 'assignedPage', '1');
        }
        if (scope === 'completed') {
          setHiddenInput(form, 'completedPage', '1');
        }
        void fetchSortedSection(form, scope, sectionId);
      },
      { capture: true }
    );
    table.dataset.mojServerSortBound = 'true';
  });
}

export function moveStickyTotalsRow(table: HTMLTableElement): void {
  const body = table.querySelector('tbody');
  if (!body) {
    return;
  }
  const totalsCell = body.querySelector<HTMLElement>('[data-total-row="true"]');
  const totalsRow = totalsCell?.closest('tr');
  if (!totalsRow) {
    return;
  }
  body.appendChild(totalsRow);
}

export function initMojStickyTotals(): void {
  const tables = document.querySelectorAll<HTMLTableElement>(
    '[data-module="moj-sortable-table"][data-sticky-totals="true"]'
  );
  tables.forEach(table => {
    if (table.dataset.mojStickyTotalsBound === 'true') {
      return;
    }
    const moveTotals = () => {
      window.requestAnimationFrame(() => moveStickyTotalsRow(table));
    };
    table.addEventListener('click', moveTotals);
    moveStickyTotalsRow(table);
    table.dataset.mojStickyTotalsBound = 'true';
  });
}
