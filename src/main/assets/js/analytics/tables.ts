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

export function moveTotalsRowToEnd(table: HTMLTableElement): void {
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

export function initMojTotalsRowPinning(): void {
  const tables = document.querySelectorAll<HTMLTableElement>(
    '[data-module="moj-sortable-table"][data-sticky-totals="true"]'
  );
  tables.forEach(table => {
    if (table.dataset.mojTotalsPinnedBound === 'true') {
      return;
    }
    const moveTotals = () => {
      window.requestAnimationFrame(() => moveTotalsRowToEnd(table));
    };
    table.addEventListener('click', moveTotals);
    moveTotalsRowToEnd(table);
    table.dataset.mojTotalsPinnedBound = 'true';
  });
}
