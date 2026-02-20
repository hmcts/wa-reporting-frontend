import { renderOpenByNameChart } from '../charts';
import type { PlotlyConfig } from '../types';

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

const numberFormatter = new Intl.NumberFormat('en-GB');

function createNumericCell(value: number, isTotal: boolean): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.className = 'govuk-table__cell govuk-table__cell--numeric';
  cell.setAttribute('data-sort-value', String(value));
  if (isTotal) {
    cell.classList.add('govuk-!-font-weight-bold');
  }
  cell.textContent = numberFormatter.format(value);
  return cell;
}

function totalOpen(row: OpenByNameRow): number {
  return row.urgent + row.high + row.medium + row.low;
}

export function renderOpenByNameTable(body: HTMLElement, rows: OpenByNameRow[], totals: OpenByNameRow): void {
  body.innerHTML = '';
  if (rows.length === 0) {
    const emptyRow = document.createElement('tr');
    emptyRow.className = 'govuk-table__row';
    const cell = document.createElement('td');
    cell.className = 'govuk-table__cell';
    cell.colSpan = 6;
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
      nameCell.setAttribute('data-total-row', 'true');
    }
    nameCell.textContent = row.name;
    tr.appendChild(nameCell);

    tr.appendChild(createNumericCell(totalOpen(row), isTotal));
    tr.appendChild(createNumericCell(row.urgent, isTotal));
    tr.appendChild(createNumericCell(row.high, isTotal));
    tr.appendChild(createNumericCell(row.medium, isTotal));
    tr.appendChild(createNumericCell(row.low, isTotal));

    body.appendChild(tr);
  });
}

export async function initOpenByName(): Promise<void> {
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
      '<tr class="govuk-table__row"><td colspan="6" class="govuk-table__cell">Unable to load open tasks.</td></tr>';
    if (errorNode) {
      errorNode.classList.remove('govuk-visually-hidden');
    }
    // eslint-disable-next-line no-console
    console.error('Failed to load open tasks by name', error);
  }
}
