import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { Button, Card, EmptyPanel, LoadingPanel, Page, SectionTitle } from '../../../../components/UI';
import { MoneyText } from '../../../../components/OperationalUI';
import { getSalesReturn } from '../../../../services/operationalService';
import { userMessage } from '../../../../api/client';
import colors from '../../../../theme/colors';

export default function SalesReturnDetailScreen() {
  const { id } = useLocalSearchParams(); const { request } = useAuth(); const [item, setItem] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setItem((await getSalesReturn(request, id)).data); } catch (e) { setError(e); } finally { setLoading(false); } }, [id, request]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (loading) return <Page><LoadingPanel title="Cargando devolución" /></Page>;
  if (!item) return <Page>{error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{userMessage(error)}</Text> : <EmptyPanel title="Devolución no encontrada" detail="El documento no está disponible." />}<Button title="Volver" variant="secondary" onPress={() => router.back()} /></Page>;
  return <Page refreshing={loading} onRefresh={load}>
    <SectionTitle title={item.folio} />
    <Card><Text style={{ color: colors.ink, fontWeight: '800' }}>Venta {item.sale?.folio || item.saleId}</Text><Text style={{ color: colors.inkMuted }}>Cliente: {item.customer?.name || item.customerId}</Text><Text style={{ color: colors.inkMuted }}>Motivo: {item.reason}</Text><Text style={{ color: colors.inkMuted }}>Procesada: {item.processedAt ? new Date(item.processedAt).toLocaleString('es-MX') : '—'}</Text><Text style={{ color: colors.inkMuted }}>Usuario: {item.createdBy?.name || item.createdBy}</Text>{item.notes ? <Text style={{ color: colors.inkMuted }}>Notas: {item.notes}</Text> : null}</Card>
    <SectionTitle title="Partidas" />{item.items.map((line, index) => <Card key={`${line.saleLineIndex}-${index}`}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text style={{ color: colors.ink, fontWeight: '800', flex: 1 }}>{line.productNameSnapshot}</Text><MoneyText value={line.total} /></View><Text style={{ color: colors.inkMuted }}>{line.warehouse?.name || 'Almacén'} · {line.quantity} × ${Number(line.unitPrice).toFixed(2)}</Text><Text style={{ color: colors.inkMuted }}>Subtotal ${Number(line.subtotal).toFixed(2)} · Impuesto ${Number(line.tax).toFixed(2)}</Text></Card>)}
    <Card><Text style={{ color: colors.inkMuted }}>Subtotal: ${Number(item.subtotal).toFixed(2)}</Text><Text style={{ color: colors.inkMuted }}>Impuestos: ${Number(item.taxes).toFixed(2)}</Text><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.ink, fontWeight: '800' }}>Total</Text><MoneyText value={item.total} /></View></Card>
    <Button title="Volver" variant="secondary" onPress={() => router.back()} />
  </Page>;
}
