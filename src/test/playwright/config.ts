export const config = {
  baseUrl: process.env.TEST_URL || 'http://localhost:3100',
  defaultLanguage: 'en',
};

type Query = Record<string, string | undefined>;

export const buildUrl = (path: string, query?: Query): string => {
  const url = new URL(path, config.baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
  }
  if (!url.searchParams.has('lng')) {
    url.searchParams.set('lng', config.defaultLanguage);
  }
  return url.toString();
};
