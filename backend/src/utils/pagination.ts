export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

const MAX_LIMIT = 100;

/** Parses ?page&limit into safe values. */
export function parsePagination(query: { page?: unknown; limit?: unknown }): Pagination {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(query.limit ?? 20) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
