const TARGET_TICK_INTERVAL_COUNT = 6;
const DEFAULT_PADDING_RATIO = 0;
const DEFAULT_MINIMUM_UPPER_BOUND = 1;

type PositiveAxisScaleOptions = {
  paddingRatio?: number;
  minUpperBound?: number;
};

export type PositiveAxisScale = {
  range: [number, number];
  dtick: number;
};

function normaliseFiniteNonNegative(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function normalisePrecision(value: number): number {
  return Number(value.toPrecision(12));
}

function buildNiceTickInterval(roughInterval: number): number {
  const exponent = Math.floor(Math.log10(roughInterval));
  const magnitude = 10 ** exponent;
  const error = roughInterval / magnitude;
  const multiplier = error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1;

  return normalisePrecision(multiplier * magnitude);
}

export function buildPositiveAxisScale(
  rawMaximum: number,
  { paddingRatio = DEFAULT_PADDING_RATIO, minUpperBound = DEFAULT_MINIMUM_UPPER_BOUND }: PositiveAxisScaleOptions = {}
): PositiveAxisScale {
  const maximum = normaliseFiniteNonNegative(rawMaximum, 0);
  const minimumUpperBound =
    Number.isFinite(minUpperBound) && minUpperBound > 0 ? minUpperBound : DEFAULT_MINIMUM_UPPER_BOUND;
  const padding = normaliseFiniteNonNegative(paddingRatio, DEFAULT_PADDING_RATIO);
  const targetUpperBound = Math.max(minimumUpperBound, maximum * (1 + padding));
  const tickInterval = buildNiceTickInterval(targetUpperBound / TARGET_TICK_INTERVAL_COUNT);
  let intervalCount = Math.ceil(targetUpperBound / tickInterval - 1e-12);
  if (normalisePrecision(intervalCount * tickInterval) <= maximum) {
    intervalCount += 1;
  }
  const upperBound = normalisePrecision(intervalCount * tickInterval);

  return {
    range: [0, upperBound],
    dtick: tickInterval,
  };
}
