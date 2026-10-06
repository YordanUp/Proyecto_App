import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { notifyNotificationsChanged } from '../../services/notifications';

const FILTERS = [{ value: '', label: 'Todas' }, { value: 'unread', label: 'No leídas' }, { value: 'read', label: 'Leídas' }];

export default function NotificationsPage({ session }) {
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 0, total: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!session?.token) { setError('Sesión no disponible.'); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams({ page: String(page), limit: '20', sort: 'createdAt', order: 'desc' });
      if (filter) query.set('status', filter);
      const [list, count] = await Promise.all([
        apiRequest(`/api/notifications?${query}`),
        apiRequest('/api/notifications/unread-count')
      ]);
      setNotifications(Array.isArray(list.data) ? list.data : []);
      setPagination(list.pagination || { page, pages: 0, total: 0 });
      setUnreadCount(Number(count.data?.count) || 0);
    } catch (loadError) { setError(loadError.message || 'No se pudieron cargar las notificaciones.'); }
    finally { setLoading(false); }
  }, [filter, page, session?.token]);

  useEffect(() => { load(); }, [load]);
  async function markRead(item) {
    setError(''); setNotice('');
    try {
      const result = await apiRequest(`/api/notifications/${encodeURIComponent(item.id)}/read`, { method: 'POST' });
      setNotifications(current => current.map(value => value.id === item.id ? result.data : value));
      setUnreadCount(value => Math.max(0, value - (item.status === 'unread' ? 1 : 0)));
      setNotice('Notificación marcada como leída.'); notifyNotificationsChanged();
    } catch (operationError) { setError(operationError.message || 'No se pudo marcar la notificación.'); }
  }

  async function markAllRead() {
    setError(''); setNotice('');
    try {
      await apiRequest('/api/notifications/read-all', { method: 'POST' });
      const readAt = new Date().toISOString();
      setNotifications(current => current.map(item => item.status === 'unread' ? { ...item, status: 'read', readAt } : item));
      setUnreadCount(0); setNotice('Todas las notificaciones quedaron marcadas como leídas.'); notifyNotificationsChanged();
    } catch (operationError) { setError(operationError.message || 'No se pudieron marcar todas las notificaciones.'); }
  }

  return <div className="app-shell dashboard-layout notifications-page">
    {error ? <div className="card warning-box" role="alert">{error}</div> : null}
    {notice ? <div className="inventory-notice" role="status">{notice}</div> : null}
    <section className="card sales-toolbar"><div><h3>Centro de notificaciones</h3><p>{unreadCount} sin leer</p></div><button type="button" className="users-primary-button" onClick={markAllRead} disabled={!unreadCount}>Marcar todas como leídas</button></section>
    <nav className="sales-filters" aria-label="Filtrar notificaciones">{FILTERS.map(item => <button key={item.value} type="button" className={filter === item.value ? 'users-primary-button' : 'secondary'} onClick={() => { setPage(1); setFilter(item.value); }}>{item.label}</button>)}</nav>
    {loading ? <div className="card" role="status">Cargando notificaciones…</div> : <section className="card notifications-list">{notifications.length ? notifications.map(item => <article className={`notification-item${item.status === 'unread' ? ' unread' : ''}`} key={item.id}>
      <div className="notification-item-heading"><h4>{item.title}</h4><span className={`notification-priority ${item.priority}`}>{item.priority}</span></div>
      <p>{item.message}</p>
      <div className="notification-item-meta"><span>{item.type}</span><span>{item.module}</span><span>{new Date(item.createdAt).toLocaleString()}</span><span>{item.status === 'read' ? 'Leída' : 'No leída'}</span></div>
      {item.status === 'unread' ? <button type="button" className="secondary" onClick={() => markRead(item)}>Marcar como leída</button> : null}
    </article>) : <div className="empty-state">No hay notificaciones para este filtro.</div>}</section>}
    {!loading && pagination.pages > 1 ? <nav className="inventory-pagination" aria-label="Paginación de notificaciones"><span>{pagination.total} notificaciones · Página {page} de {pagination.pages}</span><div><button className="secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Anterior</button><button className="secondary" disabled={page >= pagination.pages} onClick={() => setPage(value => value + 1)}>Siguiente</button></div></nav> : null}
  </div>;
}
