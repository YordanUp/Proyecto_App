function buildListPath(endpoint, { search = '', page = 1, limit = 50 } = {}) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search.trim()) query.set('search', search.trim());
  return `${endpoint}?${query.toString()}`;
}

async function fetchCollection(request, endpoint, options) {
  const payload = await request(buildListPath(endpoint, options));
  const items = Array.isArray(payload.data) ? payload.data : [];
  return { items, pagination: payload.pagination || { page: 1, limit: items.length, total: items.length, pages: 1 } };
}

module.exports = { buildListPath, fetchCollection };
