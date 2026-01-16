import type { Request } from 'express';

type PartialMap = Record<string, string>;

export function isAjaxRequest(req: Request): boolean {
  return req.get?.('X-Requested-With') === 'fetch';
}

export function getAjaxPartialTemplate(params: {
  source: Record<string, unknown>;
  partials: PartialMap;
}): string | null {
  const { source, partials } = params;
  const section = typeof source.ajaxSection === 'string' ? source.ajaxSection : undefined;
  if (!section) {
    return null;
  }
  return partials[section] ?? null;
}
