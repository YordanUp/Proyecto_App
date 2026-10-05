import React, { useState } from 'react';
import { router } from 'expo-router';
import { Button, Card, Field, Notice, Page, SectionTitle } from '../../../components/UI';
import RemoteSelect from '../../../components/RemoteSelect';
import { MoneyText } from '../../../components/OperationalUI';
import { useAuth } from '../../../context/AuthContext';
import { createPurchase } from '../../../services/operationalService';
import { hasPermission } from '../../../services/permissions';
import { userMessage } from '../../../api/client';

const blankItem = () => ({ productId: '', warehouseId: '', quantity: '1', product: null });

export default function NewPurchaseScreen() {
  const { request, user } = useAuth();
  const [supplierId, setSupplierId] = useState(''); const [items, setItems] = useState([blankItem()]); const [saving, setSaving] = useState(false); const [error, setError] = useState(null);
  if (!hasPermission(user, 'purchases.create')) return <Page><Notice tone="warning">Tu cuenta no tiene permiso para crear compras.</Notice></Page>;
  const estimated = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.product?.purchasePrice) || 0), 0);
  async function submit() {
    if (!supplierId || items.some(item => !item.productId || !item.warehouseId || Number(item.quantity) <= 0)) { setError(new Error('Completa proveedor, producto, almacén y cantidades mayores a cero.')); return; }
    setSaving(true); setError(null);
    try { const response = await createPurchase(request, { supplierId, items: items.map(({ productId, warehouseId, quantity }) => ({ productId, warehouseId, quantity: Number(quantity) })) }); router.replace(`/purchases/${response.data.id}`); }
    catch (saveError) { setError(saveError); }
    finally { setSaving(false); }
  }
  return <Page keyboard>
    <SectionTitle title="Nueva compra" /><Notice>Se creará como borrador. Ordenar y recibir son acciones separadas; el backend calcula importes y controla las existencias.</Notice>
    <Card><RemoteSelect label="Proveedor" endpoint="/api/suppliers" value={supplierId} onChange={setSupplierId} required /></Card>
    {items.map((item, index) => <Card key={index}><SectionTitle title={`Partida ${index + 1}`} action={items.length > 1 ? <Button title="Quitar" variant="danger" onPress={() => setItems(current => current.filter((_, i) => i !== index))} /> : null} />
      <RemoteSelect label="Producto" endpoint="/api/products" value={item.productId} onChange={(productId, product) => setItems(current => current.map((line, i) => i === index ? { ...line, productId, product } : line))} required />
      <RemoteSelect label="Almacén de recepción" endpoint="/api/warehouses" value={item.warehouseId} onChange={warehouseId => setItems(current => current.map((line, i) => i === index ? { ...line, warehouseId } : line))} required />
      <Field label="Cantidad" value={item.quantity} onChangeText={quantity => setItems(current => current.map((line, i) => i === index ? { ...line, quantity } : line))} keyboardType="decimal-pad" />
      {item.product ? <Notice>Costo de catálogo {Number(item.product.purchasePrice || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}; el servidor valida y calcula la compra.</Notice> : null}
    </Card>)}
    <Button title="Agregar partida" variant="secondary" disabled={items.length >= 20} onPress={() => setItems(current => [...current, blankItem()])} />
    <Card><SectionTitle title="Estimado de costo" /><MoneyText value={estimated} style={{ fontSize: 22 }} /></Card>
    {error ? <Notice tone="error">{userMessage(error)}</Notice> : null}<Button title="Crear borrador" loading={saving} onPress={submit} /><Button title="Cancelar" variant="secondary" onPress={() => router.back()} />
  </Page>;
}
