/* @jest-environment jsdom */
import Plotly from 'plotly.js-basic-dist-min';

import { bindScrollPan, renderCharts } from '../../../../main/assets/js/analytics/charts';

import { mockBoundingClientRect, setupAnalyticsDom } from './analyticsTestUtils';

jest.mock('plotly.js-basic-dist-min', () => ({
  __esModule: true,
  default: {
    newPlot: jest.fn(() => Promise.resolve()),
    relayout: jest.fn(),
  },
}));

const flushPromises = async (): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 0));
};

describe('analytics charts', () => {
  const originalBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

  beforeAll(() => {
    HTMLElement.prototype.getBoundingClientRect = mockBoundingClientRect;
  });

  afterAll(() => {
    HTMLElement.prototype.getBoundingClientRect = originalBoundingClientRect;
  });

  beforeEach(() => {
    setupAnalyticsDom();
  });

  test('renders charts and labels modebar buttons', async () => {
    const chartNode = document.createElement('div');
    chartNode.dataset.chartConfig = JSON.stringify({
      data: [{ y: ['A', 'B'] }],
      layout: { margin: { l: 10 } },
    });
    chartNode.dataset.scrollPan = 'true';
    (chartNode as unknown as { _fullLayout?: { yaxis?: { range?: [number, number] } } })._fullLayout = {
      yaxis: { range: [4, 0] },
    };
    const modebar = document.createElement('a');
    modebar.className = 'modebar-btn';
    modebar.dataset.title = 'Download plot';
    chartNode.appendChild(modebar);
    const labeledModebar = document.createElement('a');
    labeledModebar.className = 'modebar-btn';
    labeledModebar.setAttribute('title', 'Already labeled');
    chartNode.appendChild(labeledModebar);
    document.body.appendChild(chartNode);

    const invalidNode = document.createElement('div');
    invalidNode.dataset.chartConfig = '{invalid';
    document.body.appendChild(invalidNode);
    const emptyNode = document.createElement('div');
    emptyNode.dataset.chartConfig = '';
    document.body.appendChild(emptyNode);

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    renderCharts();
    await flushPromises();

    expect(Plotly.newPlot).toHaveBeenCalled();
    expect(modebar.getAttribute('aria-label')).toBe('Download plot');
    expect(chartNode.dataset.scrollPanBound).toBe('true');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test('binds scroll pan interactions', () => {
    const node = document.createElement('div');
    (node as unknown as { _fullLayout?: { yaxis?: { range?: [number, number] } } })._fullLayout = {
      yaxis: { range: [4, 0] },
    };
    (node as unknown as { on?: (event: string, handler: () => void) => void }).on = (_, handler) => handler();

    bindScrollPan(node, { data: [{ y: ['A', 'B', 'C', 'D', 'E'] }] });
    const handle = node.querySelector<HTMLElement>('.analytics-chart-scroll-handle');
    handle?.dispatchEvent(new MouseEvent('mousedown', { clientY: 10, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 20, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    node.dispatchEvent(new WheelEvent('wheel', { deltaY: 1, bubbles: true }));

    expect(Plotly.relayout).toHaveBeenCalled();
    expect(node.dataset.scrollPanBound).toBe('true');
  });

  test('covers bindScrollPan guard paths', () => {
    const boundNode = document.createElement('div');
    boundNode.dataset.scrollPanBound = 'true';
    bindScrollPan(boundNode, { data: [{ y: ['A'] }] });

    const emptyNode = document.createElement('div');
    bindScrollPan(emptyNode, { data: [{ y: [] }] });

    const noRangeNode = document.createElement('div');
    bindScrollPan(noRangeNode, { data: [{ y: ['A', 'B'] }] });
    const noRangeHandle = noRangeNode.querySelector<HTMLElement>('.analytics-chart-scroll-handle');
    noRangeHandle?.dispatchEvent(new MouseEvent('mousedown', { clientY: 10, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 20, bubbles: true }));
    noRangeNode.dispatchEvent(new WheelEvent('wheel', { deltaY: 1, bubbles: true }));

    const limitedRangeNode = document.createElement('div');
    (limitedRangeNode as unknown as { _fullLayout?: { yaxis?: { range?: [number, number] } } })._fullLayout = {
      yaxis: { range: [5, 0] },
    };
    bindScrollPan(limitedRangeNode, { data: [{ y: ['A', 'B'] }] });
    const limitedHandle = limitedRangeNode.querySelector<HTMLElement>('.analytics-chart-scroll-handle');
    limitedHandle?.dispatchEvent(new MouseEvent('mousedown', { clientY: 10, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 20, bubbles: true }));

    const wheelNode = document.createElement('div');
    bindScrollPan(wheelNode, { data: [{ y: ['A', 'B'] }] });
    wheelNode.dispatchEvent(new WheelEvent('wheel', { deltaY: 0, bubbles: true }));

    expect(boundNode.dataset.scrollPanBound).toBe('true');
  });
});
