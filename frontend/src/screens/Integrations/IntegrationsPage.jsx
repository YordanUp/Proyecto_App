import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { hasPermission } from '../../services/permissions';

const TYPES = ['payments', 'messaging', 'crm', 'accounting', 'storage', 'other'];
const STATUSES = ['pending', 'connected', 'disconnected', 'error'];
const EMPTY_FORM = { name: '', slug: '', type: 'other', description: '', owner: '', config: [{ key: '', value: '' }] };

function configRows(config = {}) {
  const rows = Object.entries(config || {}).map(([key, value]) => ({ key, value: typeof value === 'string' ? value : JSON.stringify(value) }));
  return rows.length ? rows : [{ key: '', value: '' }];
}
function configObject(rows) {
  return Object.fromEntries(rows.filter(row => row.key.trim()).map(row => [row.key.trim(), row.value]));
}
function date(value) { return value ? new Date(value).toLocaleString() : 'Sin sincronizaciones'; }

export default function IntegrationsPage({ session }) {
  const user = session?.user;
  const canRead = hasPermission(user, 'integrations.read');
  const canCreate = hasPermission(user, 'integrations.create');
  const canUpdate = hasPermission(user, 'integrations.update');
  const [items, setItems] = useState([]); const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [searchDraft, setSearchDraft] = useState(''); const [filters, setFilters] = useState({ search: '', type: '', status: '', enabled: '' }); const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [view, setView] = useState('list'); const [selected, setSelected] = useState(null); const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    if (!canRead) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams({ page: String(page), limit: '25' });
      Object.entries(filters).forEach(([key, value]) => { if (value !== '') query.set(key, value); });
      const result = await apiRequest(`/api/integrations?${query}`);
      setItems(Array.isArray(result.data) ? result.data : []); setPagination(result.pagination || { page, pages: 0, total: 0 });
    } catch (loadError) { setError(loadError.message || 'No se pudieron cargar las integraciones.'); }
    finally { setLoading(false); }
  }, [canRead, filters, page]);
  useEffect(() => { load(); }, [load]);

  function beginCreate() { setSelected(null); setForm(EMPTY_FORM); setError(''); setNotice(''); setView('form'); }
  async function showDetail(item) {
    setError('');
    try { const result = await apiRequest(`/api/integrations/${encodeURIComponent(item.id)}`); setSelected(result.data); setView('detail'); }
    catch (loadError) { setError(loadError.message || 'No se pudo consultar la integración.'); }
  }
  function beginEdit(item) {
    setSelected(item); setForm({ name: item.name, slug: item.slug, type: item.type, description: item.description || '', owner: item.owner || '', config: configRows(item.config) }); setError(''); setNotice(''); setView('form');
  }
  function setFormField(key, value) { setForm(current => ({ ...current, [key]: value })); }
  function setConfigRow(index, key, value) { setForm(current => ({ ...current, config: current.config.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row) })); }

  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const body = { name: form.name, type: form.type, description: form.description, owner: form.owner, config: configObject(form.config) };
    if (!selected && form.slug.trim()) body.slug = form.slug;
    try {
      const result = selected
        ? await apiRequest(`/api/integrations/${encodeURIComponent(selected.id)}`, { method: 'PUT', body: JSON.stringify(body) })
        : await apiRequest('/api/integrations', { method: 'POST', body: JSON.stringify(body) });
      setSelected(result.data); setView('detail'); setNotice(selected ? 'Integración actualizada.' : 'Integración creada. Quedó pendiente y deshabilitada.'); await load();
    } catch (saveError) { setError(saveError.message || 'No se pudo guardar la integración.'); }
    finally { setBusy(false); }
  }
  async function toggle(item) {
    const action = item.enabled ? 'disable' : 'enable';
    if (item.enabled && !window.confirm(`¿Deshabilitar ${item.name}?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await apiRequest(`/api/integrations/${encodeURIComponent(item.id)}/${action}`, { method: 'POST' });
      if (view === 'detail') setSelected(result.data);
      setNotice(action === 'enable' ? 'Integración habilitada.' : 'Integración deshabilitada.'); await load();
    } catch (operationError) { setError(operationError.message || 'No se pudo cambiar el estado.'); }
    finally { setBusy(false); }
  }

  if (!canRead) return <div className="app-shell dashboard-layout"><div className="card warning-box" role="alert">Tu cuenta no tiene permiso para consultar integraciones.</div></div>;
  return <div className="app-shell dashboard-layout integrations-page">
    {error ? <div className="card warning-box" role="alert">{error}</div> : null}
    {notice ? <div className="inventory-notice" role="status">{notice}</div> : null}
    {view === 'list' ? <>
      <section className="card sales-toolbar"><div><h3>Integraciones</h3><p>Registro persistente de integraciones empresariales. No ejecuta conexiones externas.</p></div>{canCreate ? <button className="users-primary-button" type="button" onClick={beginCreate}>Nueva integración</button> : null}</section>
      <form className="sales-filters" onSubmit={event => { event.preventDefault(); setPage(1); setFilters(current => ({ ...current, search: searchDraft.trim() })); }}>
        <label>Buscar<input value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Nombre, slug, responsable" /></label>
        <label>Tipo<select value={filters.type} onChange={event => { setPage(1); setFilters(current => ({ ...current, type: event.target.value })); }}><option value="">Todos</option>{TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
        <label>Estado<select value={filters.status} onChange={event => { setPage(1); setFilters(current => ({ ...current, status: event.target.value })); }}><option value="">Todos</option>{STATUSES.map(status => <option key={status} value={status}>{status}</option>)}</select></label>
        <label>Habilitación<select value={filters.enabled} onChange={event => { setPage(1); setFilters(current => ({ ...current, enabled: event.target.value })); }}><option value="">Todas</option><option value="true">Habilitadas</option><option value="false">Deshabilitadas</option></select></label>
        <button className="secondary" type="submit">Buscar</button>
      </form>
      {loading ? <div className="card" role="status">Cargando integraciones…</div> : <section className="card"><div className="table-scroll"><table className="data-table"><thead><tr><th>Nombre</th><th>Tipo</th><th>Estado</th><th>Habilitada</th><th>Responsable</th><th>Última sincronización</th><th>Acciones</th></tr></thead><tbody>
        {items.length ? items.map(item => <tr key={item.id}><td><strong>{item.name}</strong><small className="integration-slug">{item.slug}</small></td><td>{item.type}</td><td>{item.status}</td><td>{item.enabled ? 'Sí' : 'No'}</td><td>{item.owner || 'Sin asignar'}</td><td>{date(item.lastSyncAt)}</td><td className="integration-actions"><button type="button" className="secondary" onClick={() => showDetail(item)}>Ver</button>{canUpdate ? <><button type="button" className="secondary" onClick={() => beginEdit(item)}>Editar</button><button type="button" className={item.enabled ? 'secondary' : 'users-primary-button'} disabled={busy} onClick={() => toggle(item)}>{item.enabled ? 'Desactivar' : 'Activar'}</button></> : null}</td></tr>) : <tr><td colSpan="7" className="empty-state">No hay integraciones configuradas.{canCreate ? <button type="button" className="secondary" onClick={beginCreate}>Agregar integración</button> : null}</td></tr>}
      </tbody></table></div></section>}
      {!loading && pagination.pages > 1 ? <nav className="inventory-pagination" aria-label="Paginación de integraciones"><span>{pagination.total} integraciones · Página {page} de {pagination.pages}</span><div><button className="secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Anterior</button><button className="secondary" disabled={page >= pagination.pages} onClick={() => setPage(value => value + 1)}>Siguiente</button></div></nav> : null}
    </> : null}
    {view === 'form' ? <section className="card integration-panel"><div className="sales-toolbar"><h3>{selected ? 'Editar integración' : 'Nueva integración'}</h3><button type="button" className="secondary" onClick={() => setView(selected ? 'detail' : 'list')}>Volver</button></div><form className="integration-form" onSubmit={save}>
      <label>Nombre<input required maxLength="120" value={form.name} onChange={event => setFormField('name', event.target.value)} /></label>
      {!selected ? <label>Slug (opcional; se genera desde el nombre)<input maxLength="80" pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={event => setFormField('slug', event.target.value)} placeholder="ejemplo-integracion" /></label> : <p className="integration-meta">Slug inmutable: {selected.slug}</p>}
      <label>Tipo<select value={form.type} onChange={event => setFormField('type', event.target.value)}>{TYPES.map(type => <option key={type}>{type}</option>)}</select></label>
      <label>Descripción<textarea maxLength="500" value={form.description} onChange={event => setFormField('description', event.target.value)} /></label>
      <label>Responsable<input maxLength="120" value={form.owner} onChange={event => setFormField('owner', event.target.value)} /></label>
      <fieldset className="integration-config"><legend>Configuración no sensible</legend>{form.config.map((row, index) => <div className="integration-config-row" key={index}><label>Clave<input value={row.key} onChange={event => setConfigRow(index, 'key', event.target.value)} /></label><label>Valor<input value={row.value} onChange={event => setConfigRow(index, 'value', event.target.value)} /></label><button type="button" className="secondary" aria-label={`Eliminar configuración ${index + 1}`} onClick={() => setForm(current => ({ ...current, config: current.config.filter((_, rowIndex) => rowIndex !== index) }))}>Quitar</button></div>)}<button type="button" className="secondary" onClick={() => setForm(current => ({ ...current, config: [...current.config, { key: '', value: '' }] }))}>Agregar par</button><small>El backend rechaza claves como apiKey, token, secret y password.</small></fieldset>
      <button className="users-primary-button" type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
    </form></section> : null}
    {view === 'detail' && selected ? <section className="card integration-panel"><div className="sales-toolbar"><div><h3>{selected.name}</h3><p>{selected.slug}</p></div><div className="integration-actions"><button type="button" className="secondary" onClick={() => setView('list')}>Volver</button>{canUpdate ? <><button type="button" className="secondary" onClick={() => beginEdit(selected)}>Editar</button><button type="button" className="users-primary-button" disabled={busy} onClick={() => toggle(selected)}>{selected.enabled ? 'Desactivar' : 'Activar'}</button></> : null}</div></div><dl className="integration-details"><dt>Tipo</dt><dd>{selected.type}</dd><dt>Estado</dt><dd>{selected.status}</dd><dt>Habilitada</dt><dd>{selected.enabled ? 'Sí' : 'No'}</dd><dt>Responsable</dt><dd>{selected.owner || 'Sin asignar'}</dd><dt>Descripción</dt><dd>{selected.description || '—'}</dd><dt>Última sincronización</dt><dd>{date(selected.lastSyncAt)}</dd><dt>Último error</dt><dd>{selected.lastError || '—'}</dd><dt>Creada</dt><dd>{date(selected.createdAt)}</dd><dt>Actualizada</dt><dd>{date(selected.updatedAt)}</dd><dt>Configuración pública</dt><dd><pre>{JSON.stringify(selected.config || {}, null, 2)}</pre></dd></dl></section> : null}
  </div>;
}
