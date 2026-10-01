import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../../../context/AuthContext';
import { userMessage } from '../../../../api/client';
import { fetchCollection } from '../../../../services/resourceService';
import { hasPermission } from '../../../../services/permissions';
import catalogs from '../../../../constants/catalogs';
import config from '../../../../constants/config';
import useDelayedFlag from '../../../../hooks/useDelayedFlag';
import { BrandHeader, Button, Card, EmptyPanel, Field, LoadingPanel, Notice, Page, Pill, SectionTitle } from '../../../../components/UI';
import colors from '../../../../theme/colors';

export default function CatalogListScreen() {
  const { entity } = useLocalSearchParams();
  const key = Array.isArray(entity) ? entity[0] : entity;
  const definition = catalogs[key];
  const { request, user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const waking = useDelayedFlag(loading, config.coldStartNoticeMs);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchText.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchText]);

  const load = useCallback(async (page = 1, append = false) => {
    if (!definition) return;
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const result = await fetchCollection(request, definition.endpoint, { search, page, limit: 50 });
      setItems(current => append ? [...current, ...result.items] : result.items);
      setPagination(result.pagination);
    } catch (loadError) { setError(loadError); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [definition, request, search]);

  useFocusEffect(useCallback(() => { load(1, false); }, [load]));

  if (!definition) return <Page><EmptyPanel title="Catálogo no encontrado" detail="El catálogo solicitado no está disponible." /></Page>;
  if (!hasPermission(user, definition.permission)) return <Page><Notice tone="warning">Tu cuenta no tiene permiso de lectura para {definition.label.toLowerCase()}.</Notice></Page>;

  const canCreate = hasPermission(user, definition.createPermission) && (key !== 'products' || hasPermission(user, 'categories.read'));

  return <Page refreshing={loading} onRefresh={() => load(1, false)} keyboard>
    <BrandHeader title={definition.label} subtitle="Catálogo persistente conectado a MongoDB." />
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Pill tone="success">Persistente</Pill><Text style={{ color: colors.inkMuted, fontSize: 12 }}>{pagination?.total ?? items.length} registros</Text></View>
    <Field label="Buscar" value={searchText} onChangeText={setSearchText} placeholder={`Buscar ${definition.label.toLowerCase()}`} autoCapitalize="none" />
    {canCreate ? <Button title={`Nuevo ${singular(key)}`} onPress={() => router.push(`/catalog/${key}/new`)} /> : null}
    {key === 'products' && hasPermission(user, definition.createPermission) && !hasPermission(user, 'categories.read') ? <Notice tone="warning">Para crear productos desde el móvil también se necesita permiso de lectura de categorías activas.</Notice> : null}
    {error ? <Notice tone="error">{userMessage(error)}</Notice> : null}
    <SectionTitle title="Registros" />
    {loading ? <LoadingPanel title={`Cargando ${definition.label.toLowerCase()}`} detail={waking ? 'El backend puede tardar en despertar.' : 'Consultando el catálogo…'} /> : items.map((item, index) => <CatalogRow key={item.id || item._id || index} item={item} entityKey={key} definition={definition} />)}
    {!loading && !error && items.length === 0 ? <EmptyPanel title="Sin resultados" detail={search ? 'Prueba otra búsqueda.' : 'Todavía no hay registros en este catálogo.'} /> : null}
    {pagination && pagination.page < pagination.pages ? <Button title="Cargar más" variant="secondary" loading={loadingMore} onPress={() => load(pagination.page + 1, true)} /> : null}
    {!loading && error ? <Button title="Reintentar" variant="secondary" onPress={() => load(1, false)} /> : null}
  </Page>;
}

function CatalogRow({ item, entityKey, definition }) {
  const id = item.id || item._id;
  const subtitle = definition.subtitleFields.map(field => item[field]).filter(value => value !== undefined && value !== null && value !== '').join(' · ');
  return <Pressable onPress={() => router.push(`/catalog/${entityKey}/${id}`)}>
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.mintLight, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.brand, fontWeight: '800' }}>{definition.label[0]}</Text></View>
      <View style={{ flex: 1, gap: 4 }}><Text numberOfLines={1} style={{ color: colors.ink, fontWeight: '800', fontSize: 15 }}>{item[definition.titleField] || 'Registro sin nombre'}</Text><Text numberOfLines={1} style={{ color: colors.inkMuted, fontSize: 12 }}>{subtitle || 'Sin información adicional'}</Text></View>
      <Text style={{ color: colors.inkMuted, fontSize: 22 }}>›</Text>
    </Card>
  </Pressable>;
}

function singular(key) { return key === 'categories' ? 'categoría' : key === 'clients' ? 'cliente' : key === 'suppliers' ? 'proveedor' : 'producto'; }
