import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { userMessage } from '../api/client';
import { BrandHeader, Button, Card, EmptyPanel, LoadingPanel, Notice, Page, Pill, SectionTitle } from './UI';
import modules from '../constants/demoModules';
import useDelayedFlag from '../hooks/useDelayedFlag';
import config from '../constants/config';
import colors from '../theme/colors';

export default function ModuleScreen({ moduleKey: providedKey = null }) {
  const params = useLocalSearchParams();
  const key = providedKey || params.module;
  const definition = modules[key];
  const { request, user } = useAuth();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const waking = useDelayedFlag(loading, config.coldStartNoticeMs);

  const load = useCallback(async () => {
    if (!definition) return;
    setLoading(true); setError(null);
    try {
      const requestedCollections = definition.collections || [{ label: definition.label, endpoint: definition.endpoint, titleField: definition.titleField }];
      const results = await Promise.all(requestedCollections.map(async collection => {
        const response = await request(collection.endpoint);
        return { ...collection, items: Array.isArray(response.data) ? response.data : [] };
      }));
      setCollections(results);
    } catch (loadError) { setError(loadError); }
    finally { setLoading(false); }
  }, [definition, request]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!definition) return <Page><EmptyPanel title="Módulo no encontrado" detail="La pantalla solicitada no está disponible." /></Page>;
  if (!user?.permissions?.includes(definition.permission)) return <Page><Notice tone="warning">Tu cuenta no tiene permiso para consultar este módulo.</Notice></Page>;

  return <Page refreshing={loading} onRefresh={load}>
    <BrandHeader title={definition.label} subtitle="Consulta móvil del ERP." />
    <Notice tone="warning">{definition.badge}. El backend actual usa datos en memoria para este módulo. Esta pantalla es de consulta y no presenta las cifras como persistidas.</Notice>
    {error ? <Notice tone="error">{userMessage(error)}</Notice> : null}
    <SectionTitle title="Registros" action={<Pill tone="demo">Solo lectura</Pill>} />
    {loading ? <LoadingPanel title={`Cargando ${definition.label.toLowerCase()}`} detail={waking ? 'El servicio de Render puede estar despertando.' : 'Consultando la API…'} /> : collections.map(collection => <View key={collection.endpoint} style={{ gap: 10 }}>
      <SectionTitle title={collection.label} />
      {collection.items.map((row, index) => <DemoRow key={row.id || row._id || index} row={row} moduleKey={key} definition={{ ...definition, titleField: collection.titleField || definition.titleField }} />)}
      {collection.items.length === 0 ? <EmptyPanel title={`Sin ${collection.label.toLowerCase()}`} detail="La API no devolvió elementos para esta vista." /> : null}
    </View>)}
    {!loading && error ? <Button title="Reintentar" onPress={load} variant="secondary" /> : null}
  </Page>;
}

function DemoRow({ row, moduleKey, definition }) {
  const title = row[definition.titleField] || row.name || row.code || row.id || 'Registro';
  const secondary = moduleKey === 'sales' ? `Cliente ${row.customerId || '—'} · ${row.status || '—'}`
    : moduleKey === 'purchases' ? `Proveedor ${row.supplierId || '—'} · ${row.status || '—'}`
      : moduleKey === 'finance' ? `${row.type || 'Cuenta'} · ${row.status || '—'}`
        : `Existencia · Almacén ${row.warehouseId || '—'}`;
  return <Card>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><Text style={{ color: colors.ink, fontWeight: '800', fontSize: 15, flex: 1 }}>{String(title)}</Text><Pill tone="demo">Demo</Pill></View>
    <Text style={{ color: colors.inkMuted, fontSize: 13 }}>{secondary}</Text>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: colors.inkMuted, fontSize: 12 }}>{row.createdAt ? new Date(row.createdAt).toLocaleDateString('es-MX') : 'Registro de muestra'}</Text>
      <Text style={{ color: colors.brand, fontWeight: '800' }}>{moduleKey === 'inventory' ? `Stock ${row.stock ?? 0}` : `$${Number(row.total ?? row.balance ?? row.amount ?? 0).toLocaleString('es-MX')}`}</Text>
    </View>
  </Card>;
}
