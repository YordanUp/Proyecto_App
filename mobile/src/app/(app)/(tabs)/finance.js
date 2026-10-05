import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { Button, Card, EmptyPanel, Field, LoadingPanel, Notice, Page, SectionTitle } from '../../../components/UI';
import { ChoiceChips, ErrorPanel, LoadMore, MoneyText, SearchBar, StatusBadge } from '../../../components/OperationalUI';
import { listFinancialMovements, listPayables, listReceivables, registerPayment } from '../../../services/operationalService';
import { hasPermission } from '../../../services/permissions';
import { userMessage } from '../../../api/client';
import config from '../../../constants/config';
import useDelayedFlag from '../../../hooks/useDelayedFlag';
import colors from '../../../theme/colors';

const kindOptions = [{ value: 'receivables', label: 'Por cobrar' }, { value: 'payables', label: 'Por pagar' }, { value: 'movements', label: 'Movimientos' }];
const statuses = [{ value: '', label: 'Todos' }, { value: 'pending', label: 'Pendiente' }, { value: 'partial', label: 'Parcial' }, { value: 'paid', label: 'Pagada' }, { value: 'cancelled', label: 'Cancelada' }];
const methods = [{ value: 'cash', label: 'Efectivo' }, { value: 'transfer', label: 'Transferencia' }, { value: 'card', label: 'Tarjeta' }, { value: 'check', label: 'Cheque' }, { value: 'other', label: 'Otro' }];

