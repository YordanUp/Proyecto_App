import { API_URL, apiFetch } from '../../services/api';
import { useEffect, useState } from 'react';


export default function NotificationsPage({ session }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadNotifications() {
      try {
        const token = session?.token;
        if (!token) {
          setError('Sesión no disponible.');
          setLoading(false);
          return;
        }

        const response = await apiFetch(`${API_URL}/api/reports/notifications`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const payload = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || 'No se pudieron cargar las notificaciones');
        }

        setNotifications(Array.isArray(payload.data) ? payload.data : []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadNotifications();
  }, [session]);

  return (
    <div className="app-shell dashboard-layout">
{error ? <div className="card warning-box">{error}</div> : null}

      {loading ? (
        <div className="card">Cargando notificaciones...</div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Mensaje</th>
                <th>Tipo</th>
                <th>Leída</th>
              </tr>
            </thead>
            <tbody>
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty-state">No hay notificaciones.</td>
                </tr>
              ) : (
                notifications.map((notification) => (
                  <tr key={notification.id}>
                    <td>{notification.title}</td>
                    <td>{notification.message}</td>
                    <td>{notification.type}</td>
                    <td>{notification.read ? 'Sí' : 'No'}</td>
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
