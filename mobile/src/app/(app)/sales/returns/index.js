import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { Button, Card, EmptyPanel, LoadingPanel, Page, SectionTitle } from '../../../../components/UI';
import { ErrorPanel, LoadMore, MoneyText } from '../../../../components/OperationalUI';
import { listSalesReturns } from '../../../../services/operationalService';
import { hasPermission } from '../../../../services/permissions';
import { userMessage } from '../../../../api/client';
import colors from '../../../../theme/colors';

export default function SalesReturnsScreen() {
  const { request, user } = useAuth();
  const [items, setItems] = useState([]); const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true); const [moreLoading, setMoreLoading] = useState(false); const [error, setError] = useState(null);
  const load = useCallback(async (page = 1, append = false) => {
    if (append) setMoreLoading(true); else setLoading(true);
    setError(null);
    try { const result = await listSalesReturns(request, { page, limit: 20, sort: 'createdAt', order: 'desc' }); setItems(current => append ? [...current, ...result.items] : result.items); setPagination(result.pagination); }
    catch (e) { setError(e); } finally { setLoading(false); setMoreLoading(false); }
  }, [request]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return <Page refreshing={loading} onRefresh={() => load()}>
    <SectionTitle title="Devoluciones" action={hasPermission(user, 'sales.returns.create') ? <Button title="Nueva" onPress={() => router.push('/sales/returns/new')} /> : null} />
    <Text style={{ color: colors.inkMuted }}>Devoluciones procesadas con reposición de existencias y ajuste de CxC.</Text>
    <ErrorPanel error={error} onRetry={() => load()} userMessage={userMessage} />
    {loading ? <LoadingPanel title="Cargando devoluciones" detail="Consultando registros persistentes…" /> : items.map(item => <Pressable key={item.id} onPress={() => router.push(`/sales/returns/${item.id}`)}>
      <Card><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontWeight: '800', fontSize: 16 }}>{item.folio}</Text><Text style={{ color: colors.inkMuted, marginTop: 4 }}>{item.sale?.folio || item.saleId} · {item.customer?.name || 'Cliente'}</Text></View><Text style={{ color: colors.success, fontWeight: '700' }}>Procesada</Text></View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.inkMuted }}>{item.reason}</Text><MoneyText value={item.total} /></View><Text style={{ color: colors.inkMuted }}>{item.processedAt ? new Date(item.processedAt).toLocaleDateString('es-MX') : '—'}</Text></Card>
    </Pressable>)}
    {!loading && !error && !items.length ? <EmptyPanel title="Sin devoluciones" detail="Todavía no hay devoluciones registradas." /> : null}
    <LoadMore pagination={pagination} loading={moreLoading} onPress={() => load(Number(pagination.page) + 1, true)} />
  </Page>;
}
