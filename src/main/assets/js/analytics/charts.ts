import type { Config } from 'plotly.js';
import Plotly from 'plotly.js-basic-dist-min';

import type { PlotlyAutoFitAxisRule, PlotlyConfig, PlotlyData } from './types';

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

type PlotlyGraphNode = HTMLElement & {
  _fullLayout?: {
    xaxis?: { range?: [unknown, unknown]; autorange?: boolean };
    yaxis?: { range?: [number, number]; autorange?: boolean };
    yaxis2?: { range?: [number, number]; autorange?: boolean };
  };
  on?: (event: string, handler: (eventData?: unknown) => void) => void;
  removeListener?: (event: string, handler: (eventData?: unknown) => void) => void;
  removeAllListeners?: (event: string) => void;
};

type ScrollPanState = {
  track: HTMLDivElement;
  handle: HTMLDivElement;
  categoryCount: number;
  relayoutHandler: (() => void) | null;
};

const scrollPanStateByNode = new WeakMap<HTMLElement, ScrollPanState>();
type AutoFitYAxesState = {
  relayoutHandler: ((eventData?: unknown) => void) | null;
  isApplyingRelayout: boolean;
};

const autoFitYAxesStateByNode = new WeakMap<HTMLElement, AutoFitYAxesState>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function axisLayoutKey(axis: PlotlyAutoFitAxisRule['axis']): 'yaxis' | 'yaxis2' {
  return axis === 'y2' ? 'yaxis2' : 'yaxis';
}

function getTraceAxis(trace: PlotlyData): PlotlyAutoFitAxisRule['axis'] {
  return trace.yaxis === 'y2' ? 'y2' : 'y';
}

function toTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getVisibleXWindow(node: PlotlyGraphNode): { lower: number; upper: number } | null {
  const range = node._fullLayout?.xaxis?.range;
  if (!range) {
    return null;
  }

  const start = toTimestamp(range[0]);
  const end = toTimestamp(range[1]);
  if (start === null || end === null) {
    return null;
  }

  return { lower: Math.min(start, end), upper: Math.max(start, end) };
}

function isInVisibleWindow(value: unknown, window: { lower: number; upper: number }): boolean {
  const timestamp = toTimestamp(value);
  return timestamp !== null && timestamp >= window.lower && timestamp <= window.upper;
}

function collectVisibleStackedBarMaximum(
  traces: PlotlyData[],
  axis: PlotlyAutoFitAxisRule['axis'],
  window: { lower: number; upper: number }
): number {
  const totalsByTimestamp = new Map<number, number>();

  traces.forEach(trace => {
    if (trace.type !== 'bar' || getTraceAxis(trace) !== axis) {
      return;
    }

    const xValues = Array.isArray(trace.x) ? trace.x : [];
    const yValues = Array.isArray(trace.y) ? trace.y : [];
    const pointCount = Math.min(xValues.length, yValues.length);

    for (let index = 0; index < pointCount; index += 1) {
      if (!isInVisibleWindow(xValues[index], window)) {
        continue;
      }

      const timestamp = toTimestamp(xValues[index]);
      const yValue = toFiniteNumber(yValues[index]);
      if (timestamp === null || yValue === null) {
        continue;
      }

      const contribution = Math.max(0, yValue);
      totalsByTimestamp.set(timestamp, (totalsByTimestamp.get(timestamp) ?? 0) + contribution);
    }
  });

  return Math.max(0, ...totalsByTimestamp.values());
}

function collectVisibleLineMaximum(
  traces: PlotlyData[],
  axis: PlotlyAutoFitAxisRule['axis'],
  window: { lower: number; upper: number }
): number {
  let maximum = 0;

  traces.forEach(trace => {
    if (trace.type !== 'scatter' || getTraceAxis(trace) !== axis) {
      return;
    }

    const xValues = Array.isArray(trace.x) ? trace.x : [];
    const yValues = Array.isArray(trace.y) ? trace.y : [];
    const pointCount = Math.min(xValues.length, yValues.length);

    for (let index = 0; index < pointCount; index += 1) {
      if (!isInVisibleWindow(xValues[index], window)) {
        continue;
      }

      const yValue = toFiniteNumber(yValues[index]);
      if (yValue === null) {
        continue;
      }

      maximum = Math.max(maximum, yValue);
    }
  });

  return Math.max(0, maximum);
}

