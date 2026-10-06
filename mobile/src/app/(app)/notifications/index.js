import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { Button, Card, EmptyPanel, LoadingPanel, Page, SectionTitle, Notice } from '../../../components/UI';
import { ChoiceChips, ErrorPanel } from '../../../components/OperationalUI';
import { getNotificationUnreadCount, listNotifications, markAllNotificationsRead, markNotificationRead } from '../../../services/operationalService';
import { hasPermission } from '../../../services/permissions';
import { userMessage } from '../../../api/client';
import colors from '../../../theme/colors';

const filters = [{ value: '', label: 'Todas' }, { value: 'unread', label: 'No leídas' }, { value: 'read', label: 'Leídas' }];

export default function NotificationsScreen() {
  const { request, user } = useAuth();
  const [items, setItems] = useState([]); const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState(''); const [page, setPage] = useState(1); const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [result, count] = await Promise.all([listNotifications(request, { page, limit: 20, status: filter, sort: 'createdAt', order: 'desc' }), getNotificationUnreadCount(request)]);
      setItems(result.items); setPagination(result.pagination); setUnreadCount(Number(count.count) || 0);
    } catch (loadError) { setError(loadError); } finally { setLoading(false); }
  }, [filter, page, request]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function markOne(item) {
    setBusy(true); setError(null);
    try { const result = await markNotificationRead(request, item.id); setItems(current => current.map(value => value.id === item.id ? result.data : value)); setUnreadCount(value => Math.max(0, value - (item.status === 'unread' ? 1 : 0))); }
    catch (operationError) { setError(operationError); } finally { setBusy(false); }
  }
  async function markAll() {
    setBusy(true); setError(null);
    try { await markAllNotificationsRead(request); const readAt = new Date().toISOString(); setItems(current => current.map(item => item.status === 'unread' ? { ...item, status: 'read', readAt } : item)); setUnreadCount(0); }
    catch (operationError) { setError(operationError); } finally { setBusy(false); }
  }
  if (!hasPermission(user, 'notifications.read')) return <Page><Notice tone="warning">Tu cuenta no tiene permiso para ver notificaciones.</Notice></Page>;

  return <Page refreshing={loading} onRefresh={load}>
    <SectionTitle title="Notificaciones" action={<Button title="Marcar todas" variant="secondary" disabled={!unreadCount || busy} onPress={markAll} />} />
    <Notice>{unreadCount} notificaciones sin leer</Notice>
    <ChoiceChips options={filters} value={filter} onChange={value => { setPage(1); setFilter(value); }} />
    <ErrorPanel error={error} onRetry={load} userMessage={userMessage} />
    {loading ? <LoadingPanel title="Cargando notificaciones" /> : items.map(item => <Card key={item.id} style={item.status === 'unread' ? { borderColor: colors.success } : undefined}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text style={{ color: colors.ink, fontSize: 15, fontWeight: '800', flex: 1 }}>{item.title}</Text><Text style={{ color: colors.inkMuted, fontSize: 11 }}>{item.priority}</Text></View>
      <Text style={{ color: colors.inkMuted, lineHeight: 20 }}>{item.message}</Text>
      <Text style={{ color: colors.inkMuted, fontSize: 11 }}>{item.type} · {item.module} · {new Date(item.createdAt).toLocaleString('es-MX')} · {item.status === 'read' ? 'Leída' : 'No leída'}</Text>
      <Button title="Ver detalle" variant="secondary" onPress={() => Alert.alert(item.title, `${item.message}\n\n${item.module} · ${item.type}${item.recordId ? ` · Registro ${item.recordId}` : ''}`)} />
      {item.status === 'unread' ? <Button title="Marcar como leída" disabled={busy} onPress={() => markOne(item)} /> : null}
    </Card>)}
    {!loading && !error && !items.length ? <EmptyPanel title="Sin notificaciones" detail="No tienes notificaciones para este filtro." /> : null}
    {pagination?.pages > 1 ? <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><Button title="Anterior" variant="secondary" disabled={page <= 1} onPress={() => setPage(value => value - 1)} /><Text style={{ alignSelf: 'center', color: colors.inkMuted }}>Página {page} de {pagination.pages}</Text><Button title="Siguiente" variant="secondary" disabled={page >= pagination.pages} onPress={() => setPage(value => value + 1)} /></View> : null}
  </Page>;
}
