import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function ReportsPage({ session, onLogout }) {
  const [reports, setReports] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadReports() {
      try {
        const token = session?.token;
        if (!token) {
          setError('Sesión no disponible.');
          setLoading(false);
          return;
        }

        const [reportsResponse, notificationsResponse, auditResponse] = await Promise.all([
          fetch(`${API_URL}/api/reports/reports`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_URL}/api/reports/notifications`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_URL}/api/reports/audit`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        const reportsPayload = await reportsResponse.json();
        const notificationsPayload = await notificationsResponse.json();
        const auditPayload = await auditResponse.json();

        if (!reportsResponse.ok || !reportsPayload?.success) {
          throw new Error(reportsPayload?.message || 'No se pudieron cargar los reportes');
        }

        if (!notificationsResponse.ok || !notificationsPayload?.success) {
          throw new Error(notificationsPayload?.message || 'No se pudieron cargar las notificaciones');
        }

        if (!auditResponse.ok || !auditPayload?.success) {
          throw new Error(auditPayload?.message || 'No se pudieron cargar los registros de auditoría');
        }

        setReports(Array.isArray(reportsPayload.data) ? reportsPayload.data : []);
        setNotifications(Array.isArray(notificationsPayload.data) ? notificationsPayload.data : []);
        setAuditLogs(Array.isArray(auditPayload.data) ? auditPayload.data : []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, [session]);

  return (
    <div className="app-shell dashboard-layout">
      <header className="topbar card">
        <div>
          <span className="eyebrow">Reportes</span>
          <h1>Reportes y auditoría</h1>
        </div>

        <div className="user-area">
          <Link to="/" className="link-button">Dashboard</Link>
          <button type="button" className="secondary" onClick={onLogout}>Cerrar sesión</button>
        </div>
      </header>

      {error ? <div className="card warning-box">{error}</div> : null}

      {loading ? (
        <div className="card">Cargando reportes y auditoría...</div>
      ) : (
        <>
          <div className="card">
            <h3>Reportes</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Título</th>
                  <th>Generado</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-state">No hay reportes disponibles.</td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.id}>
                      <td>{report.type}</td>
                      <td>{report.title}</td>
                      <td>{report.generatedAt ? new Date(report.generatedAt).toLocaleString() : '-'}</td>
                      <td>{report.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>Notificaciones</h3>
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

          <div className="card">
            <h3>Auditoría</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>Usuario</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-state">No hay registros de auditoría.</td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.action}</td>
                      <td>{log.entity}</td>
                      <td>{log.userId}</td>
                      <td>{log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