function computeVisibleAxisMaximum(
  traces: PlotlyData[],
  rule: PlotlyAutoFitAxisRule,
  window: { lower: number; upper: number }
): number {
  switch (rule.strategy) {
    case 'stacked-bar-sum':
      return collectVisibleStackedBarMaximum(traces, rule.axis, window);
    case 'line-extents':
      return collectVisibleLineMaximum(traces, rule.axis, window);
    case 'stacked-bar-and-line-max':
      return Math.max(
        collectVisibleStackedBarMaximum(traces, rule.axis, window),
        collectVisibleLineMaximum(traces, rule.axis, window)
      );
    default:
      return 0;
  }
}

function buildAutoFitRange(rawMaximum: number, rule: PlotlyAutoFitAxisRule): [number, number] {
  const minimumUpperBound = rule.minUpperBound ?? 1;
  const paddingRatio = rule.paddingRatio ?? 0.05;
  const paddedMaximum = rawMaximum * (1 + paddingRatio);
  return [0, Math.max(minimumUpperBound, paddedMaximum)];
}

function shouldHandleXRelayout(eventData: unknown): boolean {
  if (!isRecord(eventData)) {
    return true;
  }

  return Object.keys(eventData).some(key => key.startsWith('xaxis.'));
}

export function bindAutoFitYAxesOnXZoom(node: HTMLElement, config: PlotlyConfig): void {
  const rules = config.behaviors?.autoFitYAxesOnXZoom;
  if (!rules || rules.length === 0) {
    return;
  }

  const plotlyNode = node as PlotlyGraphNode;
  let state = autoFitYAxesStateByNode.get(node);
  if (!state) {
    state = {
      relayoutHandler: null,
      isApplyingRelayout: false,
    };
    autoFitYAxesStateByNode.set(node, state);
  }

  if (state.relayoutHandler) {
    if (plotlyNode.removeListener) {
      plotlyNode.removeListener('plotly_relayout', state.relayoutHandler);
    } else if (plotlyNode.removeAllListeners) {
      plotlyNode.removeAllListeners('plotly_relayout');
    }
  }

  state.relayoutHandler = eventData => {
    if (state?.isApplyingRelayout || !shouldHandleXRelayout(eventData)) {
      return;
    }

    const xaxis = plotlyNode._fullLayout?.xaxis;
    if (xaxis?.autorange) {
      const autorangeUpdate = rules.reduce<Record<string, unknown>>((update, rule) => {
        const layoutKey = axisLayoutKey(rule.axis);
        update[`${layoutKey}.autorange`] = true;
        update[`${layoutKey}.range`] = null;
        return update;
      }, {});

      state.isApplyingRelayout = true;
      void Plotly.relayout(node, autorangeUpdate).finally(() => {
        state.isApplyingRelayout = false;
      });
      return;
    }

    const visibleWindow = getVisibleXWindow(plotlyNode);
    if (!visibleWindow) {
      return;
    }

    const relayoutUpdate = rules.reduce<Record<string, unknown>>((update, rule) => {
      const layoutKey = axisLayoutKey(rule.axis);
      update[`${layoutKey}.autorange`] = false;
      update[`${layoutKey}.range`] = buildAutoFitRange(
        computeVisibleAxisMaximum(config.data, rule, visibleWindow),
        rule
      );
      return update;
    }, {});

    state.isApplyingRelayout = true;
    void Plotly.relayout(node, relayoutUpdate).finally(() => {
      state.isApplyingRelayout = false;
    });
  };

  plotlyNode.on?.('plotly_relayout', state.relayoutHandler);
}

function updateScrollHandle(node: HTMLElement, state: ScrollPanState): void {
  const graph = node as PlotlyGraphNode;
  const range = graph._fullLayout?.yaxis?.range;
  if (!range || state.categoryCount <= 0) {
    state.track.style.display = 'none';
    return;
  }

  const windowSize = range[0] - range[1];
  const min = -0.5;
  const max = state.categoryCount - 0.5;
  const totalSpan = max - min;
  const availableSpan = totalSpan - windowSize;
  if (availableSpan <= 0) {
    state.track.style.display = 'none';
    return;
  }

  state.track.style.display = '';
  const trackHeight = state.track.getBoundingClientRect().height;
  const handleHeight = Math.max(24, (windowSize / totalSpan) * trackHeight);
  const position = (range[0] - (min + windowSize)) / availableSpan;
  const top = Math.min(trackHeight - handleHeight, Math.max(0, position * (trackHeight - handleHeight)));
  state.handle.style.height = `${handleHeight}px`;
  state.handle.style.top = `${top}px`;
}

