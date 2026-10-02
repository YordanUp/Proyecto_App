import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { userMessage } from '../../../../api/client';
import catalogs from '../../../../constants/catalogs';
import { hasPermission } from '../../../../services/permissions';
import { Button, Card, EmptyPanel, Field, LoadingPanel, Notice, Page, SectionTitle } from '../../../../components/UI';
import colors from '../../../../theme/colors';

export default function CatalogDetailScreen() {
  const { entity, id } = useLocalSearchParams();
  const key = Array.isArray(entity) ? entity[0] : entity;
  const recordId = Array.isArray(id) ? id[0] : id;
  const definition = catalogs[key];
  const { request, user } = useAuth();
  const [record, setRecord] = useState(null);
  const [values, setValues] = useState({});
  const [categories, setCategories] = useState([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!definition || !recordId) return;
    setLoading(true); setError(null);
    try {
      const response = await request(`${definition.endpoint}/${encodeURIComponent(recordId)}`);
      setRecord(response.data);
      setValues(Object.fromEntries(definition.fields.map(field => [field.name, response.data[field.name] == null ? '' : String(response.data[field.name])])));
    } catch (loadError) { setError(loadError); }
    finally { setLoading(false); }
  }, [definition, recordId, request]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (key !== 'products' || !editing || !hasPermission(user, 'categories.read')) return;
    request('/api/categories?status=active&limit=100').then(response => setCategories(Array.isArray(response.data) ? response.data.filter(item => item.status === 'active') : [])).catch(() => setCategories([]));
  }, [editing, key, request, user]);

  if (!definition) return <Page><EmptyPanel title="Catálogo no encontrado" detail="La pantalla solicitada no está disponible." /></Page>;
  if (!hasPermission(user, definition.permission)) return <Page><Notice tone="warning">Tu cuenta no tiene permiso de lectura para este registro.</Notice></Page>;
  if (loading) return <Page><LoadingPanel title="Cargando registro" /></Page>;
  if (error) return <Page><Notice tone="error">{userMessage(error)}</Notice><Button title="Reintentar" onPress={load} variant="secondary" /></Page>;
  if (!record) return <Page><EmptyPanel title="Registro no encontrado" detail="El registro pudo ser eliminado o desactivado." /></Page>;

  async function save() {
    setError(null);
    const missing = definition.fields.find(field => field.required && !String(values[field.name] ?? '').trim());
    if (missing) { setError(new Error(`${missing.label} es requerido.`)); return; }
    const body = { ...values };
    for (const field of definition.fields.filter(item => item.type === 'number')) body[field.name] = Number(body[field.name]);
    setSaving(true);
    try {
      const response = await request(`${definition.endpoint}/${encodeURIComponent(recordId)}`, { method: 'PUT', body });
      setRecord(response.data); setEditing(false);
    } catch (saveError) { setError(saveError); }
    finally { setSaving(false); }
  }

  function discardChanges() {
    setEditing(false);
    setError(null);
    setValues(Object.fromEntries(definition.fields.map(field => [
      field.name,
      record[field.name] == null ? '' : String(record[field.name])
    ])));
  }

  function deactivate() {
    Alert.alert('Desactivar registro', `¿Desactivar ${record[definition.titleField] || definition.label}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desactivar', style: 'destructive', onPress: async () => {
        try { await request(`${definition.endpoint}/${encodeURIComponent(recordId)}`, { method: 'DELETE' }); router.back(); }
        catch (deleteError) { setError(deleteError); }
      } }
    ]);
  }

  const canEdit = hasPermission(user, definition.updatePermission);
  const canDelete = hasPermission(user, definition.deletePermission);
  return <Page keyboard>
    <SectionTitle title={editing ? 'Editar registro' : record[definition.titleField] || definition.label} />
    <Card>
      {editing ? definition.fields.map(field => field.type === 'category'
        ? <CategoryPicker key={field.name} label={field.label} categories={categories} value={values[field.name]} onChange={value => setValues(current => ({ ...current, [field.name]: value }))} />
        : <Field key={field.name} label={field.label} value={values[field.name]} onChangeText={value => setValues(current => ({ ...current, [field.name]: value }))} keyboardType={field.type === 'number' ? 'decimal-pad' : field.type === 'email' ? 'email-address' : field.type === 'phone' ? 'phone-pad' : 'default'} multiline={field.multiline} autoCapitalize={field.type === 'email' ? 'none' : 'sentences'} />)
        : <RecordDetails record={record} definition={definition} />}
      {record.status ? <View style={{ gap: 6 }}><Text style={{ color: colors.inkMuted, fontSize: 12 }}>Estado</Text><Text style={{ color: colors.ink, fontWeight: '700' }}>{record.status === 'active' ? 'Activo' : 'Inactivo'}</Text></View> : null}
      {error ? <Notice tone="error">{userMessage(error)}</Notice> : null}
      {editing ? <>
        <Button title="Guardar cambios" loading={saving} onPress={save} />
        <Button title="Descartar cambios" variant="secondary" onPress={discardChanges} />
      </> : <>
        {canEdit ? <Button title="Editar" onPress={() => setEditing(true)} /> : null}
        {canDelete && record.status !== 'inactive' ? <Button title="Desactivar" variant="danger" onPress={deactivate} /> : null}
      </>}
    </Card>
  </Page>;
}

function RecordDetails({ record, definition }) {
  return <>
    {definition.fields.map(field => {
      const value = record[field.name];
      if (value === undefined || value === null || value === '') return null;
      return <View key={field.name} style={{ gap: 5 }}><Text style={{ color: colors.inkMuted, fontSize: 12 }}>{field.label}</Text><Text style={{ color: colors.ink, fontWeight: '700', fontSize: 14 }}>{String(value)}</Text></View>;
    })}
    {record.createdAt ? <Text style={{ color: colors.inkMuted, fontSize: 12 }}>Creado {new Date(record.createdAt).toLocaleDateString('es-MX')}</Text> : null}
  </>;
}

function CategoryPicker({ label, categories, value, onChange }) {
  return <View style={{ gap: 8 }}><Text style={{ color: colors.ink, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    {categories.map(item => <Pressable key={item.id} onPress={() => onChange(item.id)} style={{ borderRadius: 10, padding: 12, borderWidth: 1, borderColor: item.id === value ? colors.brand : colors.border, backgroundColor: item.id === value ? '#EEF4FA' : '#fff' }}><Text style={{ color: colors.ink, fontWeight: '700' }}>{item.name}{item.id === value ? '  ✓' : ''}</Text></Pressable>)}
    {!categories.length ? <Text style={{ color: colors.inkMuted, fontSize: 12 }}>No hay categorías activas disponibles.</Text> : null}
  </View>;
}
