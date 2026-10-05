import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { Button, Card, EmptyPanel, LoadingPanel, Page, SectionTitle } from '../../../components/UI';
import { ChoiceChips, ErrorPanel, LoadMore, MoneyText, SearchBar, StatusBadge } from '../../../components/OperationalUI';
import { listSales } from '../../../services/operationalService';
import { hasPermission } from '../../../services/permissions';
import { userMessage } from '../../../api/client';
import config from '../../../constants/config';
import useDelayedFlag from '../../../hooks/useDelayedFlag';
import colors from '../../../theme/colors';

const statuses = [{ value: '', label: 'Todas' }, { value: 'draft', label: 'Borrador' }, { value: 'confirmed', label: 'Confirmadas' }, { value: 'cancelled', label: 'Canceladas' }];

export default function SalesScreen() {
  const { request, user } = useAuth();
  const [items, setItems] = useState([]); const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState(''); const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true); const [moreLoading, setMoreLoading] = useState(false); const [error, setError] = useState(null);
  const waking = useDelayedFlag(loading, config.coldStartNoticeMs);
  const load = useCallback(async (page = 1, append = false) => {
    if (append) setMoreLoading(true); else setLoading(true);
    setError(null);
    try { const result = await listSales(request, { page, limit: 20, search, status }); setItems(current => append ? [...current, ...result.items] : result.items); setPagination(result.pagination); }
    catch (loadError) { setError(loadError); }
    finally { setLoading(false); setMoreLoading(false); }
  }, [request, search, status]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return <Page refreshing={loading} onRefresh={() => load()}>
    <SectionTitle title="Ventas" action={hasPermission(user, 'sales.create') ? <Button title="Nueva" onPress={() => router.push('/sales/new')} /> : null} />
    <Text style={{ color: colors.inkMuted }}>Ventas persistentes. Confirmar descuenta inventario y genera la cuenta por cobrar.</Text>
    <SearchBar value={search} onChangeText={setSearch} onSearch={() => load()} placeholder="Folio o cliente" />
    <ChoiceChips options={statuses} value={status} onChange={setStatus} />
    <ErrorPanel error={error} onRetry={() => load()} userMessage={userMessage} />
    {loading ? <LoadingPanel title="Cargando ventas" detail={waking ? 'El servidor de Render puede tardar unos segundos en iniciar.' : 'Consultando documentos persistentes…'} /> : items.map(sale => <Pressable key={sale.id} onPress={() => router.push(`/sales/${sale.id}`)}>
      <Card><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontWeight: '800', fontSize: 16 }}>{sale.folio}</Text><Text style={{ color: colors.inkMuted, marginTop: 4 }}>{sale.customer?.name || 'Cliente'} · {sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('es-MX') : '—'}</Text></View><StatusBadge status={sale.status} /></View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: colors.inkMuted }}>{sale.items?.length || 0} partidas</Text><MoneyText value={sale.total} /></View></Card>
    </Pressable>)}
    {!loading && !error && !items.length ? <EmptyPanel title="Sin ventas" detail="No hay ventas que coincidan con los filtros." /> : null}
    <LoadMore pagination={pagination} loading={moreLoading} onPress={() => load(Number(pagination.page) + 1, true)} />
  </Page>;
}
