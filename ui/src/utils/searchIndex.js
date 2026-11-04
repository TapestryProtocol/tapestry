/**
 * Whether this instance has a search index running. A point of view's scores are downloaded to fill that index, so
 * without one there is no reason to fetch them on the person's behalf. A brain runs with search off.
 */
export async function searchIndexIsUp(fetcher = fetch) {
  try {
    const resp = await fetcher('/api/search/profiles/meili/stats');
    const data = await resp.json();
    return Boolean(data.success);
  } catch {
    return false;
  }
}
