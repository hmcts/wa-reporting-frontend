/* @jest-environment jsdom */
import { initOpenByName, renderOpenByNameTable } from '../../../../../main/assets/js/analytics/outstanding/openByName';
import { setupAnalyticsDom } from '../analyticsTestUtils';

jest.mock('plotly.js-basic-dist-min', () => ({
  __esModule: true,
  default: {
    newPlot: jest.fn(() => Promise.resolve()),
    relayout: jest.fn(),
  },
}));

describe('analytics open by name', () => {
  beforeEach(() => {
    setupAnalyticsDom();
  });

  test('renders open-by-name content and handles errors', async () => {
    const container = document.createElement('section');
    container.dataset.openByName = 'true';
    container.innerHTML = `
      <div data-open-by-name-chart="true"></div>
      <table data-open-by-name-table="true"><tbody></tbody></table>
      <div data-open-by-name-error="true" class="govuk-visually-hidden"></div>
      <script data-open-by-name-initial type="application/json">
        ${JSON.stringify({
          breakdown: [{ name: 'Task A', urgent: 1, high: 2, medium: 3, low: 4 }],
          totals: { name: 'Total', urgent: 1, high: 2, medium: 3, low: 4 },
          chart: { data: [{ y: ['Task A'] }] },
        })}
      </script>
    `;
    document.body.appendChild(container);

    await initOpenByName();

    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(
      container.querySelector('[data-open-by-name-error="true"]')?.classList.contains('govuk-visually-hidden')
    ).toBe(true);

    container.remove();
    const errorContainer = document.createElement('section');
    errorContainer.dataset.openByName = 'true';
    errorContainer.innerHTML = `
      <div data-open-by-name-chart="true"></div>
      <table data-open-by-name-table="true"><tbody></tbody></table>
      <div data-open-by-name-error="true" class="govuk-visually-hidden"></div>
    `;
    document.body.appendChild(errorContainer);

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await initOpenByName();
    expect(
      errorContainer.querySelector('[data-open-by-name-error="true"]')?.classList.contains('govuk-visually-hidden')
    ).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();

    const emptyTableBody = document.createElement('tbody');
    renderOpenByNameTable(emptyTableBody, [], { name: 'Total', urgent: 0, high: 0, medium: 0, low: 0 });
    expect(emptyTableBody.textContent).toContain('No open tasks found.');
  });

  test('handles open-by-name guard clauses', async () => {
    const emptyContainer = document.createElement('section');
    emptyContainer.dataset.openByName = 'true';
    document.body.appendChild(emptyContainer);
    await initOpenByName();

    emptyContainer.remove();
    const parseContainer = document.createElement('section');
    parseContainer.dataset.openByName = 'true';
    parseContainer.innerHTML = `
      <div data-open-by-name-chart="true"></div>
      <table data-open-by-name-table="true"><tbody></tbody></table>
      <script data-open-by-name-initial type="application/json">{bad</script>
    `;
    document.body.appendChild(parseContainer);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await initOpenByName();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
