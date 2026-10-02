import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { userMessage } from '../../../../api/client';
import catalogs from '../../../../constants/catalogs';
import { hasPermission } from '../../../../services/permissions';
import { Button, Card, EmptyPanel, Field, Notice, Page, SectionTitle } from '../../../../components/UI';
import colors from '../../../../theme/colors';

export default function NewCatalogRecordScreen() {
  const { entity } = useLocalSearchParams();
  const key = Array.isArray(entity) ? entity[0] : entity;
  const definition = catalogs[key];
  const { request, user } = useAuth();
  const [values, setValues] = useState({});
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (key !== 'products' || !hasPermission(user, 'categories.read')) return;
    request('/api/categories?status=active&limit=100').then(response => setCategories(Array.isArray(response.data) ? response.data.filter(item => item.status === 'active') : [])).catch(() => setCategories([]));
  }, [key, request, user]);

  if (!definition) return <Page><EmptyPanel title="Catálogo no encontrado" detail="La pantalla solicitada no está disponible." /></Page>;
  if (!hasPermission(user, definition.createPermission)) return <Page><Notice tone="warning">Tu cuenta no tiene permiso para crear en este catálogo.</Notice></Page>;
  if (key === 'products' && !hasPermission(user, 'categories.read')) return <Page><Notice tone="warning">Crear productos requiere además `categories.read`, para elegir una categoría activa.</Notice></Page>;

  async function save() {
    setError('');
    const missing = definition.fields.find(field => field.required && !String(values[field.name] ?? '').trim());
    if (missing) { setError(`${missing.label} es requerido.`); return; }
    const body = { ...values };
    for (const field of definition.fields.filter(item => item.type === 'number')) {
      if (body[field.name] === '' || body[field.name] === undefined) delete body[field.name];
      else body[field.name] = Number(body[field.name]);
    }
    if (key === 'products' && categories.length === 0) { setError('Registra una categoría activa antes de crear un producto.'); return; }
    setSaving(true);
    try {
      const response = await request(definition.endpoint, { method: 'POST', body });
      router.replace(`/catalog/${key}/${response.data.id}`);
    } catch (saveError) { setError(userMessage(saveError)); }
    finally { setSaving(false); }
  }

  return <Page keyboard>
    <SectionTitle title={`Nuevo ${key === 'categories' ? 'categoría' : key === 'clients' ? 'cliente' : key === 'suppliers' ? 'proveedor' : 'producto'}`} />
    <Card>
      {definition.fields.map(field => field.type === 'category'
        ? <CategoryPicker key={field.name} label={field.label} categories={categories} value={values[field.name]} onChange={value => setValues(current => ({ ...current, [field.name]: value }))} />
        : <Field key={field.name} label={field.label} value={values[field.name]} onChangeText={value => setValues(current => ({ ...current, [field.name]: value }))} keyboardType={field.type === 'number' ? 'decimal-pad' : field.type === 'email' ? 'email-address' : field.type === 'phone' ? 'phone-pad' : 'default'} multiline={field.multiline} autoCapitalize={field.autoCapitalize || (field.type === 'email' ? 'none' : 'sentences')} placeholder={field.required ? `${field.label} (requerido)` : field.label} />)}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button title="Guardar registro" loading={saving} onPress={save} />
      <Button title="Cancelar" variant="secondary" onPress={() => router.back()} />
    </Card>
  </Page>;
}

function CategoryPicker({ label, categories, value, onChange }) {
  return <View style={{ gap: 8 }}>
    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    {categories.map(item => <Pressable key={item.id} onPress={() => onChange(item.id)} style={{ borderRadius: 10, padding: 12, borderWidth: 1, borderColor: item.id === value ? colors.brand : colors.border, backgroundColor: item.id === value ? '#EEF4FA' : '#fff' }}>
      <Text style={{ color: colors.ink, fontWeight: '700' }}>{item.name}{item.id === value ? '  ✓' : ''}</Text>
    </Pressable>)}
    {!categories.length ? <Text style={{ color: colors.inkMuted, fontSize: 12 }}>No hay categorías activas disponibles.</Text> : null}
  </View>;
}
