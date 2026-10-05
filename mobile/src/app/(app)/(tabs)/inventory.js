import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { Button, Card, EmptyPanel, Field, LoadingPanel, Notice, Page, SectionTitle } from '../../../components/UI';
import { ChoiceChips, ErrorPanel, LoadMore, SearchBar, StatusBadge } from '../../../components/OperationalUI';
import RemoteSelect from '../../../components/RemoteSelect';
import { createInventoryMovement, listInventory, listInventoryMovements } from '../../../services/operationalService';
import { userMessage } from '../../../api/client';
import { hasPermission } from '../../../services/permissions';
import config from '../../../constants/config';
import useDelayedFlag from '../../../hooks/useDelayedFlag';
import colors from '../../../theme/colors';

const operations = [
  { id: 'entry', label: 'Entrada', permission: 'inventory.create', endpoint: 'entry' },
  { id: 'exit', label: 'Salida', permission: 'inventory.create', endpoint: 'exit' },
  { id: 'adjust', label: 'Ajuste', permission: 'inventory.adjust', endpoint: 'adjust' },
  // The current API authorizes transfers with inventory.adjust; it has no inventory.transfer permission yet.
  { id: 'transfer', label: 'Transferir', permission: 'inventory.adjust', endpoint: 'transfer' }
];

