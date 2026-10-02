import React from 'react';
import { Text } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { BrandHeader, Button, Card, Page, Pill, SectionTitle } from '../../components/UI';
import colors from '../../theme/colors';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  return <Page>
    <BrandHeader title="Mi perfil" subtitle="Datos de la sesión validada por el backend." />
    <Card style={{ gap: 15 }}>
      <ProfileField label="Nombre" value={user?.name} />
      <ProfileField label="Correo" value={user?.email} />
      <ProfileField label="Rol" value={user?.role} />
      <Text style={{ color: colors.inkMuted, fontSize: 12 }}>Estado de cuenta</Text>
      <Pill tone="success">{user?.status === 'active' ? 'Activa' : user?.status || 'Verificada'}</Pill>
    </Card>
    <SectionTitle title="Permisos efectivos" />
    <Card><Text style={{ color: colors.inkMuted, lineHeight: 20 }}>{Array.isArray(user?.permissions) && user.permissions.length ? user.permissions.join(' · ') : 'No hay permisos asignados.'}</Text></Card>
    <Button title="Cerrar sesión" variant="secondary" onPress={signOut} />
  </Page>;
}

function ProfileField({ label, value }) {
  return <><Text style={{ color: colors.inkMuted, fontSize: 12 }}>{label}</Text><Text style={{ color: colors.ink, fontSize: 15, fontWeight: '700', marginTop: -10 }}>{value || '—'}</Text></>;
}
