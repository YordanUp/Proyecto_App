import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { userMessage } from '../../../api/client';
import { BrandHeader, Button, Card, EmptyPanel, LoadingPanel, Notice, Page, Pill, SectionTitle } from '../../../components/UI';
import useDelayedFlag from '../../../hooks/useDelayedFlag';
import config from '../../../constants/config';
import colors from '../../../theme/colors';

export default function InventoryScreen() {
  const { request } = useAuth();
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const waking = useDelayedFlag(loading, config.coldStartNoticeMs);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [stockResponse, movementResponse] = await Promise.all([request('/api/inventory'), request('/api/inventory/movements')]);
      setItems(Array.isArray(stockResponse.data) ? stockResponse.data : []);
      setMovements(Array.isArray(movementResponse.data) ? movementResponse.data : []);
    } catch (loadError) { setError(loadError); }
    finally { setLoading(false); }
  }, [request]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return <Page refreshing={loading} onRefresh={load}>
    <BrandHeader title="Inventario" subtitle="Existencias y movimientos del módulo operativo." />
    <Notice tone="warning">Datos de demostración: el backend mantiene estas existencias en memoria, no en MongoDB. Los cambios pueden perderse al reiniciarse el servicio.</Notice>
    {error ? <Notice tone="error">{userMessage(error)}</Notice> : null}
    <SectionTitle title="Existencias" action={<Pill tone="demo">Demo</Pill>} />
    {loading ? <LoadingPanel title="Cargando inventario" detail={waking ? 'El backend puede tardar en despertar.' : 'Consultando existencias…'} /> : items.map((item, index) => <Card key={item.id || `${item.productId}-${index}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Text style={{ color: colors.ink, fontWeight: '800', flex: 1 }}>Producto {item.productId}</Text><Pill tone={Number(item.stock) <= Number(item.minStock) ? 'demo' : 'success'}>{item.status || 'activo'}</Pill></View>
      <View style={{ flexDirection: 'row', gap: 10 }}><SmallMetric label="Disponible" value={item.stock} /><SmallMetric label="Mínimo" value={item.minStock} /><SmallMetric label="Almacén" value={item.warehouseId} /></View>
    </Card>)}
    {!loading && !items.length ? <EmptyPanel title="Sin existencias" detail="La API no devolvió registros." /> : null}
    <SectionTitle title="Movimientos recientes" />
    {loading ? null : movements.slice(0, 6).map((movement, index) => <Card key={movement.id || index} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View style={{ gap: 3 }}><Text style={{ color: colors.ink, fontWeight: '700' }}>{movement.type === 'entry' ? 'Entrada' : 'Salida'} · Producto {movement.productId}</Text><Text style={{ color: colors.inkMuted, fontSize: 12 }}>{movement.reason || 'Sin motivo'}</Text></View>
      <Text style={{ color: colors.brand, fontWeight: '800' }}>{movement.quantity}</Text>
    </Card>)}
    {!loading && !movements.length ? <EmptyPanel title="Sin movimientos" detail="Todavía no hay movimientos disponibles." /> : null}
    {!loading && error ? <Button title="Reintentar" onPress={load} variant="secondary" /> : null}
  </Page>;
}

function SmallMetric({ label, value }) {
  return <View style={{ flex: 1, backgroundColor: colors.canvas, borderRadius: 10, padding: 10, gap: 4 }}><Text style={{ color: colors.inkMuted, fontSize: 10, fontWeight: '700' }}>{label}</Text><Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: '800' }}>{value ?? '—'}</Text></View>;
}
