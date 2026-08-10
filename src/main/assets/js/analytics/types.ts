import type { PlotlyAutoFitAxisRule } from '../../../modules/analytics/shared/charts/positiveAxisScale';

export type PlotlyData = Record<string, unknown>;

export type { PlotlyAutoFitAxisRule } from '../../../modules/analytics/shared/charts/positiveAxisScale';

export type PlotlyConfig = {
  data: PlotlyData[];
  layout?: Record<string, unknown>;
  config?: Record<string, unknown>;
  behaviors?: {
    autoFitYAxesOnXZoom?: PlotlyAutoFitAxisRule[];
  };
};
