import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { catalogDefinitions } from './catalogDefinitions';

function hasPermission(user, permission) {
  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
}

function CatalogForm({ definition, resource, categories, categoriesLoading, categoriesError, saving, requestError, onClose, onSubmit }) {
  const [form, setForm] = useState(() => {
    const initial = Object.fromEntries(definition.fields.map(field => [field.name, resource?.[field.name] ?? (field.name === 'status' ? 'active' : '')]));
    return initial;
  });
  const [validationError, setValidationError] = useState('');

  function updateField(event) {
    const { name, value } = event.target;
    const field = definition.fields.find(item => item.name === name);
    setForm(current => ({ ...current, [name]: field?.uppercase ? value.toUpperCase() : value }));
    setValidationError('');
  }

  function submit(event) {
    event.preventDefault();
    const data = Object.fromEntries(definition.fields.map(field => {
      const value = form[field.name];
      return [field.name, typeof value === 'string' ? value.trim() : value];
    }));
    for (const field of definition.fields) {
      if (field.required && !String(data[field.name] ?? '').trim()) {
        setValidationError(`${field.label} es obligatorio.`);
        return;
      }
      if (field.type === 'number' && data[field.name] !== '' && (!Number.isFinite(Number(data[field.name])) || Number(data[field.name]) < (field.min ?? 0))) {
        setValidationError(`${field.label} debe ser un número válido.`);
        return;
      }
    }
    if (definition === catalogDefinitions.products && Number(data.salePrice) < Number(data.purchasePrice)) {
      setValidationError('El precio de venta no puede ser menor al precio de compra.');
      return;
    }
    for (const field of definition.fields) {
      if (field.type === 'number' && data[field.name] === '' && !field.required) delete data[field.name];
      else if (field.type === 'number' && data[field.name] !== '') data[field.name] = Number(data[field.name]);
    }
    onSubmit(data);
  }

  function renderField(field) {
    const common = { id: `catalog-${field.name}`, name: field.name, value: form[field.name] ?? '', onChange: updateField, required: field.required, maxLength: field.maxLength };
    if (field.type === 'textarea') return <textarea {...common} rows="3" />;
    if (field.type === 'status') return <select {...common}><option value="active">Activo</option><option value="inactive">Inactivo</option></select>;
    if (field.type === 'category') return (
      <>
        <select {...common} disabled={categoriesLoading || Boolean(categoriesError)}>
          <option value="">{categoriesLoading ? 'Cargando categorías…' : 'Selecciona una categoría'}</option>
          {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        {categoriesError ? <span className="catalog-field-help" role="alert">{categoriesError}</span> : null}
      </>
    );
    return <input {...common} type={field.type || 'text'} min={field.min} step={field.step} autoCapitalize={field.uppercase ? 'characters' : undefined} />;
  }

  return (
    <div className="catalog-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="catalog-modal card" role="dialog" aria-modal="true" aria-labelledby="catalog-form-title">
        <div className="catalog-modal-heading">
          <div><span className="eyebrow">Catálogo persistente</span><h3 id="catalog-form-title">{resource ? `Editar ${definition.singular}` : `Nuevo ${definition.singular}`}</h3></div>
          <button type="button" className="catalog-close" aria-label="Cerrar" onClick={onClose}>×</button>
        </div>
        <form className="catalog-form" onSubmit={submit} noValidate>
          {definition.fields.map(field => <label key={field.name} htmlFor={`catalog-${field.name}`}>{field.label}{renderField(field)}</label>)}
          {validationError ? <p className="form-error" role="alert">{validationError}</p> : null}
          {requestError ? <p className="form-error" role="alert">{requestError}</p> : null}
          <div className="catalog-form-actions">
            <button className="secondary" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : resource ? 'Guardar cambios' : 'Crear'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function displayValue(item, column, categories) {
  const value = item[column.key];
  if (column.format === 'money') return `$${Number(value || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (column.format === 'status') return <span className={`catalog-status ${value === 'inactive' ? 'inactive' : 'active'}`}>{value === 'inactive' ? 'Inactivo' : 'Activo'}</span>;
  if (column.key === 'categoryId') return categories.find(category => category.id === value)?.name || value || 'Sin categoría';
  return value || '—';
}

export default function CatalogManager({ entity, session }) {
  const definition = catalogDefinitions[entity];
  const permissions = session?.user;
  const canRead = hasPermission(permissions, definition.read);
  const canCreate = hasPermission(permissions, definition.create);
  const canUpdate = hasPermission(permissions, definition.update);
  const canRemove = hasPermission(permissions, definition.remove);
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modalError, setModalError] = useState('');
  const [modal, setModal] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [reloadCount, setReloadCount] = useState(0);
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    return params.toString();
  }, [page, search, statusFilter]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const payload = await apiRequest(`${definition.endpoint}?${query}`);
        if (!active) return;
        const data = Array.isArray(payload.data) ? payload.data : [];
        setItems(data);
        setPagination(payload.pagination || { page, limit: 25, total: data.length, pages: data.length ? 1 : 0 });
      } catch (loadError) {
        if (active) setError(loadError.message || `No se pudieron cargar ${definition.label.toLowerCase()}.`);
      } finally { if (active) setLoading(false); }
    }
    if (canRead) load();
    else { setItems([]); setLoading(false); setError(`No tienes permiso para consultar ${definition.label.toLowerCase()}.`); }
    return () => { active = false; };
  }, [canRead, definition, query, reloadCount, session?.token]);

  useEffect(() => {
    let active = true;
    if (entity !== 'products' || !modalOpen) return () => { active = false; };
    if (!hasPermission(permissions, 'categories.read')) {
      setCategoryLoading(false);
      setCategoryError('Tu rol necesita categories.read para seleccionar una categoría.');
      return () => { active = false; };
    }
    setCategoryLoading(true);
    setCategoryError('');
    apiRequest('/api/categories?limit=100&status=active&page=1')
      .then(payload => { if (active) setCategories(Array.isArray(payload.data) ? payload.data : []); })
      .catch(loadError => { if (active) setCategoryError(loadError.message || 'No se pudieron cargar las categorías.'); })
      .finally(() => { if (active) setCategoryLoading(false); });
    return () => { active = false; };
  }, [entity, modalOpen, permissions]);

  function openForm(resource = null) {
    setModalError('');
    setCategoryError('');
    setError('');
    setModal(resource);
    setModalOpen(true);
  }

  async function save(data) {
    setSaving(true);
    setModalError('');
    try {
      const creating = !modal;
      const path = creating ? definition.endpoint : `${definition.endpoint}/${encodeURIComponent(modal.id)}`;
      await apiRequest(path, { method: creating ? 'POST' : 'PUT', body: JSON.stringify(data) });
      setModalOpen(false);
      setModal(null);
      setNotice(`${definition.singular} ${creating ? 'creado' : 'actualizado'} correctamente.`);
      if (creating) setPage(1);
      setReloadCount(count => count + 1);
    } catch (saveError) { setModalError(saveError.message || 'No se pudo guardar el registro.'); }
    finally { setSaving(false); }
  }

  async function changeStatus(item) {
    const deactivate = item.status !== 'inactive';
    const action = deactivate ? 'desactivar' : 'activar';
    if (!window.confirm(`¿Deseas ${action} ${item.name}?`)) return;
    setError('');
    setNotice('');
    try {
      const path = `${definition.endpoint}/${encodeURIComponent(item.id)}`;
      if (deactivate) await apiRequest(path, { method: 'DELETE' });
      else await apiRequest(path, { method: 'PUT', body: JSON.stringify({ status: 'active' }) });
      setNotice(`${definition.singular} ${deactivate ? 'desactivado' : 'activado'} correctamente.`);
      setReloadCount(count => count + 1);
    } catch (statusError) { setError(statusError.message || `No se pudo ${action} el registro.`); }
  }

  const categoriesForColumns = entity === 'products' ? categories : [];
  return (
    <div className="app-shell dashboard-layout catalog-page">
      <section className="card catalog-toolbar">
        <div><strong className="catalog-manager-title">{definition.label}</strong><p>Busca y administra registros persistidos en el catálogo.</p></div>
        {canCreate ? <button className="primary" type="button" onClick={() => openForm()}>+ Nuevo {definition.singular}</button> : null}
      </section>
      <section className="card catalog-filters" aria-label={`Filtros de ${definition.label.toLowerCase()}`}>
        <label>Buscar<input aria-label={`Buscar ${definition.label.toLowerCase()}`} type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder={`Buscar ${definition.label.toLowerCase()}…`} /></label>
        <label>Estado<select aria-label="Filtrar por estado" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }}><option value="">Todos los estados</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></label>
      </section>
      {error ? <div className="card warning-box" role="alert">{error}</div> : null}
      {notice ? <div className="catalog-notice" role="status">{notice}</div> : null}
      <section className="card catalog-table-card">
        {loading ? <div className="catalog-loading" role="status">Cargando {definition.label.toLowerCase()}…</div> : (
          <table className="data-table">
            <thead><tr>{definition.columns.map(column => <th key={column.key}>{column.label}</th>)}{canUpdate || canRemove ? <th>Acciones</th> : null}</tr></thead>
            <tbody>
              {items.length === 0 ? <tr><td colSpan={definition.columns.length + (canUpdate || canRemove ? 1 : 0)} className="empty-state">No hay {definition.label.toLowerCase()} para mostrar.</td></tr> : items.map(item => (
                <tr key={item.id}>
                  {definition.columns.map(column => <td key={column.key}>{column.key === 'stock' ? <a href="/inventory">Consultar inventario</a> : displayValue(item, column, categoriesForColumns)}</td>)}
                  {canUpdate || canRemove ? <td className="catalog-actions">
                    {canUpdate ? <button className="secondary" type="button" onClick={() => openForm(item)}>Editar</button> : null}
                    {item.status !== 'inactive' && canRemove ? <button className="catalog-danger" type="button" onClick={() => changeStatus(item)}>Desactivar</button> : null}
                    {item.status === 'inactive' && canUpdate ? <button className="secondary" type="button" onClick={() => changeStatus(item)}>Activar</button> : null}
                  </td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <nav className="users-pagination" aria-label={`Paginación de ${definition.label.toLowerCase()}`}>
        <span>{pagination.total || 0} registros · Página {page} de {Math.max(pagination.pages || 0, 1)}</span>
        <div>
          <button className="secondary" type="button" disabled={page <= 1 || loading} onClick={() => setPage(current => Math.max(1, current - 1))}>Anterior</button>
          <button className="secondary" type="button" disabled={page >= (pagination.pages || 1) || loading} onClick={() => setPage(current => current + 1)}>Siguiente</button>
        </div>
      </nav>
      {modalOpen ? <CatalogForm definition={definition} resource={modal} categories={categories} categoriesLoading={categoryLoading} categoriesError={categoryError} saving={saving} requestError={modalError} onClose={() => { setModalOpen(false); setModal(null); }} onSubmit={save} /> : null}
    </div>
  );
}
