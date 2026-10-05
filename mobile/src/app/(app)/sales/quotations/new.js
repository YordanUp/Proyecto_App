import React, { useState } from 'react';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { Button, Card, Field, Notice, Page, SectionTitle } from '../../../../components/UI';
import RemoteSelect from '../../../../components/RemoteSelect';
import { useAuth } from '../../../../context/AuthContext';
import { createQuotation } from '../../../../services/operationalService';
import { hasPermission } from '../../../../services/permissions';
import { userMessage } from '../../../../api/client';

const blank = () => ({ productId: '', warehouseId: '', quantity: '1', unitPrice: '', taxRate: '0', product: null });
export default function NewQuotationScreen() {
  const { request, user } = useAuth(); const [customerId, setCustomerId] = useState(''); const [items, setItems] = useState([blank()]); const [saving, setSaving] = useState(false); const [error, setError] = useState(null);
  if (!hasPermission(user, 'sales.create')) return <Page><Notice tone="warning">Tu cuenta no tiene permiso para crear cotizaciones.</Notice></Page>;
  async function submit() { if (!customerId || items.some(i => !i.productId || !i.warehouseId || Number(i.quantity) <= 0)) { setError(new Error('Completa cliente, productos, almacenes y cantidades mayores a cero.')); return; } setSaving(true); setError(null); try { const result = await createQuotation(request, { customerId, items: items.map(i => ({ productId: i.productId, warehouseId: i.warehouseId, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice || i.product?.salePrice), taxRate: Number(i.taxRate || 0) })) }); Alert.alert('Cotización creada', result.data.folio); router.replace(`/sales/quotations/${result.data.id}`); } catch (e) { setError(e); } finally { setSaving(false); } }
  return <Page keyboard><SectionTitle title="Nueva cotización"/><Notice>El servidor recalcula importes. La cotización no afecta inventario ni cuentas por cobrar.</Notice><Card><RemoteSelect label="Cliente" endpoint="/api/clients" value={customerId} onChange={setCustomerId} required/></Card>
    {items.map((item, index) => <Card key={index}><SectionTitle title={`Partida ${index + 1}`} action={items.length > 1 ? <Button title="Quitar" variant="danger" onPress={() => setItems(xs => xs.filter((_, n) => n !== index))}/> : null}/><RemoteSelect label="Producto" endpoint="/api/products" value={item.productId} onChange={(productId, product) => setItems(xs => xs.map((v, n) => n === index ? { ...v, productId, product, unitPrice: String(product?.salePrice || '') } : v))} required/><RemoteSelect label="Almacén" endpoint="/api/warehouses" value={item.warehouseId} onChange={warehouseId => setItems(xs => xs.map((v, n) => n === index ? { ...v, warehouseId } : v))} required/><Field label="Cantidad" value={item.quantity} keyboardType="decimal-pad" onChangeText={quantity => setItems(xs => xs.map((v, n) => n === index ? { ...v, quantity } : v))}/><Field label="Precio unitario" value={item.unitPrice} keyboardType="decimal-pad" onChangeText={unitPrice => setItems(xs => xs.map((v, n) => n === index ? { ...v, unitPrice } : v))}/><Field label="Impuesto %" value={item.taxRate} keyboardType="decimal-pad" onChangeText={taxRate => setItems(xs => xs.map((v, n) => n === index ? { ...v, taxRate } : v))}/></Card>)}
    {error ? <Notice tone="error">{userMessage(error)}</Notice> : null}<Button title="Agregar partida" variant="secondary" onPress={() => setItems(xs => [...xs, blank()])} disabled={items.length >= 20}/><Button title="Crear cotización" loading={saving} onPress={submit}/><Button title="Cancelar" variant="secondary" onPress={() => router.back()}/>
  </Page>;
}
