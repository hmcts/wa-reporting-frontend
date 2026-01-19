/* @jest-environment jsdom */
import { initAll as initMojAll } from '@ministryofjustice/frontend';
import { initAll } from 'govuk-frontend';

import type { AjaxDeps } from '../../../../main/assets/js/analytics/ajax';
import { fetchSortedSection } from '../../../../main/assets/js/analytics/ajax';
import {
  compareValues,
  initMojServerSorting,
  initMojStickyTotals,
  initTableExports,
  initTableSorting,
  moveStickyTotalsRow,
  tableToCsv,
} from '../../../../main/assets/js/analytics/tables';

import { setupAnalyticsDom } from './analyticsTestUtils';

jest.mock('govuk-frontend', () => ({ initAll: jest.fn() }));
jest.mock('@ministryofjustice/frontend', () => ({ initAll: jest.fn() }));

const flushPromises = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 0));
};

describe('analytics tables', () => {
  let ajaxDeps: AjaxDeps;
  const fetchSortedSectionWithDeps = (form: HTMLFormElement, scope: string, sectionId?: string): Promise<void> =>
    fetchSortedSection(form, scope, sectionId, ajaxDeps);

  beforeEach(() => {
    setupAnalyticsDom();
    ajaxDeps = {
      initAll,
      initMojAll,
      rebindSectionBehaviors: jest.fn(),
    };
  });

  test('exports tables to CSV and sorts client tables', () => {
    const exportButton = document.createElement('button');
    exportButton.dataset.exportCsvButton = 'true';
    const table = document.createElement('table');
    table.dataset.exportCsv = 'true';
    const head = document.createElement('thead');
    head.innerHTML = '<tr><th>Name</th><th>Count</th></tr>';
    const body = document.createElement('tbody');
    body.innerHTML = `
      <tr><td>Beta</td><td>2</td></tr>
      <tr><td>Total</td><td>5</td></tr>
      <tr><td>Alpha</td><td>3</td></tr>
    `;
    table.appendChild(head);
    table.appendChild(body);
    document.body.appendChild(exportButton);
    document.body.appendChild(table);

    initTableExports();
    exportButton.click();
    initTableExports();
    expect(URL.createObjectURL).toHaveBeenCalled();

    const csv = tableToCsv(table);
    expect(csv.split('\n')[1]).toContain('Beta');
    expect(compareValues('Alpha', 'Beta')).toBeLessThan(0);

    table.dataset.sortable = 'true';
    table.dataset.sortDefault = '1';
    table.dataset.sortDefaultDir = 'desc';
    initTableSorting(fetchSortedSectionWithDeps);
    const firstRow = table.querySelector('tbody tr');
    expect(firstRow?.textContent).toContain('Alpha');

    const headers = table.querySelectorAll('thead th');
    headers[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const sortedRow = table.querySelector('tbody tr');
    expect(sortedRow?.textContent).toContain('Beta');

    const orphanContainer = document.createElement('div');
    const orphanButton = document.createElement('button');
    orphanButton.dataset.exportCsvButton = 'true';
    orphanContainer.appendChild(orphanButton);
    document.body.appendChild(orphanContainer);
    initTableExports();
    expect(orphanButton.dataset.exportBound).toBeUndefined();

    const emptyTable = document.createElement('table');
    emptyTable.dataset.sortable = 'true';
    emptyTable.innerHTML = '<thead><tr><th>Only</th></tr></thead>';
    document.body.appendChild(emptyTable);
    initTableSorting(fetchSortedSectionWithDeps);
  });

  test('handles server sorting for tables', async () => {
    const form = document.createElement('form');
    form.dataset.analyticsFilters = 'true';
    form.action = '/analytics/completed';
    document.body.appendChild(form);

    const section = document.createElement('div');
    section.dataset.section = 'user-overview-assigned';
    document.body.appendChild(section);

    const table = document.createElement('table');
    table.dataset.sortable = 'true';
    table.dataset.serverSort = 'true';
    table.dataset.sortScope = 'assigned';
    table.dataset.sortSection = 'user-overview-assigned';
    table.innerHTML = `
      <thead>
        <tr>
          <th data-sort-key="task"><button type="button">Task</button></th>
        </tr>
      </thead>
      <tbody><tr><td>Alpha</td></tr></tbody>
    `;
    document.body.appendChild(table);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '<p>Updated</p>',
    }) as unknown as typeof fetch;

    initTableSorting(fetchSortedSectionWithDeps);
    const button = table.querySelector('button');
    form.submit = jest.fn();
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(form.querySelector<HTMLInputElement>('input[name="assignedSortBy"]')?.value).toBe('task');
    expect(form.querySelector<HTMLInputElement>('input[name="assignedSortDir"]')?.value).toBe('asc');
    expect(form.querySelector<HTMLInputElement>('input[name="assignedPage"]')?.value).toBe('1');
    expect(section.innerHTML).toContain('Updated');
    expect(initMojAll).toHaveBeenCalled();

    const mojTable = document.createElement('table');
    mojTable.dataset.module = 'moj-sortable-table';
    mojTable.dataset.serverSort = 'true';
    mojTable.dataset.sortScope = 'completed';
    mojTable.dataset.sortSection = 'user-overview-completed';
    mojTable.innerHTML = `
      <thead>
        <tr>
          <th data-sort-key="name"><button type="button">Name</button></th>
        </tr>
      </thead>
      <tbody><tr><td>Item</td></tr></tbody>
    `;
    document.body.appendChild(mojTable);

    const criticalMojTable = document.createElement('table');
    criticalMojTable.dataset.module = 'moj-sortable-table';
    criticalMojTable.dataset.serverSort = 'true';
    criticalMojTable.dataset.sortScope = 'criticalTasks';
    criticalMojTable.dataset.sortSection = 'critical-tasks-section';
    criticalMojTable.innerHTML = `
      <thead>
        <tr>
          <th data-sort-key="task"><button type="button">Task</button></th>
        </tr>
      </thead>
      <tbody><tr><td>Item</td></tr></tbody>
    `;
    document.body.appendChild(criticalMojTable);

    const assignedMojTable = document.createElement('table');
    assignedMojTable.dataset.module = 'moj-sortable-table';
    assignedMojTable.dataset.serverSort = 'true';
    assignedMojTable.dataset.sortScope = 'assigned';
    assignedMojTable.dataset.sortSection = 'assigned-section';
    assignedMojTable.innerHTML = `
      <thead>
        <tr>
          <th data-sort-key="name"><button type="button">Name</button></th>
        </tr>
      </thead>
      <tbody><tr><td>Item</td></tr></tbody>
    `;
    document.body.appendChild(assignedMojTable);
    initMojServerSorting(fetchSortedSectionWithDeps);
    const mojButton = mojTable.querySelector('button');
    const mojSection = document.createElement('div');
    mojSection.dataset.section = 'user-overview-completed';
    document.body.appendChild(mojSection);
    const criticalSection = document.createElement('div');
    criticalSection.dataset.section = 'critical-tasks-section';
    document.body.appendChild(criticalSection);
    const assignedSection = document.createElement('div');
    assignedSection.dataset.section = 'assigned-section';
    document.body.appendChild(assignedSection);

    const criticalButton = criticalMojTable.querySelector('button');
    const assignedButton = assignedMojTable.querySelector('button');
    mojButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    criticalButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    assignedButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(form.querySelector<HTMLInputElement>('input[name="completedSortBy"]')?.value).toBe('name');
    expect(form.querySelector<HTMLInputElement>('input[name="completedSortDir"]')?.value).toBe('asc');
    expect(form.querySelector<HTMLInputElement>('input[name="criticalTasksPage"]')?.value).toBe('1');
    expect(form.querySelector<HTMLInputElement>('input[name="assignedPage"]')?.value).toBe('1');
  });

  test('covers csv fallbacks and client sorting branches', () => {
    const exportButton = document.createElement('button');
    exportButton.dataset.exportCsvButton = 'true';
    const exportTable = document.createElement('table');
    const exportRow = document.createElement('tr');
    const exportCell = document.createElement('td');
    Object.defineProperty(exportCell, 'textContent', { value: null });
    exportRow.appendChild(exportCell);
    exportTable.appendChild(exportRow);
    const exportContainer = document.createElement('div');
    exportContainer.appendChild(exportButton);
    exportContainer.appendChild(exportTable);
    document.body.appendChild(exportContainer);

    initTableExports();
    exportButton.click();
    expect(URL.createObjectURL).toHaveBeenCalled();

    const clientTable = document.createElement('table');
    clientTable.dataset.sortable = 'true';
    clientTable.dataset.sortDefault = '0';
    clientTable.dataset.sortDefaultDir = 'desc';
    clientTable.innerHTML = `
      <thead><tr><th>Col 1</th><th>Col 2</th></tr></thead>
      <tbody>
        <tr><td>B</td></tr>
        <tr><td>A</td></tr>
      </tbody>
    `;
    document.body.appendChild(clientTable);
    initTableSorting(fetchSortedSectionWithDeps);

    const headers = clientTable.querySelectorAll<HTMLTableHeaderCellElement>('thead th');
    expect(headers[0]?.dataset.sortDir).toBe('desc');
    headers[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    headers[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(headers[0]?.dataset.sortDir).toBeUndefined();
    expect(headers[1]?.dataset.sortDir).toBe('asc');
  });

  test('toggles sort direction for server-sorted tables', async () => {
    const form = document.createElement('form');
    form.dataset.analyticsFilters = 'true';
    form.action = '/analytics/assigned';
    document.body.appendChild(form);

    const section = document.createElement('div');
    section.dataset.section = 'assigned-section';
    document.body.appendChild(section);

    const table = document.createElement('table');
    table.dataset.sortable = 'true';
    table.dataset.serverSort = 'true';
    table.dataset.sortScope = 'assigned';
    table.dataset.sortSection = 'assigned-section';
    table.innerHTML = `
      <thead>
        <tr>
          <th data-sort-key="task" data-sort-dir="asc"><button type="button">Task</button></th>
        </tr>
      </thead>
      <tbody><tr><td>Alpha</td></tr></tbody>
    `;
    document.body.appendChild(table);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '<p>Updated</p>',
    }) as unknown as typeof fetch;

    initTableSorting(fetchSortedSectionWithDeps);
    table.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(form.querySelector<HTMLInputElement>('input[name="assignedSortDir"]')?.value).toBe('desc');
  });

  test('handles moj server sort when aria-sort is ascending', async () => {
    const form = document.createElement('form');
    form.dataset.analyticsFilters = 'true';
    document.body.appendChild(form);

    const section = document.createElement('div');
    section.dataset.section = 'completed-section';
    document.body.appendChild(section);

    const mojTable = document.createElement('table');
    mojTable.dataset.module = 'moj-sortable-table';
    mojTable.dataset.serverSort = 'true';
    mojTable.dataset.sortScope = 'completed';
    mojTable.dataset.sortSection = 'completed-section';
    mojTable.innerHTML = `
      <thead>
        <tr>
          <th data-sort-key="name" aria-sort="ascending"><button type="button">Name</button></th>
        </tr>
      </thead>
      <tbody><tr><td>Item</td></tr></tbody>
    `;
    document.body.appendChild(mojTable);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '<p>Updated</p>',
    }) as unknown as typeof fetch;

    initMojServerSorting(fetchSortedSectionWithDeps);
    mojTable.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(form.querySelector<HTMLInputElement>('input[name="completedSortDir"]')?.value).toBe('desc');
  });

  test('covers sorting guard clauses and sticky totals', async () => {
    const form = document.createElement('form');
    form.dataset.analyticsFilters = 'true';
    form.submit = jest.fn();
    document.body.appendChild(form);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '<div>ok</div>',
    }) as unknown as typeof fetch;

    const noScopeTable = document.createElement('table');
    noScopeTable.dataset.sortable = 'true';
    noScopeTable.dataset.serverSort = 'true';
    noScopeTable.innerHTML = '<thead><tr><th data-sort-key="task">Task</th></tr></thead><tbody></tbody>';
    document.body.appendChild(noScopeTable);

    const noSortKeyTable = document.createElement('table');
    noSortKeyTable.dataset.sortable = 'true';
    noSortKeyTable.dataset.serverSort = 'true';
    noSortKeyTable.dataset.sortScope = 'assigned';
    noSortKeyTable.innerHTML = '<thead><tr><th>Task</th></tr></thead><tbody></tbody>';
    document.body.appendChild(noSortKeyTable);

    const disabledTable = document.createElement('table');
    disabledTable.dataset.sortable = 'true';
    disabledTable.dataset.serverSort = 'true';
    disabledTable.dataset.sortScope = 'assigned';
    disabledTable.innerHTML = `
      <thead><tr><th data-sort-key="task"><button type="button" disabled>Task</button></th></tr></thead>
      <tbody><tr><td>Row</td></tr></tbody>
    `;
    document.body.appendChild(disabledTable);

    const criticalSection = document.createElement('div');
    criticalSection.dataset.section = 'critical-section';
    document.body.appendChild(criticalSection);
    const criticalTable = document.createElement('table');
    criticalTable.dataset.sortable = 'true';
    criticalTable.dataset.serverSort = 'true';
    criticalTable.dataset.sortScope = 'criticalTasks';
    criticalTable.dataset.sortSection = 'critical-section';
    criticalTable.innerHTML = `
      <thead><tr><th data-sort-key="task"><button type="button">Task</button></th></tr></thead>
      <tbody><tr><td>Row</td></tr></tbody>
    `;
    document.body.appendChild(criticalTable);

    const completedSection = document.createElement('div');
    completedSection.dataset.section = 'completed-section';
    document.body.appendChild(completedSection);
    const completedTable = document.createElement('table');
    completedTable.dataset.sortable = 'true';
    completedTable.dataset.serverSort = 'true';
    completedTable.dataset.sortScope = 'completed';
    completedTable.dataset.sortSection = 'completed-section';
    completedTable.innerHTML = `
      <thead><tr><th data-sort-key="task"><button type="button">Task</button></th></tr></thead>
      <tbody><tr><td>Row</td></tr></tbody>
    `;
    document.body.appendChild(completedTable);

    initTableSorting(fetchSortedSectionWithDeps);
    disabledTable.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    criticalTable.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    completedTable.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await flushPromises();

    expect(form.querySelector<HTMLInputElement>('input[name="criticalTasksPage"]')?.value).toBe('1');
    expect(form.querySelector<HTMLInputElement>('input[name="completedPage"]')?.value).toBe('1');

    const mojMissingHead = document.createElement('table');
    mojMissingHead.dataset.module = 'moj-sortable-table';
    mojMissingHead.dataset.serverSort = 'true';
    mojMissingHead.dataset.sortScope = 'assigned';
    document.body.appendChild(mojMissingHead);

    const mojNoButton = document.createElement('table');
    mojNoButton.dataset.module = 'moj-sortable-table';
    mojNoButton.dataset.serverSort = 'true';
    mojNoButton.dataset.sortScope = 'assigned';
    mojNoButton.innerHTML = '<thead><tr><th data-sort-key="task">Task</th></tr></thead><tbody></tbody>';
    document.body.appendChild(mojNoButton);

    const mojNoHeading = document.createElement('table');
    mojNoHeading.dataset.module = 'moj-sortable-table';
    mojNoHeading.dataset.serverSort = 'true';
    mojNoHeading.dataset.sortScope = 'assigned';
    mojNoHeading.innerHTML = '<thead><tr><td><button type="button">Task</button></td></tr></thead><tbody></tbody>';
    document.body.appendChild(mojNoHeading);

    const mojNoSortKey = document.createElement('table');
    mojNoSortKey.dataset.module = 'moj-sortable-table';
    mojNoSortKey.dataset.serverSort = 'true';
    mojNoSortKey.dataset.sortScope = 'assigned';
    mojNoSortKey.innerHTML = '<thead><tr><th><button type="button">Task</button></th></tr></thead><tbody></tbody>';
    document.body.appendChild(mojNoSortKey);

    const mojBound = document.createElement('table');
    mojBound.dataset.module = 'moj-sortable-table';
    mojBound.dataset.serverSort = 'true';
    mojBound.dataset.sortScope = 'assigned';
    mojBound.dataset.mojServerSortBound = 'true';
    document.body.appendChild(mojBound);

    initMojServerSorting(fetchSortedSectionWithDeps);
    mojNoButton.querySelector('thead')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    mojNoHeading.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    mojNoSortKey.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const missingBodyTable = document.createElement('table');
    moveStickyTotalsRow(missingBodyTable);
    const missingTotalsTable = document.createElement('table');
    missingTotalsTable.innerHTML = '<tbody><tr><td>Row</td></tr></tbody>';
    moveStickyTotalsRow(missingTotalsTable);

    const boundSticky = document.createElement('table');
    boundSticky.dataset.module = 'moj-sortable-table';
    boundSticky.dataset.stickyTotals = 'true';
    boundSticky.dataset.mojStickyTotalsBound = 'true';
    document.body.appendChild(boundSticky);
    initMojStickyTotals();

    const stickyTable = document.createElement('table');
    stickyTable.dataset.module = 'moj-sortable-table';
    stickyTable.dataset.stickyTotals = 'true';
    stickyTable.innerHTML = `
      <tbody>
        <tr><td data-total-row="true">Total</td></tr>
        <tr><td>Row</td></tr>
      </tbody>
    `;
    document.body.appendChild(stickyTable);
    initMojStickyTotals();
    stickyTable.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const stickyRows = stickyTable.querySelectorAll('tbody tr');
    expect(stickyRows[stickyRows.length - 1]?.textContent).toContain('Total');
  });

  test('covers export fallbacks, numeric comparisons, and bound sorts', () => {
    const button = document.createElement('button');
    button.dataset.exportCsvButton = 'true';
    const table = document.createElement('table');
    table.dataset.exportCsv = 'true';
    document.body.appendChild(button);
    document.body.appendChild(table);

    initTableExports();
    expect(button.dataset.exportBound).toBe('true');
    initTableExports();

    expect(compareValues('1,200', '900')).toBeGreaterThan(0);

    const boundTable = document.createElement('table');
    boundTable.dataset.sortable = 'true';
    boundTable.dataset.sortBound = 'true';
    document.body.appendChild(boundTable);
    initTableSorting(fetchSortedSectionWithDeps);
  });
});
