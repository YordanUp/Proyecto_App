import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { Button, Card, EmptyPanel, LoadingPanel, Page, SectionTitle } from '../../../../components/UI';
import { ChoiceChips, ErrorPanel, LoadMore, MoneyText, SearchBar, StatusBadge } from '../../../../components/OperationalUI';
import { listQuotations } from '../../../../services/operationalService';
import { hasPermission } from '../../../../services/permissions';
import { userMessage } from '../../../../api/client';
import colors from '../../../../theme/colors';

const statuses = [{ value: '', label: 'Todas' }, { value: 'draft', label: 'Borrador' }, { value: 'sent', label: 'Enviada' }, { value: 'accepted', label: 'Aceptada' }, { value: 'rejected', label: 'Rechazada' }, { value: 'converted', label: 'Convertida' }, { value: 'cancelled', label: 'Cancelada' }];
export default function QuotationsScreen() {
  const { request, user } = useAuth(); const [items, setItems] = useState([]); const [pagination, setPagination] = useState(null); const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [loading, setLoading] = useState(true); const [moreLoading, setMoreLoading] = useState(false); const [error, setError] = useState(null);
  const load = useCallback(async (page = 1, append = false) => { if (append) setMoreLoading(true); else setLoading(true); setError(null); try { const result = await listQuotations(request, { page, limit: 20, search, status }); setItems(current => append ? [...current, ...result.items] : result.items); setPagination(result.pagination); } catch (e) { setError(e); } finally { setLoading(false); setMoreLoading(false); } }, [request, search, status]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return <Page refreshing={loading} onRefresh={() => load()}><SectionTitle title="Cotizaciones" action={hasPermission(user, 'sales.create') ? <Button title="Nueva" onPress={() => router.push('/sales/quotations/new')} /> : null} />
    <SearchBar value={search} onChangeText={setSearch} onSearch={() => load()} placeholder="Folio o cliente"/><ChoiceChips options={statuses} value={status} onChange={setStatus}/><ErrorPanel error={error} onRetry={() => load()} userMessage={userMessage}/>
    {loading ? <LoadingPanel title="Cargando cotizaciones"/> : items.map(q => <Pressable key={q.id} onPress={() => router.push(`/sales/quotations/${q.id}`)}><Card><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontWeight: '800', fontSize: 16 }}>{q.folio}</Text><Text style={{ color: colors.inkMuted, marginTop: 4 }}>{q.customer?.name || 'Cliente'} · {new Date(q.createdAt).toLocaleDateString('es-MX')}</Text></View><StatusBadge status={q.status}/></View><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.inkMuted }}>{q.items?.length || 0} partidas</Text><MoneyText value={q.total}/></View></Card></Pressable>)}
    {!loading && !error && !items.length ? <EmptyPanel title="Sin cotizaciones" detail="No hay cotizaciones para los filtros seleccionados."/> : null}<LoadMore pagination={pagination} loading={moreLoading} onPress={() => load(Number(pagination.page) + 1, true)}/>
  </Page>;
}
