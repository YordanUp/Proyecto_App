import { API_URL, apiFetch } from '../../services/api';
import { useEffect, useState } from 'react';


export default function IntegrationsPage({ session }) {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadIntegrations() {
      try {
        const token = session?.token;
        if (!token) {
          setError('Sesión no disponible.');
          setLoading(false);
          return;
        }

        const response = await apiFetch(`${API_URL}/api/integrations`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const payload = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || 'No se pudieron cargar las integraciones');
        }

        setIntegrations(Array.isArray(payload.data) ? payload.data : []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadIntegrations();
  }, [session]);

  return (
    <div className="app-shell dashboard-layout">
{error ? <div className="card warning-box">{error}</div> : null}

      {loading ? (
        <div className="card">Cargando integraciones...</div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Última sincronización</th>
                <th>Propietario</th>
              </tr>
            </thead>
            <tbody>
              {integrations.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state">No hay integraciones configuradas.</td>
                </tr>
              ) : (
                integrations.map((integration) => (
                  <tr key={integration.id}>
                    <td>{integration.name}</td>
                    <td>{integration.type}</td>
                    <td>{integration.status}</td>
                    <td>{integration.lastSync ? new Date(integration.lastSync).toLocaleString() : '-'}</td>
                    <td>{integration.owner}</td>
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