export default function FinanceScreen() {
  const { request, user } = useAuth();
  const [kind, setKind] = useState('receivables'); const [items, setItems] = useState([]); const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [loading, setLoading] = useState(true); const [moreLoading, setMoreLoading] = useState(false); const [error, setError] = useState(null);
  const [paying, setPaying] = useState(null); const [amount, setAmount] = useState(''); const [paymentMethod, setPaymentMethod] = useState('transfer'); const [description, setDescription] = useState(''); const [saving, setSaving] = useState(false); const [paymentError, setPaymentError] = useState(null); const [success, setSuccess] = useState('');
  const waking = useDelayedFlag(loading, config.coldStartNoticeMs);

  const load = useCallback(async (page = 1, append = false) => {
    if (append) setMoreLoading(true); else setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20, search, ...(kind === 'movements' ? { direction: status } : { status }) };
      const result = kind === 'receivables' ? await listReceivables(request, params) : kind === 'payables' ? await listPayables(request, params) : await listFinancialMovements(request, params);
      setItems(current => append ? [...current, ...result.items] : result.items); setPagination(result.pagination);
    } catch (loadError) { setError(loadError); }
    finally { setLoading(false); setMoreLoading(false); }
  }, [kind, request, search, status]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function startPayment(account) { setPaying(account); setAmount(''); setPaymentMethod('transfer'); setDescription(''); setPaymentError(null); setSuccess(''); }
  function submitPayment() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-7) { setPaymentError(new Error('Ingresa un importe mayor a cero con máximo dos decimales.')); return; }
    if (value > Number(paying.balance)) { setPaymentError(new Error('El importe supera el saldo pendiente.')); return; }
    Alert.alert(kind === 'receivables' ? 'Registrar cobro' : 'Registrar pago', `Se registrará ${value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} en ${paying.folio}.`, [
      { text: 'Volver', style: 'cancel' },
      { text: 'Confirmar', onPress: async () => {
        setSaving(true); setPaymentError(null);
        try { await registerPayment(request, kind, paying.id, { amount: value, paymentMethod, description }); setPaying(null); setSuccess(kind === 'receivables' ? 'Cobro registrado.' : 'Pago registrado.'); await load(); }
        catch (saveError) { setPaymentError(saveError); }
        finally { setSaving(false); }
      } }
    ]);
  }

  const canPay = kind === 'receivables' ? hasPermission(user, 'finance.receive_payment') : hasPermission(user, 'finance.make_payment');
  return <Page refreshing={loading} onRefresh={() => load()} keyboard>
    <SectionTitle title="Finanzas" />
    <Text style={{ color: colors.inkMuted }}>Cuentas por cobrar, por pagar y libro de movimientos persistente.</Text>
    <ChoiceChips options={kindOptions} value={kind} onChange={value => { setKind(value); setPaying(null); setPagination(null); }} />
    <SearchBar value={search} onChangeText={setSearch} onSearch={() => load()} placeholder="Folio, cliente o proveedor" />
    {kind !== 'movements' ? <ChoiceChips options={statuses} value={status} onChange={setStatus} /> : <ChoiceChips options={[{ value: '', label: 'Todos' }, { value: 'IN', label: 'Entradas' }, { value: 'OUT', label: 'Salidas' }]} value={status} onChange={setStatus} />}
    {success ? <Notice>{success}</Notice> : null}<ErrorPanel error={error} onRetry={() => load()} userMessage={userMessage} />
    {paying ? <Card>
      <SectionTitle title={kind === 'receivables' ? `Registrar cobro · ${paying.folio}` : `Registrar pago · ${paying.folio}`} />
      <Text style={{ color: colors.inkMuted }}>Saldo actual</Text><MoneyText value={paying.balance} style={{ fontSize: 20 }} />
      <Field label="Importe" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <SectionTitle title="Método de pago" /><ChoiceChips options={methods} value={paymentMethod} onChange={setPaymentMethod} />
      <Field label="Descripción" value={description} onChangeText={setDescription} placeholder={kind === 'receivables' ? 'Cobro de cliente' : 'Pago a proveedor'} />
      {Number(amount) > 0 ? <Notice>Saldo estimado restante: {(Number(paying.balance) - Number(amount)).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}. El backend valida el saldo definitivo.</Notice> : null}
      {paymentError ? <Notice tone="error">{userMessage(paymentError)}</Notice> : null}
      <Button title="Confirmar operación" loading={saving} onPress={submitPayment} /><Button title="Cerrar formulario" variant="secondary" onPress={() => setPaying(null)} />
    </Card> : null}
    {loading ? <LoadingPanel title="Consultando finanzas" detail={waking ? 'El servidor de Render puede tardar unos segundos en iniciar.' : 'Consultando cuentas y movimientos…'} /> : items.map(item => kind === 'movements' ? <Card key={item.id}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontWeight: '800' }}>{item.description || item.type}</Text><Text style={{ color: colors.inkMuted }}>{item.createdAt ? new Date(item.createdAt).toLocaleString('es-MX') : '—'}</Text></View><StatusBadge status={item.direction} /></View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.inkMuted }}>{item.referenceFolio || item.referenceType} · {item.createdBy?.name || 'Usuario'}</Text><MoneyText value={item.amount} /></View>
      <Text style={{ color: colors.inkMuted }}>Método: {methods.find(option => option.value === item.paymentMethod)?.label || item.paymentMethod || '—'}</Text>
    </Card> : <Card key={item.id}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontWeight: '800', fontSize: 15 }}>{item.folio}</Text><Text style={{ color: colors.inkMuted }}>{kind === 'receivables' ? item.customer?.name : item.supplier?.name}</Text></View><StatusBadge status={item.status} /></View>
      <Text style={{ color: colors.inkMuted }}>{kind === 'receivables' ? 'Venta' : 'Compra'} {kind === 'receivables' ? item.sale?.folio : item.purchase?.folio} · {item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-MX') : '—'}</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Amount label="Original" value={item.originalAmount} /><Amount label="Pagado" value={item.paidAmount} /><Amount label="Saldo" value={item.balance} /></View>
      {canPay && ['pending', 'partial'].includes(item.status) ? <Button title={kind === 'receivables' ? 'Registrar cobro' : 'Registrar pago'} onPress={() => startPayment(item)} /> : null}
    </Card>)}
    {!loading && !error && !items.length ? <EmptyPanel title="Sin movimientos" detail="No se encontraron cuentas o movimientos con estos filtros." /> : null}
    <LoadMore pagination={pagination} loading={moreLoading} onPress={() => load(Number(pagination.page) + 1, true)} />
  </Page>;
}

function Amount({ label, value }) { return <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.inkMuted, fontSize: 11 }}>{label}</Text><MoneyText value={value} style={{ fontSize: 13 }} /></View>; }
