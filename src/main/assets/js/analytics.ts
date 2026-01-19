import { initAll as initMojAll } from '@ministryofjustice/frontend';
import { initAll } from 'govuk-frontend';
import type { Config } from 'plotly.js';
import Plotly from 'plotly.js-basic-dist-min';
import '../scss/analytics.scss';

type PlotlyData = Record<string, unknown>;
type PlotlyConfig = {
  data: PlotlyData[];
  layout?: Record<string, unknown>;
  config?: Record<string, unknown>;
};

declare global {
  interface Window {
    Plotly?: typeof Plotly;
  }
}

window.Plotly = Plotly;

const baseLayout = {
  autosize: true,
  margin: { t: 0, r: 0, b: 0, l: 0, pad: 0 },
  xaxis: { automargin: true },
  yaxis: { automargin: true },
};

const baseChartConfig: Partial<Config> = {
  displaylogo: false,
  displayModeBar: true,
  responsive: true,
  scrollZoom: false,
  modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
};

const numberFormatter = new Intl.NumberFormat('en-GB');

function getScrollStorageKey(): string {
  return `analytics:scroll:${window.location.pathname}`;
}

function storeScrollPosition(): void {
  try {
    window.sessionStorage.setItem(getScrollStorageKey(), String(window.scrollY));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to store scroll position', error);
  }
}

function restoreScrollPosition(): void {
  try {
    const raw = window.sessionStorage.getItem(getScrollStorageKey());
    if (!raw) {
      return;
    }
    window.sessionStorage.removeItem(getScrollStorageKey());
    const scrollY = Number(raw);
    if (Number.isFinite(scrollY)) {
      window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to restore scroll position', error);
  }
}

function getAnalyticsFiltersForm(): HTMLFormElement | null {
  return document.querySelector<HTMLFormElement>('form[data-analytics-filters="true"]');
}

function setHiddenInput(form: HTMLFormElement, name: string, value: string): void {
  let input = form.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) {
    input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    form.appendChild(input);
  }
  input.value = value;
}

function labelModebarButtons(container: HTMLElement): void {
  const buttons = container.querySelectorAll<HTMLAnchorElement>('.modebar-btn');
  buttons.forEach(button => {
    if (button.getAttribute('aria-label') || button.getAttribute('title')) {
      return;
    }
    const label = button.getAttribute('data-title') || button.getAttribute('title');
    if (label) {
      button.setAttribute('title', label);
      button.setAttribute('aria-label', label);
    }
  });
}

function renderCharts(): void {
  const nodes = document.querySelectorAll<HTMLElement>('[data-chart-config]');
  nodes.forEach(node => {
    const raw = node.dataset.chartConfig;
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as PlotlyConfig;
      const parsedConfig = parsed.config ?? {};
      const parsedLayout = parsed.layout ?? {};
      const layout = {
        ...baseLayout,
        ...parsedLayout,
        margin: { ...baseLayout.margin, ...(parsedLayout.margin ?? {}) },
      };
      Plotly.newPlot(node, parsed.data, layout, { ...baseChartConfig, ...parsedConfig }).then(() => {
        labelModebarButtons(node);
      });
      if (node.dataset.scrollPan === 'true') {
        bindScrollPan(node, parsed);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to render chart', error);
    }
  });
}

