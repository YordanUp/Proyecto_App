import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Button, Card, EmptyPanel, Field, LoadingPanel, Notice, Page, SectionTitle } from '../../../components/UI';
import { ConfirmAction, MoneyText, StatusBadge } from '../../../components/OperationalUI';
import { useAuth } from '../../../context/AuthContext';
import { cancelSale, confirmSale, getSale, updateSale } from '../../../services/operationalService';
import { hasPermission } from '../../../services/permissions';
import { userMessage } from '../../../api/client';
import colors from '../../../theme/colors';

export default function SaleDetailScreen() {
  const { id } = useLocalSearchParams(); const { request, user } = useAuth();
  const [sale, setSale] = useState(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(null); const [success, setSuccess] = useState(''); const [editing, setEditing] = useState(false); const [editItems, setEditItems] = useState([]);
  const load = useCallback(async () => { setLoading(true); setError(null); try { const result = await getSale(request, id); setSale(result.data); } catch (loadError) { setError(loadError); } finally { setLoading(false); } }, [id, request]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  async function action(fn, message) { setBusy(true); setError(null); setSuccess(''); try { await fn(request, id); setSuccess(message); await load(); } catch (actionError) { setError(actionError); } finally { setBusy(false); } }
  async function saveDraft() {
    if (editItems.some(item => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) { setError(new Error('Todas las cantidades deben ser mayores a cero.')); return; }
    setBusy(true); setError(null);
    try { const response = await updateSale(request, id, { customerId: sale.customerId, items: editItems.map(item => ({ productId: item.productId, warehouseId: item.warehouseId, quantity: Number(item.quantity) })) }); setSale(response.data); setEditing(false); setSuccess('Borrador actualizado.'); }
    catch (saveError) { setError(saveError); }
    finally { setBusy(false); }
  }
  if (loading) return <Page><LoadingPanel title="Cargando venta" /></Page>;
  if (!sale) return <Page>{error ? <Notice tone="error">{userMessage(error)}</Notice> : <EmptyPanel title="Venta no encontrada" detail="El documento no está disponible." />}<Button title="Volver" variant="secondary" onPress={() => router.back()} /></Page>;
  return <Page refreshing={loading} onRefresh={load}>
    <SectionTitle title={sale.folio} action={<StatusBadge status={sale.status} />} />
    <Card><Text style={{ color: colors.ink, fontWeight: '800' }}>{sale.customer?.name || 'Cliente'}</Text><Text style={{ color: colors.inkMuted }}>Creada {sale.createdAt ? new Date(sale.createdAt).toLocaleString('es-MX') : '—'}</Text>{sale.confirmedAt ? <Text style={{ color: colors.inkMuted }}>Confirmada {new Date(sale.confirmedAt).toLocaleString('es-MX')}</Text> : null}{sale.cancelledAt ? <Text style={{ color: colors.inkMuted }}>Cancelada {new Date(sale.cancelledAt).toLocaleString('es-MX')}</Text> : null}</Card>
    <SectionTitle title="Partidas" />{sale.items?.map((item, index) => <Card key={`${item.productId}-${index}`}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.ink, fontWeight: '800', flex: 1 }}>{item.product?.name || item.productNameSnapshot || 'Producto'}</Text><MoneyText value={item.total} /></View><Text style={{ color: colors.inkMuted }}>SKU {item.product?.code || item.skuSnapshot || '—'} · {item.warehouse?.name || 'Almacén'}</Text>{editing ? <Field label="Cantidad" value={editItems[index]?.quantity} onChangeText={quantity => setEditItems(current => current.map((line, i) => i === index ? { ...line, quantity } : line))} keyboardType="decimal-pad" /> : <Text style={{ color: colors.inkMuted }}>{item.quantity} × ${Number(item.unitPrice).toFixed(2)} · Impuesto ${Number(item.tax).toFixed(2)}</Text>}</Card>)}
    <Card><Text style={{ color: colors.inkMuted }}>Subtotal: ${Number(sale.subtotal || 0).toFixed(2)}</Text><Text style={{ color: colors.inkMuted }}>Impuestos: ${Number(sale.taxes || 0).toFixed(2)}</Text><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.ink, fontWeight: '800' }}>Total</Text><MoneyText value={sale.total} /></View></Card>
    {error ? <Notice tone="error">{userMessage(error)}</Notice> : null}{success ? <Notice>{success}</Notice> : null}
    {editing ? <><Button title="Guardar cambios" loading={busy} onPress={saveDraft} /><Button title="Descartar" variant="secondary" disabled={busy} onPress={() => setEditing(false)} /></> : null}
    {!editing && sale.status === 'draft' && hasPermission(user, 'sales.update') ? <Button title="Editar cantidades" variant="secondary" disabled={busy} onPress={() => { setEditItems(sale.items.map(item => ({ productId: item.productId, warehouseId: item.warehouseId, quantity: String(item.quantity) }))); setEditing(true); }} /> : null}
    {!editing && sale.status === 'draft' && hasPermission(user, 'sales.create') ? <ConfirmAction title={busy ? 'Procesando…' : 'Confirmar venta'} disabled={busy} confirmLabel="Confirmar y descontar stock" message="Esta acción descontará inventario y generará una cuenta por cobrar." onConfirm={() => action(confirmSale, 'Venta confirmada.')} /> : null}
    {!editing && sale.status === 'draft' && hasPermission(user, 'sales.cancel') ? <ConfirmAction title="Cancelar borrador" variant="danger" disabled={busy} confirmLabel="Cancelar venta" message="¿Cancelar este borrador? No se puede reactivar desde la app." onConfirm={() => action(cancelSale, 'Venta cancelada.')} /> : null}
    {!editing && sale.status === 'confirmed' && hasPermission(user, 'sales.cancel') ? <ConfirmAction title="Cancelar venta" variant="danger" disabled={busy} confirmLabel="Cancelar venta" message="La cancelación intentará revertir inventario. Si ya hay pagos, el backend puede rechazarla." onConfirm={() => action(cancelSale, 'Venta cancelada.')} /> : null}
    <Button title="Actualizar" variant="secondary" onPress={load} />
  </Page>;
}
