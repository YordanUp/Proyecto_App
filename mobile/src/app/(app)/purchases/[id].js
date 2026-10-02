import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Button, Card, EmptyPanel, Field, LoadingPanel, Notice, Page, SectionTitle } from '../../../components/UI';
import { MoneyText, StatusBadge } from '../../../components/OperationalUI';
import { useAuth } from '../../../context/AuthContext';
import { cancelPurchase, getPurchase, orderPurchase, receivePurchase, updatePurchase } from '../../../services/operationalService';
import { hasPermission } from '../../../services/permissions';
import { userMessage } from '../../../api/client';
import colors from '../../../theme/colors';

export default function PurchaseDetailScreen() {
  const { id } = useLocalSearchParams(); const { request, user } = useAuth();
  const [purchase, setPurchase] = useState(null); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(null); const [success, setSuccess] = useState(''); const [editing, setEditing] = useState(false); const [editItems, setEditItems] = useState([]);
  const load = useCallback(async () => { setLoading(true); setError(null); try { const result = await getPurchase(request, id); setPurchase(result.data); } catch (loadError) { setError(loadError); } finally { setLoading(false); } }, [id, request]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  async function action(fn, message) { setBusy(true); setError(null); setSuccess(''); try { await fn(request, id); setSuccess(message); await load(); } catch (actionError) { setError(actionError); } finally { setBusy(false); } }
  async function saveDraft() {
    if (editItems.some(item => !Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0)) { setError(new Error('Todas las cantidades deben ser mayores a cero.')); return; }
    setBusy(true); setError(null);
    try { const response = await updatePurchase(request, id, { supplierId: purchase.supplierId, items: editItems.map(item => ({ productId: item.productId, warehouseId: item.warehouseId, quantity: Number(item.quantity) })) }); setPurchase(response.data); setEditing(false); setSuccess('Borrador actualizado.'); }
    catch (saveError) { setError(saveError); }
    finally { setBusy(false); }
  }
  function confirm(title, message, fn, successMessage, danger = false) { Alert.alert(title, message, [{ text: 'Volver', style: 'cancel' }, { text: title, style: danger ? 'destructive' : 'default', onPress: () => action(fn, successMessage) }]); }
  if (loading) return <Page><LoadingPanel title="Cargando compra" /></Page>;
  if (!purchase) return <Page>{error ? <Notice tone="error">{userMessage(error)}</Notice> : <EmptyPanel title="Compra no encontrada" detail="El documento no está disponible." />}<Button title="Volver" variant="secondary" onPress={() => router.back()} /></Page>;
  return <Page refreshing={loading} onRefresh={load}>
    <SectionTitle title={purchase.folio} action={<StatusBadge status={purchase.status} />} />
    <Card><Text style={{ color: colors.ink, fontWeight: '800' }}>{purchase.supplier?.name || 'Proveedor'}</Text><Text style={{ color: colors.inkMuted }}>Creada {purchase.createdAt ? new Date(purchase.createdAt).toLocaleString('es-MX') : '—'}</Text>{purchase.receivedAt ? <Text style={{ color: colors.inkMuted }}>Recibida {new Date(purchase.receivedAt).toLocaleString('es-MX')}</Text> : null}</Card>
    <SectionTitle title="Partidas" />{purchase.items?.map((item, index) => <Card key={`${item.productId}-${index}`}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.ink, fontWeight: '800', flex: 1 }}>{item.product?.name || item.productNameSnapshot || 'Producto'}</Text><MoneyText value={item.total} /></View><Text style={{ color: colors.inkMuted }}>SKU {item.product?.code || item.skuSnapshot || '—'} · {item.warehouse?.name || 'Almacén'}</Text>{editing ? <Field label="Cantidad" value={editItems[index]?.quantity} onChangeText={quantity => setEditItems(current => current.map((line, i) => i === index ? { ...line, quantity } : line))} keyboardType="decimal-pad" /> : <Text style={{ color: colors.inkMuted }}>{item.quantity} × ${Number(item.unitCost).toFixed(2)} · Impuesto ${Number(item.tax).toFixed(2)}</Text>}</Card>)}
    <Card><Text style={{ color: colors.inkMuted }}>Subtotal: ${Number(purchase.subtotal || 0).toFixed(2)}</Text><Text style={{ color: colors.inkMuted }}>Impuestos: ${Number(purchase.taxes || 0).toFixed(2)}</Text><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.ink, fontWeight: '800' }}>Total</Text><MoneyText value={purchase.total} /></View></Card>
    {error ? <Notice tone="error">{userMessage(error)}</Notice> : null}{success ? <Notice>{success}</Notice> : null}
    {editing ? <><Button title="Guardar cambios" loading={busy} onPress={saveDraft} /><Button title="Descartar" variant="secondary" disabled={busy} onPress={() => setEditing(false)} /></> : null}
    {!editing && purchase.status === 'draft' && hasPermission(user, 'purchases.update') ? <Button title="Editar cantidades" variant="secondary" disabled={busy} onPress={() => { setEditItems(purchase.items.map(item => ({ productId: item.productId, warehouseId: item.warehouseId, quantity: String(item.quantity) }))); setEditing(true); }} /> : null}
    {!editing && purchase.status === 'draft' && hasPermission(user, 'purchases.approve') ? <Button title={busy ? 'Procesando…' : 'Ordenar compra'} disabled={busy} onPress={() => confirm('Ordenar compra', 'La compra cambiará a estado ordenado y quedará lista para recepción.', orderPurchase, 'Compra ordenada.')} /> : null}
    {!editing && purchase.status === 'ordered' && hasPermission(user, 'purchases.receive') ? <Button title={busy ? 'Procesando…' : 'Recibir compra'} disabled={busy} onPress={() => confirm('Recibir compra', 'Esta acción aumentará las existencias y generará una cuenta por pagar.', receivePurchase, 'Compra recibida.')} /> : null}
    {!editing && ['draft', 'ordered'].includes(purchase.status) && hasPermission(user, 'purchases.cancel') ? <Button title="Cancelar compra" variant="danger" disabled={busy} onPress={() => confirm('Cancelar compra', '¿Cancelar esta compra? Una compra recibida requiere un flujo de reversión.', cancelPurchase, 'Compra cancelada.', true)} /> : null}
    <Button title="Actualizar" variant="secondary" onPress={load} />
  </Page>;
}