function escapeCsvValue(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function tableToCsv(table: HTMLTableElement): string {
  const rows = Array.from(table.querySelectorAll('tr'));
  const csvLines = rows.map(row => {
    const cells = Array.from(row.querySelectorAll('th, td'));
    const values = cells.map(cell => escapeCsvValue(cell.textContent?.trim() ?? ''));
    return values.join(',');
  });
  return csvLines.join('\n');
}

function initTableExports(): void {
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

function compareValues(a: string, b: string): number {
  const numA = Number.parseFloat(a.replace(/,/g, ''));
  const numB = Number.parseFloat(b.replace(/,/g, ''));
  const aIsNum = !Number.isNaN(numA) && a !== '';
  const bIsNum = !Number.isNaN(numB) && b !== '';
  if (aIsNum && bIsNum) {
    return numA - numB;
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function initTableSorting(): void {
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

function moveStickyTotalsRow(table: HTMLTableElement): void {
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

function initMojStickyTotals(): void {
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

function initAjaxFilterSections(): void {
  const forms = document.querySelectorAll<HTMLFormElement>('form[data-ajax-section]');
  forms.forEach(form => {
    if (form.dataset.ajaxBound === 'true') {
      return;
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      const sectionId = form.dataset.ajaxSection;
      if (!sectionId) {
        form.submit();
        return;
      }
      void fetchSectionUpdate(form, sectionId);
    });
    form.dataset.ajaxBound = 'true';
  });
}

function initAutoSubmitForms(): void {
  const forms = document.querySelectorAll<HTMLFormElement>('form[data-auto-submit="true"]');
  forms.forEach(form => {
    if (form.dataset.autoSubmitBound === 'true') {
      return;
    }
    form.addEventListener('change', event => {
      const target = event.target;
      if (target instanceof HTMLInputElement && (target.type === 'radio' || target.type === 'checkbox')) {
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          form.submit();
        }
      }
    });
    form.dataset.autoSubmitBound = 'true';
  });
}

function buildUrlEncodedBody(form: HTMLFormElement, extra: Record<string, string> = {}): URLSearchParams {
  const formData = new FormData(form);
  const params = new URLSearchParams();
  formData.forEach((value, key) => {
    if (typeof value === 'string') {
      params.append(key, value);
      return;
    }
    params.append(key, value.name);
  });
  Object.entries(extra).forEach(([key, value]) => {
    params.set(key, value);
  });
  return params;
}

async function postAjaxForm(form: HTMLFormElement, extra: Record<string, string>): Promise<string> {
  const response = await fetch(form.action || window.location.pathname, {
    method: form.method || 'POST',
    headers: {
      'X-Requested-With': 'fetch',
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: buildUrlEncodedBody(form, extra).toString(),
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch section: ${response.status}`);
  }
  return response.text();
}

function rebindSectionBehaviors(): void {
  renderCharts();
  initTableExports();
  initTableSorting();
  initMojStickyTotals();
  initAjaxFilterSections();
  initAutoSubmitForms();
  initCriticalTasksPagination();
  initUserOverviewPagination();
}

async function fetchSectionUpdate(form: HTMLFormElement, sectionId: string): Promise<void> {
  const target = document.querySelector<HTMLElement>(`[data-section="${sectionId}"]`);
  if (!target) {
    form.submit();
    return;
  }
  try {
    const html = await postAjaxForm(form, { ajaxSection: sectionId });
    target.innerHTML = html;
    initAll({ scope: target });
    initMojAll({ scope: target });
    rebindSectionBehaviors();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to update section', error);
    form.submit();
  }
}

async function fetchSortedSection(form: HTMLFormElement, scope: string, sectionId?: string): Promise<void> {
  const resolvedSectionId = sectionId ?? `user-overview-${scope}`;
  const target = document.querySelector<HTMLElement>(`[data-section="${resolvedSectionId}"]`);
  if (!target) {
    storeScrollPosition();
    form.submit();
    return;
  }
  try {
    const html = await postAjaxForm(form, { ajaxSection: scope });
    target.innerHTML = html;
    rebindSectionBehaviors();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to update sorted section', error);
    storeScrollPosition();
    form.submit();
  }
}

function getPaginationParamFromHref(href: string, param: string): string | null {
  try {
    const url = new URL(href, window.location.origin);
    return url.searchParams.get(param);
  } catch {
    return null;
  }
}

async function fetchPaginatedSection(
  form: HTMLFormElement,
  sectionId: string,
  ajaxSection: string,
  pageParam: string,
  page: string
): Promise<void> {
  const target = document.querySelector<HTMLElement>(`[data-section="${sectionId}"]`);
  if (!target) {
    storeScrollPosition();
    form.submit();
    return;
  }
  try {
    const html = await postAjaxForm(form, { ajaxSection, [pageParam]: page });
    target.innerHTML = html;
    rebindSectionBehaviors();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to update paginated section', error);
    storeScrollPosition();
    form.submit();
  }
}

function initCriticalTasksPagination(): void {
  const paginations = document.querySelectorAll<HTMLElement>('[data-critical-tasks-pagination="true"]');
  paginations.forEach(pagination => {
    if (pagination.dataset.paginationBound === 'true') {
      return;
    }
    pagination.addEventListener('click', event => {
      const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a');
      if (!link || !link.href) {
        return;
      }
      const page = getPaginationParamFromHref(link.href, 'criticalTasksPage');
      if (!page) {
        return;
      }
      const form = getAnalyticsFiltersForm();
      if (!form) {
        return;
      }
      event.preventDefault();
      setHiddenInput(form, 'criticalTasksPage', page);
      void fetchPaginatedSection(form, 'outstanding-critical-tasks', 'criticalTasks', 'criticalTasksPage', page);
    });
    pagination.dataset.paginationBound = 'true';
  });
}

function initUserOverviewPagination(): void {
  const paginations = document.querySelectorAll<HTMLElement>('[data-user-overview-pagination]');
  paginations.forEach(pagination => {
    if (pagination.dataset.paginationBound === 'true') {
      return;
    }
    const scope = pagination.dataset.userOverviewPagination;
    if (!scope) {
      return;
    }
    pagination.addEventListener('click', event => {
      const link = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a');
      if (!link || !link.href) {
        return;
      }
      const pageParam = scope === 'completed' ? 'completedPage' : 'assignedPage';
      const page = getPaginationParamFromHref(link.href, pageParam);
      if (!page) {
        return;
      }
      const form = getAnalyticsFiltersForm();
      if (!form) {
        return;
      }
      const sectionId = scope === 'completed' ? 'user-overview-completed' : 'user-overview-assigned';
      event.preventDefault();
      setHiddenInput(form, pageParam, page);
      void fetchPaginatedSection(form, sectionId, scope, pageParam, page);
    });
    pagination.dataset.paginationBound = 'true';
  });
}

function getFilterStorageKey(_form: HTMLFormElement): string {
  return 'analyticsFilters:global';
}

function getAutoSubmitKey(form: HTMLFormElement): string {
  const names = Array.from(form.elements)
    .map(element =>
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
        ? element.name
        : ''
    )
    .filter(name => name && name !== '_csrf');
  const unique = Array.from(new Set(names)).sort().join('|');
  return `analyticsFilters:autoSubmit:${window.location.pathname}:${unique}`;
}

function getFormFieldNames(form: HTMLFormElement): string[] {
  const names = Array.from(form.elements)
    .map(element =>
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
        ? element.name
        : ''
    )
    .filter(name => name && name !== '_csrf');
  return Array.from(new Set(names));
}

function escapeForSelector(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
}

function serialiseFilters(form: HTMLFormElement): Record<string, string[]> {
  const data: Record<string, string[]> = {};
  const formData = new FormData(form);
  formData.forEach((value, key) => {
    if (key === '_csrf') {
      return;
    }
    const rawValue = String(value);
    if (!rawValue.trim()) {
      return;
    }
    const current = data[key] ?? [];
    current.push(rawValue);
    data[key] = current;
  });
  return data;
}

function filterDataForForm(form: HTMLFormElement, data: Record<string, string[]>): Record<string, string[]> {
  const filtered: Record<string, string[]> = {};
  Object.entries(data).forEach(([name, values]) => {
    const selector = `[name="${escapeForSelector(name)}"]`;
    if (form.querySelector(selector)) {
      filtered[name] = values;
    }
  });
  return filtered;
}

function normaliseMultiSelectSelections(form: HTMLFormElement): void {
  const groups = form.querySelectorAll<HTMLDetailsElement>('[data-module="analytics-multiselect"]');
  groups.forEach(details => {
    const items = Array.from(details.querySelectorAll<HTMLInputElement>('[data-multiselect-item]'));
    if (items.length === 0) {
      return;
    }
    const checkedItems = items.filter(item => item.checked);
    if (checkedItems.length !== items.length) {
      return;
    }
    items.forEach(item => {
      item.checked = false;
    });
    const selectAll = details.querySelector<HTMLInputElement>('[data-select-all]');
    if (selectAll) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }
  });
}

function hasStoredValues(data: Record<string, string[]>): boolean {
  return Object.values(data).some(values => values.length > 0);
}

function applyFilters(form: HTMLFormElement, data: Record<string, string[]>): void {
  Object.entries(data).forEach(([name, values]) => {
    const selector = `[name="${escapeForSelector(name)}"]`;
    const elements = Array.from(
      form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector)
    );
    elements.forEach(element => {
      if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
        element.checked = values.includes(element.value);
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      element.value = values[0] ?? '';
    });
  });
}

function formHasValues(form: HTMLFormElement): boolean {
  const elements = Array.from(form.elements) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[];
  return elements.some(element => {
    if (!('name' in element) || !element.name || element.name === '_csrf') {
      return false;
    }
    if (element instanceof HTMLInputElement) {
      if (element.type === 'hidden' || element.type === 'submit' || element.type === 'button') {
        return false;
      }
    }
    if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
      return element.checked;
    }
    return element.value.trim().length > 0;
  });
}

function initFilterPersistence(): void {
  const forms = document.querySelectorAll<HTMLFormElement>('form[data-analytics-filters="true"]');
  forms.forEach(form => {
    const storageKey = getFilterStorageKey(form);
    const autoSubmitKey = getAutoSubmitKey(form);
    const resetButtons = form.querySelectorAll<HTMLElement>('[data-analytics-filters-reset="true"]');

    resetButtons.forEach(button => {
      button.addEventListener('click', () => {
        window.localStorage.removeItem(storageKey);
      });
    });

    form.addEventListener('submit', () => {
      normaliseMultiSelectSelections(form);
      const data = serialiseFilters(form);
      const existingRaw = window.localStorage.getItem(storageKey);
      const existing = existingRaw ? (JSON.parse(existingRaw) as Record<string, string[]>) : {};
      const fieldNames = getFormFieldNames(form);
      fieldNames.forEach(name => {
        delete existing[name];
      });
      Object.entries(data).forEach(([name, values]) => {
        if (values.length > 0) {
          existing[name] = values;
        }
      });
      if (hasStoredValues(existing)) {
        window.localStorage.setItem(storageKey, JSON.stringify(existing));
      } else {
        window.localStorage.removeItem(storageKey);
      }
    });

    if (formHasValues(form)) {
      return;
    }

    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return;
    }
    try {
      const data = JSON.parse(raw) as Record<string, string[]>;
      if (!hasStoredValues(data)) {
        window.localStorage.removeItem(storageKey);
        return;
      }
      const formData = filterDataForForm(form, data);
      if (!hasStoredValues(formData)) {
        return;
      }
      applyFilters(form, formData);
      if (!formHasValues(form)) {
        return;
      }
      const fingerprint = JSON.stringify(formData);
      if (window.sessionStorage.getItem(autoSubmitKey) === fingerprint) {
        return;
      }
      window.sessionStorage.setItem(autoSubmitKey, fingerprint);
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.submit();
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  });
}

function initMultiSelects(): void {
  const nodes = document.querySelectorAll<HTMLDetailsElement>('[data-module="analytics-multiselect"]');
  nodes.forEach(details => {
    if (details.dataset.multiselectBound === 'true') {
      return;
    }
    const summary = details.querySelector<HTMLElement>('[data-multiselect-summary]');
    const selectAll = details.querySelector<HTMLInputElement>('[data-select-all]');
    const items = Array.from(details.querySelectorAll<HTMLInputElement>('[data-multiselect-item]'));
    const searchInput = details.querySelector<HTMLInputElement>('[data-multiselect-search="true"]');
    const searchCount = details.querySelector<HTMLElement>('[data-multiselect-search-count="true"]');
    const itemEntries = items
      .map(item => {
        const wrapper = item.closest<HTMLElement>('.govuk-checkboxes__item');
        if (!wrapper) {
          return null;
        }
        const label = (item.dataset.itemLabel ?? item.value).toLowerCase();
        return { item, wrapper, label };
      })
      .filter((entry): entry is { item: HTMLInputElement; wrapper: HTMLElement; label: string } => entry !== null);
    const allText = details.dataset.allText ?? 'All';

    const getSelectableItems = () => {
      if (!searchInput) {
        return itemEntries;
      }
      const term = searchInput.value.trim().toLowerCase();
      if (!term) {
        return itemEntries;
      }
      return itemEntries.filter(entry => entry.wrapper.style.display !== 'none');
    };

    const updateSearch = () => {
      if (!searchInput) {
        return;
      }
      const term = searchInput.value.trim().toLowerCase();
      let visibleCount = 0;
      itemEntries.forEach(entry => {
        const match = term.length === 0 || entry.label.includes(term);
        entry.wrapper.style.display = match ? '' : 'none';
        entry.wrapper.setAttribute('aria-hidden', match ? 'false' : 'true');
        if (match) {
          visibleCount += 1;
        }
      });
      if (searchCount) {
        if (term.length === 0) {
          searchCount.textContent = `${itemEntries.length} options`;
        } else if (visibleCount === 0) {
          searchCount.textContent = 'No matching options';
        } else {
          searchCount.textContent = `${visibleCount} of ${itemEntries.length} options`;
        }
      }
    };

    const updateSummary = () => {
      if (!summary) {
        return;
      }
      const checkedItems = items.filter(item => item.checked);
      if (checkedItems.length === 0 || checkedItems.length === items.length) {
        summary.textContent = allText;
        return;
      }
      if (checkedItems.length === 1) {
        summary.textContent = checkedItems[0]?.dataset.itemLabel ?? checkedItems[0]?.value ?? allText;
        return;
      }
      summary.textContent = `${checkedItems.length} selected`;
    };

    const updateSelectAllState = () => {
      if (!selectAll) {
        return;
      }
      const selectable = getSelectableItems();
      const checkedCount = selectable.filter(entry => entry.item.checked).length;
      selectAll.checked = selectable.length > 0 && checkedCount === selectable.length;
      selectAll.indeterminate = checkedCount > 0 && checkedCount < selectable.length;
    };

    const updateAll = () => {
      updateSelectAllState();
      updateSummary();
    };

    if (selectAll) {
      selectAll.addEventListener('change', () => {
        const shouldCheck = selectAll.checked;
        const selectable = getSelectableItems();
        selectable.forEach(entry => {
          entry.item.checked = shouldCheck;
        });
        updateAll();
      });
    }

    items.forEach(item => {
      item.addEventListener('change', updateAll);
    });

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        updateSearch();
        updateAll();
      });
    }

    details.addEventListener('keydown', event => {
      if (event.key !== 'Escape') {
        return;
      }
      details.open = false;
      details.querySelector<HTMLElement>('summary')?.focus();
    });

    document.addEventListener('click', event => {
      if (!details.open) {
        return;
      }
      if (!details.contains(event.target as Node)) {
        details.open = false;
      }
    });

    updateSearch();
    updateAll();
    details.dataset.multiselectBound = 'true';
  });
}

type OpenByNameRow = {
  name: string;
  urgent: number;
  high: number;
  medium: number;
  low: number;
};

type OpenByNameApiResponse = {
  breakdown: OpenByNameRow[];
  totals: OpenByNameRow;
  chart: PlotlyConfig;
};

function renderOpenByNameChart(node: HTMLElement, config: PlotlyConfig): void {
  const parsedLayout = config.layout ?? {};
  const layout = {
    ...baseLayout,
    ...parsedLayout,
    margin: { ...baseLayout.margin, ...(parsedLayout.margin ?? {}) },
  };
  Plotly.newPlot(node, config.data, layout, { ...baseChartConfig, ...(config.config ?? {}) });
  bindScrollPan(node, config);
}

function createNumericCell(value: number, isTotal: boolean): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.className = 'govuk-table__cell govuk-table__cell--numeric';
  if (isTotal) {
    cell.classList.add('govuk-!-font-weight-bold');
  }
  cell.textContent = numberFormatter.format(value);
  return cell;
}

function renderOpenByNameTable(body: HTMLElement, rows: OpenByNameRow[], totals: OpenByNameRow): void {
  body.innerHTML = '';
  if (rows.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.className = 'govuk-table__row';
    const cell = document.createElement('td');
    cell.className = 'govuk-table__cell';
    cell.colSpan = 5;
    cell.textContent = 'No open tasks found.';
    emptyRow.appendChild(cell);
    body.appendChild(emptyRow);
    return;
  }

  const combined = [...rows, { ...totals, name: 'Total' }];
  combined.forEach((row, index) => {
    const isTotal = index === rows.length;
    const tr = document.createElement('tr');
    tr.className = 'govuk-table__row';

    const nameCell = document.createElement('td');
    nameCell.className = 'govuk-table__cell';
    if (isTotal) {
      nameCell.classList.add('govuk-!-font-weight-bold');
    }
    nameCell.textContent = row.name;
    tr.appendChild(nameCell);

    tr.appendChild(createNumericCell(row.urgent, isTotal));
    tr.appendChild(createNumericCell(row.high, isTotal));
    tr.appendChild(createNumericCell(row.medium, isTotal));
    tr.appendChild(createNumericCell(row.low, isTotal));

    body.appendChild(tr);
  });
}

async function initOpenByName(): Promise<void> {
  const container = document.querySelector<HTMLElement>('[data-open-by-name]');
  if (!container) {
    return;
  }
  const chartNode = container.querySelector<HTMLElement>('[data-open-by-name-chart]');
  const tableBody = container.querySelector<HTMLTableSectionElement>('[data-open-by-name-table] tbody');
  const errorNode = container.querySelector<HTMLElement>('[data-open-by-name-error]');
  const initialScript = container.querySelector<HTMLScriptElement>('[data-open-by-name-initial]');
  const initialRaw = initialScript?.textContent?.trim();
  if (!chartNode || !tableBody) {
    return;
  }

  const render = (payload: OpenByNameApiResponse) => {
    renderOpenByNameChart(chartNode, payload.chart);
    renderOpenByNameTable(tableBody, payload.breakdown, payload.totals);
    if (errorNode) {
      errorNode.classList.add('govuk-visually-hidden');
    }
  };

  try {
    if (initialRaw) {
      try {
        const initial = JSON.parse(initialRaw) as OpenByNameApiResponse;
        render(initial);
      } catch (parseError) {
        // eslint-disable-next-line no-console
        console.error('Failed to parse initial open-by-name data', parseError);
      }
    }
    if (!initialRaw) {
      throw new Error('Open-by-name data is unavailable.');
    }
  } catch (error) {
    chartNode.innerHTML = '<p class="govuk-body">Unable to load chart.</p>';
    tableBody.innerHTML =
      '<tr class="govuk-table__row"><td colspan="5" class="govuk-table__cell">Unable to load open tasks.</td></tr>';
    if (errorNode) {
      errorNode.classList.remove('govuk-visually-hidden');
    }
    // eslint-disable-next-line no-console
    console.error('Failed to load open tasks by name', error);
  }
}

function bindScrollPan(node: HTMLElement, config: PlotlyConfig): void {
  if (node.dataset.scrollPanBound === 'true') {
    return;
  }
  const categories = (config.data?.[0] as { y?: unknown })?.y;
  const categoryCount = Array.isArray(categories) ? categories.length : 0;
  if (categoryCount <= 0) {
    return;
  }

  const track = document.createElement('div');
  track.className = 'analytics-chart-scroll-track';
  const handle = document.createElement('div');
  handle.className = 'analytics-chart-scroll-handle';
  track.appendChild(handle);
  node.appendChild(track);

  const updateScrollHandle = () => {
    const graph = node as unknown as {
      _fullLayout?: { yaxis?: { range?: [number, number] } };
    };
    const range = graph._fullLayout?.yaxis?.range;
    if (!range) {
      return;
    }
    const windowSize = range[0] - range[1];
    const min = -0.5;
    const max = categoryCount - 0.5;
    const totalSpan = max - min;
    const availableSpan = totalSpan - windowSize;
    if (availableSpan <= 0) {
      track.style.display = 'none';
      return;
    }
    track.style.display = '';
    const trackHeight = track.getBoundingClientRect().height;
    const handleHeight = Math.max(24, (windowSize / totalSpan) * trackHeight);
    const position = (range[0] - (min + windowSize)) / availableSpan;
    const top = Math.min(trackHeight - handleHeight, Math.max(0, position * (trackHeight - handleHeight)));
    handle.style.height = `${handleHeight}px`;
    handle.style.top = `${top}px`;
  };

  let dragOffset = 0;
  let pendingDragTop: number | null = null;
  let dragRafId: number | null = null;
  const applyDragMove = () => {
    dragRafId = null;
    const graph = node as unknown as {
      _fullLayout?: { yaxis?: { range?: [number, number] } };
    };
    const range = graph._fullLayout?.yaxis?.range;
    if (!range || pendingDragTop === null) {
      pendingDragTop = null;
      return;
    }
    const rect = track.getBoundingClientRect();
    const windowSize = range[0] - range[1];
    const min = -0.5;
    const max = categoryCount - 0.5;
    const totalSpan = max - min;
    const availableSpan = totalSpan - windowSize;
    if (availableSpan <= 0) {
      pendingDragTop = null;
      return;
    }
    const trackHeight = rect.height;
    const handleHeight = Math.max(24, (windowSize / totalSpan) * trackHeight);
    const clampedTop = Math.min(trackHeight - handleHeight, Math.max(0, pendingDragTop));
    pendingDragTop = null;
    const position = clampedTop / (trackHeight - handleHeight);
    const nextLower = min + availableSpan * position;
    const nextUpper = nextLower + windowSize;
    void Plotly.relayout(node, { 'yaxis.range': [nextUpper, nextLower] });
  };

  const onDragMove = (event: MouseEvent) => {
    const rect = track.getBoundingClientRect();
    pendingDragTop = event.clientY - rect.top - dragOffset;
    if (dragRafId === null) {
      dragRafId = window.requestAnimationFrame(applyDragMove);
    }
  };

  const onDragEnd = () => {
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
    pendingDragTop = null;
    if (dragRafId !== null) {
      window.cancelAnimationFrame(dragRafId);
      dragRafId = null;
    }
  };

  handle.addEventListener('mousedown', event => {
    event.preventDefault();
    const rect = handle.getBoundingClientRect();
    dragOffset = event.clientY - rect.top;
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
  });

  const plotlyNode = node as unknown as { on?: (event: string, handler: () => void) => void };
  plotlyNode.on?.('plotly_relayout', updateScrollHandle);

  let pendingStep = 0;
  let rafId: number | null = null;
  const applyWheelStep = () => {
    rafId = null;
    const graph = node as unknown as {
      _fullLayout?: { yaxis?: { range?: [number, number] } };
    };
    const range = graph._fullLayout?.yaxis?.range;
    if (!range || pendingStep === 0) {
      pendingStep = 0;
      return;
    }
    const step = pendingStep;
    pendingStep = 0;
    const windowSize = range[0] - range[1];
    const min = -0.5;
    const max = categoryCount - 0.5;
    const nextUpper = Math.min(max, Math.max(min + windowSize, range[0] + step));
    const nextLower = nextUpper - windowSize;
    void Plotly.relayout(node, { 'yaxis.range': [nextUpper, nextLower] });
  };

  node.addEventListener(
    'wheel',
    event => {
      if (event.deltaY === 0) {
        return;
      }
      event.preventDefault();
      pendingStep += Math.sign(event.deltaY) * 3;
      if (rafId === null) {
        rafId = window.requestAnimationFrame(applyWheelStep);
      }
    },
    { passive: false }
  );
  updateScrollHandle();
  node.dataset.scrollPanBound = 'true';
}

document.addEventListener('DOMContentLoaded', () => {
  renderCharts();
  initMojAll();
  initTableExports();
  initTableSorting();
  initMojStickyTotals();
  initCriticalTasksPagination();
  initUserOverviewPagination();
  initMultiSelects();
  initFilterPersistence();
  void initOpenByName();
  initAjaxFilterSections();
  initAutoSubmitForms();
  restoreScrollPosition();
});
