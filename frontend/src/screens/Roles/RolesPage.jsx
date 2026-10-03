import { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';

const permissionGroups = permissions => Object.entries((permissions || []).reduce((groups, permission) => {
  const [module] = permission.split('.');
  (groups[module] ||= []).push(permission);
  return groups;
}, {}));

export default function RolesPage({ session }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadRoles() {
      try {
        const token = session?.token;
        if (!token) {
          setError('Sesión no disponible.');
          setLoading(false);
          return;
        }

        const payload = await apiRequest('/api/roles', { token });
        setRoles(Array.isArray(payload.data) ? payload.data : []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadRoles();
  }, [session]);

  return (
    <div className="app-shell dashboard-layout">
{error ? <div className="card warning-box">{error}</div> : null}

      {loading ? (
        <div className="card">Cargando roles...</div>
      ) : (
      <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Permisos</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {roles.length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty-state">No hay roles registrados.</td>
                </tr>
              ) : (
                roles.map((role) => (
                  <tr key={role.id}>
                    <td>{role.name}</td>
                    <td>{role.description || 'Sin descripción'}</td>
                    <td><details><summary>{Array.isArray(role.permissions) ? role.permissions.length : 0} permisos</summary>
                      {permissionGroups(role.permissions).map(([module, permissions]) => <div key={module} className="role-permission-group"><strong>{module}</strong><ul>{permissions.map(permission => <li key={permission}>{permission}</li>)}</ul></div>)}
                    </details></td>
                    <td>{role.isSystem ? 'Sistema' : 'Personalizado'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
