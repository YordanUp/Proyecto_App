import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ASSIGNABLE_SYSTEM_ROLES = new Set(['admin', 'ventas', 'compras', 'almacen', 'finanzas', 'supervisor']);

function hasPermission(user, permission) {
  return Array.isArray(user?.permissions) && user.permissions.includes(permission);
}

function readableRole(role, roles) {
  const match = roles.find(item => item.id === role || item.name === role);
  return match?.description || String(role || 'Sin rol').replace(/[_-]/g, ' ');
}

function UserForm({ mode, user, roles, rolesError, requestError, saving, onClose, onSubmit }) {
  const [form, setForm] = useState(() => mode === 'edit'
    ? { name: user.name || '', email: user.email || '', status: user.status || 'active' }
    : { name: '', email: '', password: '', role: '', status: 'active' });
  const [validationError, setValidationError] = useState('');

  function updateField(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }));
    setValidationError('');
  }

  async function submit(event) {
    event.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim();
    if (name.length < 2) return setValidationError('El nombre debe tener al menos 2 caracteres.');
    if (!EMAIL_PATTERN.test(email)) return setValidationError('Ingresa un email válido.');
    if (mode === 'create' && form.password.length < 12) return setValidationError('La contraseña temporal debe tener al menos 12 caracteres.');
    if (mode === 'create' && !form.role) return setValidationError('Selecciona un rol.');

    const data = mode === 'create'
      ? { name, email, password: form.password, role: form.role, status: form.status }
      : { name, email, status: form.status };
    await onSubmit(data);
  }

  return (
    <div className="users-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="users-modal card" role="dialog" aria-modal="true" aria-labelledby="user-form-title">
        <div className="users-modal-heading">
          <div>
            <span className="eyebrow">Administración de accesos</span>
            <h3 id="user-form-title">{mode === 'create' ? 'Nuevo usuario' : 'Editar usuario'}</h3>
          </div>
          <button className="users-icon-button" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <form className="users-form" onSubmit={submit} noValidate>
          <label>Nombre completo
            <input name="name" value={form.name} onChange={updateField} autoComplete="name" required minLength={2} maxLength={120} />
          </label>
          <label>Email
            <input name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" required maxLength={254} />
          </label>
          {mode === 'create' ? <>
            <label>Contraseña temporal
              <input name="password" type="password" value={form.password} onChange={updateField} autoComplete="new-password" required minLength={12} maxLength={72} />
            </label>
            <p className={`password-hint${form.password.length >= 12 ? ' valid' : ''}`}>Mínimo 12 caracteres ({form.password.length}/12)</p>
            <label>Rol
              <select name="role" value={form.role} onChange={updateField} required disabled={roles.length === 0}>
                <option value="">Selecciona un rol</option>
                {roles.map(role => <option key={role.id} value={role.id}>{readableRole(role.name, roles)}</option>)}
              </select>
            </label>
            {rolesError ? <p className="form-error" role="alert">{rolesError}</p> : null}
          </> : null}
          <label>Estado
            <select name="status" value={form.status} onChange={updateField}>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </label>
          {validationError ? <p className="form-error" role="alert">{validationError}</p> : null}
          {requestError ? <p className="form-error" role="alert">{requestError}</p> : null}
          <div className="users-modal-actions">
            <button className="secondary" type="button" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="users-primary-button" type="submit" disabled={saving || (mode === 'create' && roles.length === 0)}>
              {saving ? 'Guardando...' : mode === 'create' ? 'Crear usuario' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function UsersPage({ session }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rolesError, setRolesError] = useState('');
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busyUserId, setBusyUserId] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  const permissions = session?.user;
  const canRead = hasPermission(permissions, 'users.read');
  const canCreate = hasPermission(permissions, 'users.create') && hasPermission(permissions, 'users.assign_role') && hasPermission(permissions, 'roles.read');
  const canUpdate = hasPermission(permissions, 'users.update');
  // The real PATCH route requires all three permissions (authorize uses every()).
  const canChangeRole = canUpdate && hasPermission(permissions, 'users.assign_role') && hasPermission(permissions, 'roles.read');
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '25', sort: 'name', order: 'asc' });
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    return params.toString();
  }, [search, statusFilter, page]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const payload = await apiRequest(`/api/users?${query}`);
        if (active) {
          const items = Array.isArray(payload.data) ? payload.data : [];
          setUsers(items);
          setPagination(payload.pagination || { page, limit: 25, total: items.length, pages: items.length ? 1 : 0 });
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'No se pudieron cargar los usuarios.');
      } finally {
        if (active) setLoading(false);
      }
    }
    if (canRead) load();
    else { setUsers([]); setLoading(false); setError('No tienes permiso para consultar usuarios.'); }
    return () => { active = false; };
  }, [canRead, query, reloadCount, session?.token]);

  useEffect(() => {
    let active = true;
    if (!canCreate && !canChangeRole) { setRoles([]); setRolesError(''); return () => { active = false; }; }
    setRolesError('');
    apiRequest('/api/roles')
      .then(payload => { if (active) setRoles(Array.isArray(payload.data) ? payload.data.filter(role => role.isSystem && ASSIGNABLE_SYSTEM_ROLES.has(role.name)) : []); })
      .catch(loadError => { if (active) setRolesError(loadError.message || 'No se pudieron cargar los roles.'); });
    return () => { active = false; };
  }, [canCreate, canChangeRole, session?.token]);

  async function createOrUpdate(data) {
    setSaving(true);
    setModalError('');
    setError('');
    try {
      const isCreate = modal.mode === 'create';
      const path = isCreate ? '/api/users' : `/api/users/${encodeURIComponent(modal.user.id)}`;
      const payload = await apiRequest(path, { method: isCreate ? 'POST' : 'PUT', body: JSON.stringify(data) });
      setModal(null);
      setReloadCount(count => count + 1);
      const emailVerification = payload.data?.emailVerification;
      if (isCreate && emailVerification === 'pending') {
        setNotice({ kind: 'warning', text: 'Usuario creado correctamente, pero el correo de confirmación no pudo enviarse.' });
      } else if (isCreate && emailVerification === 'sent') {
        setNotice({ kind: 'success', text: 'Usuario creado correctamente. Se envió un correo de confirmación.' });
      } else if (!isCreate && emailVerification === 'pending') {
        setNotice({ kind: 'warning', text: 'Usuario actualizado correctamente, pero el correo de confirmación no pudo enviarse.' });
      } else if (!isCreate && emailVerification === 'sent') {
        setNotice({ kind: 'success', text: 'Usuario actualizado correctamente. Se envió un correo de confirmación.' });
      } else {
        setNotice({ kind: 'success', text: isCreate ? 'Usuario creado correctamente.' : 'Usuario actualizado correctamente.' });
      }
    } catch (requestError) {
      setModalError(requestError.message || 'No se pudo guardar el usuario.');
    } finally { setSaving(false); }
  }

  async function changeRole(user, role) {
    setBusyUserId(user.id);
    setError('');
    try {
      await apiRequest(`/api/users/${encodeURIComponent(user.id)}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
      setNotice({ kind: 'success', text: `Rol de ${user.name} actualizado correctamente.` });
      setReloadCount(count => count + 1);
    } catch (requestError) { setError(requestError.message || 'No se pudo cambiar el rol.'); }
    finally { setBusyUserId(''); }
  }

  async function toggleStatus(user) {
    const status = user.status === 'active' ? 'inactive' : 'active';
    setBusyUserId(user.id);
    setError('');
    try {
      await apiRequest(`/api/users/${encodeURIComponent(user.id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setNotice({ kind: 'success', text: `Usuario ${status === 'active' ? 'activado' : 'desactivado'} correctamente.` });
      setReloadCount(count => count + 1);
    } catch (requestError) { setError(requestError.message || 'No se pudo cambiar el estado.'); }
    finally { setBusyUserId(''); }
  }

  async function resendVerification(user) {
    setBusyUserId(user.id);
    setError('');
    try {
      const payload = await apiRequest('/api/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email: user.email }) });
      setNotice({ kind: 'success', text: payload.message || 'Si la cuenta requiere verificación, se enviará un correo.' });
    } catch (requestError) { setError(requestError.message || 'No fue posible procesar la solicitud.'); }
    finally { setBusyUserId(''); }
  }

  return (
    <div className="app-shell dashboard-layout users-page">
      <section className="card users-toolbar">
        <div>
          <h3>Usuarios registrados</h3>
          <p>Administra accesos y asignaciones de rol.</p>
        </div>
        {canCreate ? <button type="button" className="users-primary-button" onClick={() => { setNotice(null); setModalError(''); setModal({ mode: 'create' }); }}>+ Nuevo usuario</button> : null}
      </section>

      {notice ? <div className={`users-notice ${notice.kind}`} role="status">{notice.text}</div> : null}
      {error ? <div className="card warning-box" role="alert">{error}</div> : null}
      {rolesError && canChangeRole && !modal ? <div className="card warning-box" role="alert">{rolesError}</div> : null}

      <section className="card users-filters" aria-label="Filtros de usuarios">
        <label>Buscar
          <input type="search" value={search} onChange={event => { setPage(1); setSearch(event.target.value); }} placeholder="Nombre o email" />
        </label>
        <label>Estado
          <select value={statusFilter} onChange={event => { setPage(1); setStatusFilter(event.target.value); }}>
            <option value="">Todos</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </label>
      </section>

      {loading ? <div className="card">Cargando usuarios...</div> : (
        <div className="card users-table-card">
          <table className="data-table">
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Correo verificado</th><th>Permisos</th><th>Acciones</th></tr></thead>
            <tbody>
              {users.length === 0 ? <tr><td colSpan="7" className="empty-state">No hay usuarios para mostrar.</td></tr> : users.map(user => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    {canChangeRole ? <select aria-label={`Rol de ${user.name}`} value={roles.find(role => role.name === user.role || role.id === user.role)?.id || ''} disabled={busyUserId === user.id || roles.length === 0 || Boolean(rolesError)} onChange={event => { if (event.target.value) changeRole(user, event.target.value); }}>
                      {!roles.some(role => role.name === user.role || role.id === user.role) ? <option value="">{readableRole(user.role, roles)}</option> : null}
                      {roles.map(role => <option key={role.id} value={role.id}>{readableRole(role.name, roles)}</option>)}
                    </select> : readableRole(user.role, roles)}
                  </td>
                  <td><span className={`user-status ${user.status === 'active' ? 'active' : 'inactive'}`}>{user.status === 'active' ? 'Activo' : 'Inactivo'}</span></td>
                  <td><span className={`verification-status ${user.emailVerified ? 'verified' : 'pending'}`}>{user.emailVerified ? 'Sí' : 'No'}</span></td>
                  <td>{Array.isArray(user.permissions) ? user.permissions.length : 0}</td>
                  <td><div className="users-row-actions">
                    {canUpdate ? <button className="users-text-button" type="button" onClick={() => { setNotice(null); setModalError(''); setModal({ mode: 'edit', user }); }}>Editar</button> : null}
                    {canUpdate ? <button className="users-text-button" type="button" disabled={busyUserId === user.id} onClick={() => toggleStatus(user)}>{user.status === 'active' ? 'Desactivar' : 'Activar'}</button> : null}
                    {!user.emailVerified ? <button className="users-text-button" type="button" disabled={busyUserId === user.id} onClick={() => resendVerification(user)}>{busyUserId === user.id ? 'Enviando...' : 'Reenviar verificación'}</button> : null}
                    {!canUpdate && !canChangeRole && user.emailVerified ? <span aria-label="Sin acciones disponibles">—</span> : null}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && pagination.pages > 1 ? <nav className="users-pagination" aria-label="Paginación de usuarios">
        <span>{pagination.total} usuarios · Página {pagination.page} de {pagination.pages}</span>
        <div>
          <button className="secondary" type="button" disabled={pagination.page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Anterior</button>
          <button className="secondary" type="button" disabled={pagination.page >= pagination.pages} onClick={() => setPage(current => Math.min(pagination.pages, current + 1))}>Siguiente</button>
        </div>
      </nav> : null}

      {modal ? <UserForm mode={modal.mode} user={modal.user} roles={roles} rolesError={rolesError} requestError={modalError} saving={saving} onClose={() => setModal(null)} onSubmit={createOrUpdate} /> : null}
    </div>
  );
}
