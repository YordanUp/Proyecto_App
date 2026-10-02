import React, { useState } from 'react';
import { router } from 'expo-router';
import { Button, Card, Field, Notice, Page, SectionTitle } from '../../../components/UI';
import RemoteSelect from '../../../components/RemoteSelect';
import { MoneyText } from '../../../components/OperationalUI';
import { useAuth } from '../../../context/AuthContext';
import { createSale } from '../../../services/operationalService';
import { hasPermission } from '../../../services/permissions';
import { userMessage } from '../../../api/client';

const blankItem = () => ({ productId: '', warehouseId: '', quantity: '1', product: null });

export default function NewSaleScreen() {
  const { request, user } = useAuth();
  const [customerId, setCustomerId] = useState(''); const [items, setItems] = useState([blankItem()]);
  const [saving, setSaving] = useState(false); const [error, setError] = useState(null);
  if (!hasPermission(user, 'sales.create')) return <Page><Notice tone="warning">Tu cuenta no tiene permiso para crear ventas.</Notice></Page>;
  const estimated = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.product?.salePrice) || 0), 0);
  async function submit() {
    if (!customerId || items.some(item => !item.productId || !item.warehouseId || Number(item.quantity) <= 0)) { setError(new Error('Completa cliente, producto, almacén y cantidades mayores a cero.')); return; }
    setSaving(true); setError(null);
    try {
      const response = await createSale(request, { customerId, items: items.map(({ productId, warehouseId, quantity }) => ({ productId, warehouseId, quantity: Number(quantity) })) });
      router.replace(`/sales/${response.data.id}`);
    } catch (saveError) { setError(saveError); }
    finally { setSaving(false); }
  }
  return <Page keyboard>
    <SectionTitle title="Nuevo borrador de venta" />
    <Notice>El servidor calculará folio, precios, impuestos y total. La venta no afecta inventario hasta confirmarla.</Notice>
    <Card><RemoteSelect label="Cliente" endpoint="/api/clients" value={customerId} onChange={setCustomerId} required /></Card>
    {items.map((item, index) => <Card key={index}><SectionTitle title={`Partida ${index + 1}`} action={items.length > 1 ? <Button title="Quitar" variant="danger" onPress={() => setItems(current => current.filter((_, i) => i !== index))} /> : null} />
      <RemoteSelect label="Producto" endpoint="/api/products" value={item.productId} onChange={(productId, product) => setItems(current => current.map((line, i) => i === index ? { ...line, productId, product } : line))} required />
      <RemoteSelect label="Almacén" endpoint="/api/warehouses" value={item.warehouseId} onChange={warehouseId => setItems(current => current.map((line, i) => i === index ? { ...line, warehouseId } : line))} required />
      <Field label="Cantidad" value={item.quantity} onChangeText={quantity => setItems(current => current.map((line, i) => i === index ? { ...line, quantity } : line))} keyboardType="decimal-pad" />
      {item.product ? <Notice>Precio de lista {Number(item.product.salePrice || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}; el backend determina el total final.</Notice> : null}
    </Card>)}
    <Button title="Agregar partida" variant="secondary" onPress={() => setItems(current => [...current, blankItem()])} disabled={items.length >= 20} />
    <Card><SectionTitle title="Estimado visual (sin impuestos)" /><MoneyText value={estimated} style={{ fontSize: 22 }} /></Card>
    {error ? <Notice tone="error">{userMessage(error)}</Notice> : null}
    <Button title="Crear borrador" loading={saving} onPress={submit} />
    <Button title="Cancelar" variant="secondary" onPress={() => router.back()} />
  </Page>;
}