export default function InventoryScreen() {
  const { request, user } = useAuth();
  const [tab, setTab] = useState('stock');
  const [stock, setStock] = useState([]);
  const [movements, setMovements] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [movementType, setMovementType] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState(null);
  const [operation, setOperation] = useState(null);
  const [form, setForm] = useState({ productId: '', fromWarehouseId: '', toWarehouseId: '', quantity: '', newQuantity: '', reason: '' });
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState('');
  const waking = useDelayedFlag(loading, config.coldStartNoticeMs);

  const load = useCallback(async (page = 1, append = false) => {
    setError(null);
    if (append) setMoreLoading(true); else setLoading(true);
    try {
      const params = { page, limit: 20, search, warehouseId };
      const result = tab === 'stock'
        ? await listInventory(request, { ...params, ...(lowStock ? { lowStock: true } : {}) })
        : await listInventoryMovements(request, { ...params, ...(movementType ? { type: movementType } : {}), from, to });
      if (tab === 'stock') {
        setStock(current => append ? [...current, ...result.items] : result.items);
      } else {
        setMovements(current => append ? [...current, ...result.items] : result.items);
      }
      setPagination(result.pagination);
    } catch (loadError) { setError(loadError); }
    finally { setLoading(false); setMoreLoading(false); }
  }, [from, lowStock, movementType, request, search, tab, to, warehouseId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openOperation(next) {
    setOperation(next); setForm({ productId: '', fromWarehouseId: '', toWarehouseId: '', quantity: '', newQuantity: '', reason: '' });
    setFormError(null); setFormSuccess('');
  }

  async function saveMovement() {
    if (!form.productId || !form.reason.trim()) { setFormError(new Error('Selecciona producto y agrega el motivo.')); return; }
    if (operation.id === 'transfer' && (!form.fromWarehouseId || !form.toWarehouseId)) { setFormError(new Error('Selecciona almacén de origen y destino.')); return; }
    if (operation.id === 'transfer' && form.fromWarehouseId === form.toWarehouseId) { setFormError(new Error('El almacén de origen y destino deben ser distintos.')); return; }
    if (operation.id !== 'transfer' && !form.fromWarehouseId) { setFormError(new Error('Selecciona el almacén.')); return; }
    const quantityValue = Number(form.quantity);
    const adjustedValue = Number(form.newQuantity);
    if (operation.id === 'adjust' ? !Number.isFinite(adjustedValue) || adjustedValue < 0 : !Number.isFinite(quantityValue) || quantityValue <= 0) {
      setFormError(new Error(operation.id === 'adjust' ? 'La existencia nueva debe ser cero o mayor.' : 'La cantidad debe ser mayor que cero.')); return;
    }
    const body = { productId: form.productId, reason: form.reason.trim() };
    if (operation.id === 'transfer') Object.assign(body, { fromWarehouseId: form.fromWarehouseId, toWarehouseId: form.toWarehouseId, quantity: quantityValue });
    else Object.assign(body, { warehouseId: form.fromWarehouseId, ...(operation.id === 'adjust' ? { newQuantity: adjustedValue } : { quantity: quantityValue }) });
    setFormError(null);
    const run = async () => {
      try {
        await createInventoryMovement(request, operation.endpoint, body);
        setOperation(null); setFormSuccess('Movimiento de inventario registrado.');
        await load();
      } catch (saveError) { setFormError(saveError); }
    };
    Alert.alert('Confirmar movimiento', operation.id === 'exit' ? 'Esta salida reducirá las existencias disponibles.' : operation.id === 'adjust' ? 'El ajuste cambiará la existencia del almacén.' : operation.id === 'transfer' ? 'Se registrará salida y entrada entre almacenes.' : 'Se registrará una entrada de existencias.', [
      { text: 'Volver', style: 'cancel' }, { text: 'Continuar', onPress: run }
    ]);
  }

  const actions = operations.filter(item => hasPermission(user, item.permission));
  return <Page refreshing={loading} onRefresh={() => load()} keyboard>
    <SectionTitle title="Inventario" />
    <Text style={{ color: colors.inkMuted }}>Existencias y kardex persistentes por producto y almacén.</Text>
    <ChoiceChips options={[{ label: 'Existencias', value: 'stock' }, { label: 'Movimientos', value: 'movements' }]} value={tab} onChange={value => { setTab(value); setPagination(null); }} />
    <SearchBar value={search} onChangeText={setSearch} onSearch={() => load()} placeholder="Producto o SKU" />
    <RemoteSelect label="Filtrar por almacén" endpoint="/api/inventory/warehouses" value={warehouseId} onChange={setWarehouseId} />
    {warehouseId ? <Button title="Quitar filtro de almacén" variant="secondary" onPress={() => setWarehouseId('')} /> : null}
    {tab === 'movements' ? <><Field label="Desde (AAAA-MM-DD)" value={from} onChangeText={setFrom} placeholder="2026-10-01" autoCapitalize="none" /><Field label="Hasta (AAAA-MM-DD)" value={to} onChangeText={setTo} placeholder="2026-10-31" autoCapitalize="none" /></> : null}
    {tab === 'stock' ? <ChoiceChips options={[{ label: 'Todos', value: false }, { label: 'Stock bajo', value: true }]} value={lowStock} onChange={setLowStock} /> : <ChoiceChips options={[{ label: 'Todos', value: '' }, { label: 'Entrada', value: 'IN' }, { label: 'Salida', value: 'OUT' }, { label: 'Ajuste', value: 'ADJUSTMENT' }, { label: 'Transf. salida', value: 'TRANSFER_OUT' }, { label: 'Transf. entrada', value: 'TRANSFER_IN' }]} value={movementType} onChange={setMovementType} />}
    {tab === 'stock' && actions.length ? <>
      <SectionTitle title="Operaciones" />
      <ChoiceChips options={actions.map(item => ({ label: item.label, value: item.id }))} value={operation?.id || ''} onChange={value => openOperation(operations.find(item => item.id === value))} />
    </> : null}
    {formSuccess ? <Notice>{formSuccess}</Notice> : null}
    {operation ? <Card>
      <SectionTitle title={`${operation.label} de inventario`} />
      <RemoteSelect label="Producto" endpoint="/api/products" value={form.productId} onChange={productId => setForm(current => ({ ...current, productId }))} required />
      {operation.id === 'transfer' ? <>
        <RemoteSelect label="Almacén de origen" endpoint="/api/warehouses" value={form.fromWarehouseId} onChange={fromWarehouseId => setForm(current => ({ ...current, fromWarehouseId }))} required />
        <RemoteSelect label="Almacén de destino" endpoint="/api/warehouses" value={form.toWarehouseId} onChange={toWarehouseId => setForm(current => ({ ...current, toWarehouseId }))} required />
      </> : <RemoteSelect label="Almacén" endpoint="/api/warehouses" value={form.fromWarehouseId} onChange={fromWarehouseId => setForm(current => ({ ...current, fromWarehouseId }))} required />}
      {operation.id === 'adjust' ? <Field label="Nueva existencia" value={form.newQuantity} onChangeText={newQuantity => setForm(current => ({ ...current, newQuantity }))} keyboardType="decimal-pad" /> : <Field label="Cantidad" value={form.quantity} onChangeText={quantity => setForm(current => ({ ...current, quantity }))} keyboardType="decimal-pad" />}
      <Field label="Motivo" value={form.reason} onChangeText={reason => setForm(current => ({ ...current, reason }))} multiline />
      {formError ? <Notice tone="error">{userMessage(formError)}</Notice> : null}
      <Button title="Registrar movimiento" onPress={saveMovement} />
      <Button title="Cerrar formulario" variant="secondary" onPress={() => { setOperation(null); setFormError(null); }} />
    </Card> : null}
    <ErrorPanel error={error} onRetry={() => load()} userMessage={userMessage} />
    {loading ? <LoadingPanel title="Consultando inventario" detail={waking ? 'Render puede tardar unos segundos en despertar.' : 'Consultando existencias y movimientos…'} /> : null}
    {tab === 'stock' ? stock.map(item => <Card key={item.id}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontWeight: '800' }}>{item.product?.name || 'Producto'}</Text><Text style={{ color: colors.inkMuted }}>SKU {item.product?.code || '—'} · {item.warehouse?.name || 'Almacén'}</Text></View><StatusBadge status={item.availableQuantity <= 0 ? 'NO_STOCK' : item.status} /></View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Metric label="Existencia" value={item.quantity} /><Metric label="Reservado" value={item.reservedQuantity} /><Metric label="Disponible" value={item.availableQuantity} /><Metric label="Mínimo" value={item.minimumStock} /></View>
    </Card>) : movements.map(item => <Card key={item.id}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text style={{ color: colors.ink, fontWeight: '800', flex: 1 }}>{item.product?.name || 'Producto'} · {item.product?.code || '—'}</Text><StatusBadge status={item.type} /></View>
      <Text style={{ color: colors.inkMuted }}>{item.warehouse?.name || 'Almacén'} · {item.createdAt ? new Date(item.createdAt).toLocaleString('es-MX') : '—'}</Text>
      <Text style={{ color: colors.ink }}>Cantidad {item.quantity} · Antes {item.previousQuantity} · Después {item.newQuantity}</Text>
      <Text style={{ color: colors.inkMuted }}>Motivo: {item.reason || '—'} · Referencia: {item.referenceType || '—'} {item.referenceId || ''}</Text>
      <Text style={{ color: colors.inkMuted }}>Registró: {item.user?.name || 'Usuario'}</Text>
    </Card>)}
    {!loading && !error && !(tab === 'stock' ? stock : movements).length ? <EmptyPanel title={tab === 'stock' ? 'Sin existencias' : 'Sin movimientos'} detail="No hay registros con los filtros actuales." /> : null}
    <LoadMore pagination={pagination} loading={moreLoading} onPress={() => load(Number(pagination.page) + 1, true)} />
  </Page>;
}

function Metric({ label, value }) {
  return <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.inkMuted, fontSize: 10 }}>{label}</Text><Text style={{ color: colors.ink, fontWeight: '800' }}>{value ?? 0}</Text></View>;
}
