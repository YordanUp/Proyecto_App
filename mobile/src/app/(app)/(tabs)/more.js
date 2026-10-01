import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { BrandHeader, Button, Card, Page, Pill, SectionTitle } from '../../../components/UI';
import catalogs from '../../../constants/catalogs';
import { hasPermission } from '../../../services/permissions';
import colors from '../../../theme/colors';

const demoModules = [
  { label: 'Compras', route: '/modules/purchases', permission: 'purchases.read' },
  { label: 'Finanzas', route: '/modules/finance', permission: 'finance.read' }
];

export default function MoreScreen() {
  const { user, signOut } = useAuth();
  const accessibleCatalogs = Object.entries(catalogs).filter(([, definition]) => hasPermission(user, definition.permission));
  const accessibleModules = demoModules.filter(item => hasPermission(user, item.permission));
  return <Page>
    <BrandHeader title="Más opciones" subtitle="Accesos adicionales y tu cuenta." />
    {accessibleModules.length ? <>
      <SectionTitle title="Otros módulos" />
      {accessibleModules.map(item => <MenuCard key={item.route} label={item.label} caption="Consulta de demostración" badge="Demo" onPress={() => router.push(item.route)} />)}
    </> : null}
    {accessibleCatalogs.length ? <>
      <SectionTitle title="Catálogos" />
      {accessibleCatalogs.map(([key, item]) => <MenuCard key={key} label={item.label} caption="Registros persistentes" badge="MongoDB" tone="success" onPress={() => router.push(`/catalog/${key}`)} />)}
    </> : null}
    <SectionTitle title="Cuenta" />
    <MenuCard label="Mi perfil" caption={user?.email || 'Usuario'} onPress={() => router.push('/profile')} />
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}><Text style={{ color: colors.ink, fontWeight: '800' }}>{user?.name || 'Usuario'}</Text><Text style={{ color: colors.inkMuted, marginTop: 3 }}>{user?.role || 'Cuenta ERP'}</Text></View>
      <Pill tone="success">Activa</Pill>
    </Card>
    <Button title="Cerrar sesión" variant="secondary" onPress={signOut} />
  </Page>;
}

function MenuCard({ label, caption, badge = undefined, tone = undefined, onPress }) {
  return <Pressable onPress={onPress}><Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.brand, fontSize: 17 }}>›</Text></View>
    <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontWeight: '800' }}>{label}</Text><Text style={{ color: colors.inkMuted, fontSize: 12 }}>{caption}</Text></View>
    {badge ? <Pill tone={tone || 'demo'}>{badge}</Pill> : null}
  </Card></Pressable>;
}
