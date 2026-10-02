import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { Button, Card, EmptyPanel, LoadingPanel, Page, SectionTitle } from '../../../components/UI';
import { ChoiceChips, ErrorPanel, LoadMore, MoneyText, SearchBar, StatusBadge } from '../../../components/OperationalUI';
import { listPurchases } from '../../../services/operationalService';
import { hasPermission } from '../../../services/permissions';
import { userMessage } from '../../../api/client';
import config from '../../../constants/config';
import useDelayedFlag from '../../../hooks/useDelayedFlag';
import colors from '../../../theme/colors';

const statuses = [{ value: '', label: 'Todas' }, { value: 'draft', label: 'Borrador' }, { value: 'ordered', label: 'Ordenadas' }, { value: 'received', label: 'Recibidas' }, { value: 'cancelled', label: 'Canceladas' }];

export default function PurchasesScreen() {
  const { request, user } = useAuth();
  const [items, setItems] = useState([]); const [pagination, setPagination] = useState(null); const [search, setSearch] = useState(''); const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true); const [moreLoading, setMoreLoading] = useState(false); const [error, setError] = useState(null);
  const waking = useDelayedFlag(loading, config.coldStartNoticeMs);
  const load = useCallback(async (page = 1, append = false) => {
    if (append) setMoreLoading(true); else setLoading(true);
    setError(null);
    try { const result = await listPurchases(request, { page, limit: 20, search, status }); setItems(current => append ? [...current, ...result.items] : result.items); setPagination(result.pagination); }
    catch (loadError) { setError(loadError); }
    finally { setLoading(false); setMoreLoading(false); }
  }, [request, search, status]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return <Page refreshing={loading} onRefresh={() => load()}>
    <SectionTitle title="Compras" action={hasPermission(user, 'purchases.create') ? <Button title="Nueva" onPress={() => router.push('/purchases/new')} /> : null} />
    <Text style={{ color: colors.inkMuted }}>Recepciones actualizan existencias y registran cuentas por pagar en el servidor.</Text>
    <SearchBar value={search} onChangeText={setSearch} onSearch={() => load()} placeholder="Folio o proveedor" />
    <ChoiceChips options={statuses} value={status} onChange={setStatus} />
    <ErrorPanel error={error} onRetry={() => load()} userMessage={userMessage} />
    {loading ? <LoadingPanel title="Cargando compras" detail={waking ? 'El servidor de Render puede tardar unos segundos en iniciar.' : 'Consultando documentos persistentes…'} /> : items.map(purchase => <Pressable key={purchase.id} onPress={() => router.push(`/purchases/${purchase.id}`)}><Card>
      <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 16 }}>{purchase.folio}</Text><Text style={{ color: colors.inkMuted }}>{purchase.supplier?.name || 'Proveedor'} · {purchase.createdAt ? new Date(purchase.createdAt).toLocaleDateString('es-MX') : '—'}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: colors.inkMuted }}>{purchase.items?.length || 0} partidas</Text><StatusBadge status={purchase.status} /></View><MoneyText value={purchase.total} />
    </Card></Pressable>)}
    {!loading && !error && !items.length ? <EmptyPanel title="Sin compras" detail="No hay compras que coincidan con los filtros." /> : null}
    <LoadMore pagination={pagination} loading={moreLoading} onPress={() => load(Number(pagination.page) + 1, true)} />
  </Page>;
}
