import { API_URL, apiFetch } from '../../services/api';
import { useEffect, useState } from 'react';


export default function AuditPage({ session }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAuditLog() {
      try {
        const token = session?.token;
        if (!token) {
          setError('Sesión no disponible.');
          setLoading(false);
          return;
        }

        const response = await apiFetch(`${API_URL}/api/reports/audit`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const payload = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || 'No se pudo cargar la auditoría');
        }

        setEntries(Array.isArray(payload.data) ? payload.data : []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadAuditLog();
  }, [session]);

  return (
    <div className="app-shell dashboard-layout">
{error ? <div className="card warning-box">{error}</div> : null}

      {loading ? (
        <div className="card">Cargando auditoría...</div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state">No hay eventos de auditoría.</td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.occurredAt ? new Date(entry.occurredAt).toLocaleString() : '-'}</td>
                    <td>{entry.userId?.name || entry.userId?.email || 'Sistema'}</td>
                    <td>{entry.action}</td>
                    <td>{entry.module}</td>
                    <td>{entry.recordId || '-'}</td>
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
