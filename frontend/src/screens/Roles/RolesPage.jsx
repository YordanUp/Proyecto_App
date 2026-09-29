import { API_URL, apiFetch } from '../../services/api';
import { useEffect, useState } from 'react';


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

        const response = await apiFetch(`${API_URL}/api/roles`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const payload = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || 'No se pudieron cargar los roles');
        }

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
              </tr>
            </thead>
            <tbody>
              {roles.length === 0 ? (
                <tr>
                  <td colSpan="3" className="empty-state">No hay roles registrados.</td>
                </tr>
              ) : (
                roles.map((role) => (
                  <tr key={role.id}>
                    <td>{role.name}</td>
                    <td>{role.description || 'Sin descripción'}</td>
                    <td>{Array.isArray(role.permissions) ? role.permissions.length : 0}</td>
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
