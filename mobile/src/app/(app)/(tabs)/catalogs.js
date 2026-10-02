import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { BrandHeader, Card, EmptyPanel, Page, Pill, SectionTitle } from '../../../components/UI';
import catalogs from '../../../constants/catalogs';
import { hasPermission } from '../../../services/permissions';
import colors from '../../../theme/colors';

export default function CatalogsScreen() {
  const { user } = useAuth();
  const available = Object.entries(catalogs).filter(([, definition]) => hasPermission(user, definition.permission));
  return <Page>
    <BrandHeader title="Catálogos" subtitle="Registros persistentes conectados al backend." />
    <NoticeCatalog />
    <SectionTitle title="Entidades disponibles" action={<Pill tone="success">MongoDB</Pill>} />
    {available.map(([entity, definition]) => <Pressable key={entity} onPress={() => router.push(`/catalog/${entity}`)}>
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mintLight }}><Text style={{ color: colors.brand, fontSize: 18, fontWeight: '800' }}>▦</Text></View>
        <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontWeight: '800', fontSize: 15 }}>{definition.label}</Text><Text style={{ color: colors.inkMuted, fontSize: 12 }}>Buscar, consultar y administrar registros</Text></View>
        <Text style={{ color: colors.inkMuted, fontSize: 22 }}>›</Text>
      </Card>
    </Pressable>)}
    {!available.length ? <EmptyPanel title="Sin catálogos disponibles" detail="Tu cuenta no tiene permisos de lectura de catálogos." /> : null}
  </Page>;
}

function NoticeCatalog() {
  const { user } = useAuth();
  return <Text style={{ color: colors.inkMuted, fontSize: 13, lineHeight: 19 }}>Se muestran solo los catálogos permitidos para {user?.name || 'tu usuario'}.</Text>;
}
