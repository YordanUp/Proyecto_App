import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { Button, Card, EmptyPanel, Field, Notice, Page, SectionTitle } from '../../../components/UI';
import { ChoiceChips, ConfirmAction, ErrorPanel, SearchBar } from '../../../components/OperationalUI';
import { createIntegration, disableIntegration, enableIntegration, getIntegration, listIntegrations, updateIntegration } from '../../../services/operationalService';
import { hasPermission } from '../../../services/permissions';
import { userMessage } from '../../../api/client';
import colors from '../../../theme/colors';

const TYPES = ['payments', 'messaging', 'crm', 'accounting', 'storage', 'other'];
const TYPE_OPTIONS = [{ value: '', label: 'Todos' }, ...TYPES.map(value => ({ value, label: value }))];
const STATUS_LABEL = { pending: 'Pendiente', connected: 'Conectada', disconnected: 'Desconectada', error: 'Error' };
const BLANK = { name: '', slug: '', type: 'other', description: '', owner: '', configKey: '', configValue: '' };

export default function IntegrationsScreen() {
  const { request, user } = useAuth();
  const canCreate = hasPermission(user, 'integrations.create'); const canUpdate = hasPermission(user, 'integrations.update');
  const [items, setItems] = useState([]); const [screen, setScreen] = useState('list'); const [selected, setSelected] = useState(null); const [form, setForm] = useState(BLANK);
  const [search, setSearch] = useState(''); const [appliedSearch, setAppliedSearch] = useState(''); const [type, setType] = useState('');
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(null); const [success, setSuccess] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const result = await listIntegrations(request, { search: appliedSearch, type, page: 1, limit: 50 }); setItems(result.items); }
    catch (loadError) { setError(loadError); } finally { setLoading(false); }
  }, [request, appliedSearch, type]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function startCreate() { setSelected(null); setForm(BLANK); setError(null); setSuccess(''); setScreen('form'); }
  function startEdit() {
    setForm({ name: selected.name, slug: selected.slug, type: selected.type, description: selected.description || '', owner: selected.owner || '', configKey: Object.keys(selected.config || {})[0] || '', configValue: Object.values(selected.config || {})[0] == null ? '' : String(Object.values(selected.config || {})[0]) });
    setError(null); setSuccess(''); setScreen('form');
  }
  async function openDetail(item) {
    setBusy(true); setError(null);
    try { const result = await getIntegration(request, item.id); setSelected(result.data); setScreen('detail'); }
    catch (detailError) { setError(detailError); } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setError(null); setSuccess('');
    const config = form.configKey.trim() ? { [form.configKey.trim()]: form.configValue } : {};
    const body = { name: form.name.trim(), type: form.type, description: form.description.trim(), owner: form.owner.trim(), config };
    if (!selected) body.slug = form.slug.trim() || form.name.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    try {
      const result = selected ? await updateIntegration(request, selected.id, body) : await createIntegration(request, body);
      setSelected(result.data); setScreen('detail'); setSuccess(selected ? 'Integración actualizada.' : 'Integración creada como pendiente y deshabilitada.'); await load();
    } catch (saveError) { setError(saveError); } finally { setBusy(false); }
  }
  async function toggle(enabled) {
    setBusy(true); setError(null); setSuccess('');
    try { const result = enabled ? await enableIntegration(request, selected.id) : await disableIntegration(request, selected.id); setSelected(result.data); setSuccess(enabled ? 'Integración habilitada.' : 'Integración deshabilitada.'); await load(); }
    catch (actionError) { setError(actionError); } finally { setBusy(false); }
  }
  function backToList() { setScreen('list'); setSelected(null); setError(null); }

  if (!hasPermission(user, 'integrations.read')) return <Page><Notice tone="warning">Tu cuenta no tiene permiso para consultar integraciones.</Notice></Page>;
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><Page keyboard refreshing={loading} onRefresh={load}>
    <SectionTitle title={screen === 'list' ? 'Integraciones' : screen === 'detail' ? selected?.name || 'Integración' : selected ? 'Editar integración' : 'Nueva integración'} action={screen === 'list' && canCreate ? <Button title="Nueva" onPress={startCreate} /> : null} />
    <Text style={{ color: colors.inkMuted, lineHeight: 20 }}>Registro persistente de integraciones. No se conecta a proveedores externos ni sincroniza datos.</Text>
    {success ? <Notice tone="success">{success}</Notice> : null}
    <ErrorPanel error={error} onRetry={screen === 'list' ? load : undefined} userMessage={userMessage} />
    {screen === 'list' ? <>
      <SearchBar value={search} onChangeText={setSearch} onSearch={() => setAppliedSearch(search.trim())} placeholder="Nombre, slug o responsable" />
      <ChoiceChips options={TYPE_OPTIONS} value={type} onChange={setType} />
      {loading ? <Text style={{ color: colors.inkMuted }}>Cargando integraciones…</Text> : items.length ? items.map(item => <Card key={item.id}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}><View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.ink, fontSize: 16, fontWeight: '800' }}>{item.name}</Text><Text style={{ color: colors.inkMuted }}>{item.slug} · {item.type}</Text></View><Text style={{ color: item.enabled ? colors.success : colors.inkMuted, fontWeight: '700' }}>{item.enabled ? 'Habilitada' : 'Deshabilitada'}</Text></View>
        <Text style={{ color: colors.inkMuted }}>Estado: {STATUS_LABEL[item.status] || item.status} · Responsable: {item.owner || 'Sin asignar'}</Text>
        <Button title="Ver detalle" variant="secondary" onPress={() => openDetail(item)} disabled={busy} />
      </Card>) : <EmptyPanel title="No hay integraciones configuradas." detail={canCreate ? 'Agrega la primera integración para registrar su configuración.' : 'No hay registros para mostrar.'} />}
      {!items.length && !loading && canCreate ? <Button title="Agregar integración" onPress={startCreate} /> : null}
    </> : null}
    {screen === 'detail' && selected ? <>
      <Card><Text style={{ color: colors.inkMuted }}>Slug</Text><Text selectable style={{ color: colors.ink, fontWeight: '700' }}>{selected.slug}</Text><Text style={{ color: colors.inkMuted }}>Tipo</Text><Text style={{ color: colors.ink }}>{selected.type}</Text><Text style={{ color: colors.inkMuted }}>Estado</Text><Text style={{ color: colors.ink }}>{STATUS_LABEL[selected.status] || selected.status}</Text><Text style={{ color: colors.inkMuted }}>Habilitada</Text><Text style={{ color: colors.ink }}>{selected.enabled ? 'Sí' : 'No'}</Text><Text style={{ color: colors.inkMuted }}>Responsable</Text><Text style={{ color: colors.ink }}>{selected.owner || 'Sin asignar'}</Text><Text style={{ color: colors.inkMuted }}>Descripción</Text><Text style={{ color: colors.ink }}>{selected.description || '—'}</Text><Text style={{ color: colors.inkMuted }}>Última sincronización</Text><Text style={{ color: colors.ink }}>{selected.lastSyncAt ? new Date(selected.lastSyncAt).toLocaleString() : 'Sin sincronizaciones'}</Text><Text style={{ color: colors.inkMuted }}>Último error</Text><Text selectable style={{ color: colors.ink }}>{selected.lastError || '—'}</Text><Text style={{ color: colors.inkMuted }}>Creada</Text><Text style={{ color: colors.ink }}>{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '—'}</Text><Text style={{ color: colors.inkMuted }}>Actualizada</Text><Text style={{ color: colors.ink }}>{selected.updatedAt ? new Date(selected.updatedAt).toLocaleString() : '—'}</Text><Text style={{ color: colors.inkMuted }}>Configuración pública</Text><Text selectable style={{ color: colors.ink, fontFamily: 'monospace' }}>{JSON.stringify(selected.config || {}, null, 2)}</Text></Card>
      {canUpdate ? <><Button title="Editar" variant="secondary" onPress={startEdit} disabled={busy} />{selected.enabled ? <ConfirmAction title="Desactivar" variant="danger" message="¿Deshabilitar esta integración? Se conservará el registro y su configuración." confirmLabel="Desactivar" disabled={busy} onConfirm={() => toggle(false)} /> : <Button title="Activar" onPress={() => toggle(true)} disabled={busy} />}</> : <Notice>Acceso de solo lectura.</Notice>}
      <Button title="Volver" variant="secondary" onPress={backToList} />
    </> : null}
    {screen === 'form' ? <>
      <Field label="Nombre" value={form.name} onChangeText={name => setForm(current => ({ ...current, name }))} editable={!busy} />
      {!selected ? <Field label="Slug (opcional; se genera desde el nombre)" value={form.slug} onChangeText={slug => setForm(current => ({ ...current, slug }))} autoCapitalize="none" editable={!busy} /> : <Text style={{ color: colors.inkMuted }}>Slug inmutable: {selected.slug}</Text>}
      <Text style={{ color: colors.ink, fontWeight: '700' }}>Tipo</Text><ChoiceChips options={TYPES.map(value => ({ value, label: value }))} value={form.type} onChange={value => setForm(current => ({ ...current, type: value }))} />
      <Field label="Descripción" value={form.description} onChangeText={description => setForm(current => ({ ...current, description }))} multiline editable={!busy} />
      <Field label="Responsable" value={form.owner} onChangeText={owner => setForm(current => ({ ...current, owner }))} editable={!busy} />
      <Card><Text style={{ color: colors.ink, fontWeight: '800' }}>Configuración no sensible</Text><Text style={{ color: colors.inkMuted }}>No ingreses tokens, claves ni contraseñas. El backend valida las claves.</Text><Field label="Clave pública" value={form.configKey} onChangeText={configKey => setForm(current => ({ ...current, configKey }))} autoCapitalize="none" editable={!busy} /><Field label="Valor" value={form.configValue} onChangeText={configValue => setForm(current => ({ ...current, configValue }))} editable={!busy} /></Card>
      <Button title={busy ? 'Guardando…' : 'Guardar'} onPress={save} disabled={busy || !form.name.trim()} />
      <Button title="Cancelar" variant="secondary" onPress={() => setScreen(selected ? 'detail' : 'list')} disabled={busy} />
    </> : null}
  </Page></KeyboardAvoidingView>;
}
