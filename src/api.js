/** HTTP adapter. Token ownership stays with the host; the component never stores credentials. */
export function createApi(base, tokenProvider) {
  return async (path, data, binary = false) => {
    const token = await tokenProvider?.();
    const response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error || `Request failed (${response.status}).`); }
    return binary ? response.blob() : response.json();
  };
}
export const statusTone = status => ({ 'Unassigned': 'gray', 'In Process': 'blue', 'Awaiting Approval': 'amber', 'ESR Issued': 'green', 'ESR Issued – Deferred': 'amber', 'ESR Closed': 'gray' })[status] || 'gray';
export function filterRecords(records, query, status, scope, userId) {
  const search = query.trim().toLowerCase();
  return records.filter(r => (!search || [r.title, r.serial, r.jcn, r.condition, ...r.attributes].join(' ').toLowerCase().includes(search)) && (!status || r.status === status) && (scope !== 'mine' || r.engineerId === userId || r.requestorId === userId) && (scope !== 'history' || r.status === 'ESR Closed'));
}
