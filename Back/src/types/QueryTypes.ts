export const QUERY_FORMAT = ['json', 'awtrix'] as const;

export type QueryType = typeof QUERY_FORMAT[number];
