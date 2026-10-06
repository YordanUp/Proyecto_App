import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { Button, Card, EmptyPanel, Field, LoadingPanel, Notice, Page, SectionTitle } from '../../../components/UI';
import { ChoiceChips, ErrorPanel } from '../../../components/OperationalUI';
import { listSystemSettings, updateSystemSetting } from '../../../services/operationalService';
import { hasPermission } from '../../../services/permissions';
import { userMessage } from '../../../api/client';
import colors from '../../../theme/colors';

const settingOptions = {
  currency: [{ value: 'MXN', label: 'MXN' }, { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }],
  timezone: [{ value: 'America/Mexico_City', label: 'America/Mexico_City' }, { value: 'UTC', label: 'UTC' }],
  date_format: [{ value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' }, { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' }, { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }]
};

export default function SettingsScreen() {
  const { request, user } = useAuth();
  const canUpdate = hasPermission(user, 'settings.update');
  const [settings, setSettings] = useState([]); const [editingKey, setEditingKey] = useState(null); const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(null); const [success, setSuccess] = useState('');
  const load = useCallback(async () => {
    if (!hasPermission(user, 'settings.read')) { setLoading(false); return; }
    setLoading(true); setError(null);
    try { setSettings(await listSystemSettings(request) || []); }
    catch (loadError) { setError(loadError); } finally { setLoading(false); }
  }, [request, user]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function save(setting) {
    setSaving(true); setError(null); setSuccess('');
    try {
      const response = await updateSystemSetting(request, setting.key, draft);
      setSettings(current => current.map(item => item.key === setting.key ? response.data : item));
      setEditingKey(null); setSuccess(`${setting.label} guardado correctamente.`);
    } catch (saveError) { setError(saveError); } finally { setSaving(false); }
  }

  if (!hasPermission(user, 'settings.read')) return <Page><Notice tone="warning">Tu cuenta no tiene permiso para consultar la configuración.</Notice></Page>;
  return <Page keyboard refreshing={loading} onRefresh={load}>
    <SectionTitle title="Configuración general" />
    <Text style={{ color: colors.inkMuted, lineHeight: 20 }}>Preferencias persistentes del sistema. Estos valores se administran aquí; su aplicación global en formatos está pendiente.</Text>
    {success ? <Notice tone="success">{success}</Notice> : null}
    <ErrorPanel error={error} onRetry={load} userMessage={userMessage} />
    {loading ? <LoadingPanel title="Cargando configuración" /> : settings.length ? settings.map(setting => <Card key={setting.key}>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '800' }}>{setting.label}</Text>
      {editingKey === setting.key ? settingOptions[setting.key]
        ? <ChoiceChips options={settingOptions[setting.key]} value={draft} onChange={setDraft} />
        : <Field label={setting.label} value={draft} onChangeText={setDraft} editable={!saving} />
        : <Text selectable style={{ color: colors.inkMuted, fontSize: 14 }}>{String(setting.value)}</Text>}
      {editingKey === setting.key ? <View style={{ gap: 8 }}><Button title="Guardar cambios" loading={saving} disabled={setting.key === 'company_name' && !draft.trim()} onPress={() => save(setting)} /><Button title="Cancelar" variant="secondary" disabled={saving} onPress={() => setEditingKey(null)} /></View>
        : canUpdate ? <Button title="Editar" variant="secondary" onPress={() => { setEditingKey(setting.key); setDraft(String(setting.value)); setError(null); setSuccess(''); }} />
          : <Text style={{ color: colors.inkMuted, fontSize: 12 }}>Solo lectura</Text>}
    </Card>) : <EmptyPanel title="Configuración no inicializada" detail="Solicita al administrador sincronizar las preferencias base." />}
  </Page>;
}