export function labelModebarButtons(container: HTMLElement): void {
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

export function renderCharts(): void {
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
        bindAutoFitYAxesOnXZoom(node, parsed);
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

export function renderOpenByNameChart(node: HTMLElement, config: PlotlyConfig): void {
  const parsedLayout = config.layout ?? {};
  const layout = {
    ...baseLayout,
    ...parsedLayout,
    margin: { ...baseLayout.margin, ...(parsedLayout.margin ?? {}) },
  };
  Plotly.newPlot(node, config.data, layout, { ...baseChartConfig, ...(config.config ?? {}) });
  bindScrollPan(node, config);
}

export function bindScrollPan(node: HTMLElement, config: PlotlyConfig): void {
  const categories = (config.data?.[0] as { y?: unknown })?.y;
  const categoryCount = Array.isArray(categories) ? categories.length : 0;

  let state = scrollPanStateByNode.get(node);
  if (!state && categoryCount <= 0) {
    return;
  }

  if (!state) {
    const track = document.createElement('div');
    track.className = 'analytics-chart-scroll-track';
    const handle = document.createElement('div');
    handle.className = 'analytics-chart-scroll-handle';
    track.appendChild(handle);
    node.appendChild(track);

    const newState: ScrollPanState = {
      track,
      handle,
      categoryCount,
      relayoutHandler: null,
    };
    scrollPanStateByNode.set(node, newState);
    state = newState;

    let dragOffset = 0;
    let pendingDragTop: number | null = null;
    let dragRafId: number | null = null;
    const applyDragMove = () => {
      dragRafId = null;
      const graph = node as PlotlyGraphNode;
      const range = graph._fullLayout?.yaxis?.range;
      if (!range || pendingDragTop === null) {
        pendingDragTop = null;
        return;
      }
      const rect = newState.track.getBoundingClientRect();
      const windowSize = range[0] - range[1];
      const min = -0.5;
      const max = newState.categoryCount - 0.5;
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
      void Plotly.relayout(node, { 'yaxis.range': [nextUpper, nextLower] }).then(() =>
        updateScrollHandle(node, newState)
      );
    };

    const onDragMove = (event: MouseEvent) => {
      const rect = newState.track.getBoundingClientRect();
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

    newState.handle.addEventListener('mousedown', event => {
      event.preventDefault();
      const rect = newState.handle.getBoundingClientRect();
      dragOffset = event.clientY - rect.top;
      window.addEventListener('mousemove', onDragMove);
      window.addEventListener('mouseup', onDragEnd);
    });

    let pendingStep = 0;
    let rafId: number | null = null;
    const applyWheelStep = () => {
      rafId = null;
      const graph = node as PlotlyGraphNode;
      const range = graph._fullLayout?.yaxis?.range;
      if (!range || pendingStep === 0) {
        pendingStep = 0;
        return;
      }
      const step = pendingStep;
      pendingStep = 0;
      const windowSize = range[0] - range[1];
      const min = -0.5;
      const max = newState.categoryCount - 0.5;
      const nextUpper = Math.min(max, Math.max(min + windowSize, range[0] + step));
      const nextLower = nextUpper - windowSize;
      void Plotly.relayout(node, { 'yaxis.range': [nextUpper, nextLower] }).then(() =>
        updateScrollHandle(node, newState)
      );
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

    node.dataset.scrollPanBound = 'true';
  }

  state.categoryCount = categoryCount;

  const plotlyNode = node as PlotlyGraphNode;
  if (state.relayoutHandler) {
    if (plotlyNode.removeAllListeners) {
      plotlyNode.removeAllListeners('plotly_relayout');
    } else if (plotlyNode.removeListener) {
      plotlyNode.removeListener('plotly_relayout', state.relayoutHandler);
    }
  }

  state.relayoutHandler = () => updateScrollHandle(node, state);
  plotlyNode.on?.('plotly_relayout', state.relayoutHandler);

  updateScrollHandle(node, state);
}
