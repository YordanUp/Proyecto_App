import React, { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { Button, Card, Field, LoadingPanel, Notice, Page, SectionTitle } from '../../../../components/UI';
import { getSale, listSalesReturns, createSalesReturn } from '../../../../services/operationalService';
import { hasPermission } from '../../../../services/permissions';
import { userMessage } from '../../../../api/client';
import colors from '../../../../theme/colors';

export default function NewSalesReturnScreen() {
  const { saleId = '' } = useLocalSearchParams(); const { request, user } = useAuth();
  const [sale, setSale] = useState(null); const [returnedByLine, setReturnedByLine] = useState({}); const [quantities, setQuantities] = useState({});
  const [reason, setReason] = useState(''); const [notes, setNotes] = useState(''); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(null);
  const load = useCallback(async () => {
    if (!saleId) { setLoading(false); setError(new Error('Abre la devolución desde una venta confirmada.')); return; }
    setLoading(true); setError(null);
    try {
      const [saleResult, returnsResult] = await Promise.all([getSale(request, saleId), listSalesReturns(request, { saleId, page: 1, limit: 100 })]);
      if (saleResult.data.status !== 'confirmed') throw new Error('Solo se pueden devolver ventas confirmadas.');
      const totals = {};
      returnsResult.items.forEach(doc => doc.items.forEach(line => { totals[line.saleLineIndex] = (totals[line.saleLineIndex] || 0) + Number(line.quantity); }));
      setSale(saleResult.data); setReturnedByLine(totals); setQuantities({});
    } catch (e) { setError(e); } finally { setLoading(false); }
  }, [request, saleId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const estimated = useMemo(() => (sale?.items || []).reduce((total, line, index) => { const qty = Number(quantities[index] || 0); const subtotal = qty * line.unitPrice; return total + subtotal + subtotal * line.taxRate / 100; }, 0), [sale, quantities]);
  async function submit() {
    if (!hasPermission(user, 'sales.returns.create')) { setError(new Error('No tienes permiso para crear devoluciones.')); return; }
    const items = (sale?.items || []).map((line, saleLineIndex) => ({ productId: line.productId, warehouseId: line.warehouseId, saleLineIndex, quantity: Number(quantities[saleLineIndex] || 0) })).filter(line => line.quantity > 0);
    if (!items.length || !reason.trim()) { setError(new Error('Captura al menos una cantidad y el motivo.')); return; }
    setSaving(true); setError(null);
    try { const result = await createSalesReturn(request, { saleId, reason, notes, items }); Alert.alert('Devolución procesada', result.data.folio); router.replace('/sales/returns'); }
    catch (e) { setError(e); } finally { setSaving(false); }
  }
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Page keyboard refreshing={loading} onRefresh={load}>
      <SectionTitle title="Crear devolución" />
      {loading ? <LoadingPanel title="Consultando venta" /> : null}
      {error ? <Notice tone="error">{userMessage(error)}</Notice> : null}
      {sale ? <><Card><Text style={{ color: colors.ink, fontWeight: '800' }}>{sale.folio} · {sale.customer?.name || 'Cliente'}</Text><Text style={{ color: colors.inkMuted }}>Venta confirmada · total original ${Number(sale.total).toFixed(2)}</Text></Card>
        <SectionTitle title="Partidas disponibles" />{sale.items.map((line, index) => { const returned = Number(returnedByLine[index] || 0); const available = Math.max(0, Number(line.quantity) - returned); return <Card key={index}><Text style={{ color: colors.ink, fontWeight: '800' }}>{line.productNameSnapshot}</Text><Text style={{ color: colors.inkMuted }}>{line.warehouse?.name || 'Almacén'} · vendida {line.quantity} · devuelta {returned} · disponible {available}</Text><Field label={`Cantidad a devolver · línea ${index + 1}`} value={quantities[index] || ''} onChangeText={value => setQuantities(current => ({ ...current, [index]: value }))} keyboardType="decimal-pad" editable={available > 0} placeholder={`Máximo ${available}`} /></Card>; })}
        <Field label="Motivo" value={reason} onChangeText={setReason} />
        <Field label="Notas" value={notes} onChangeText={setNotes} multiline />
        <Card><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.ink, fontWeight: '800' }}>Total estimado</Text><Text style={{ color: colors.ink, fontWeight: '800' }}>${estimated.toFixed(2)}</Text></View><Text style={{ color: colors.inkMuted }}>El backend calcula el total final con los precios e impuestos originales.</Text></Card>
        {hasPermission(user, 'sales.returns.create') ? <Button title="Procesar devolución" loading={saving} onPress={() => Alert.alert('Procesar devolución', 'Se repondrá inventario y se ajustará la cuenta por cobrar.', [{ text: 'Volver', style: 'cancel' }, { text: 'Procesar', onPress: submit }])} /> : null}
      </> : null}
      <Button title="Cancelar" variant="secondary" disabled={saving} onPress={() => router.back()} />
    </Page>
  </KeyboardAvoidingView>;
}
