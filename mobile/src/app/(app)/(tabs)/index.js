import { useCallback, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { userMessage } from '../../../api/client';
import { Button, Card, LoadingPanel, Notice, Page, Pill, SectionTitle } from '../../../components/UI';
import { logo } from '../../../constants/assets';
import config from '../../../constants/config';
import useDelayedFlag from '../../../hooks/useDelayedFlag';
import { hasPermission } from '../../../services/permissions';
import colors from '../../../theme/colors';

const metrics = [
  { key: 'totalSales', label: 'Ventas', glyph: '↗' },
  { key: 'totalPurchases', label: 'Compras', glyph: '⇣' },
  { key: 'stockValue', label: 'Inventario', glyph: '▤' },
  { key: 'monthlyRevenue', label: 'Ingresos', glyph: '＋' }
];

const shortcuts = [
  { label: 'Productos', route: '/catalog/products', permission: 'products.read', glyph: '▦' },
  { label: 'Clientes', route: '/catalog/clients', permission: 'clients.read', glyph: '♧' },
  { label: 'Inventario', route: '/(app)/(tabs)/inventory', permission: 'inventory.read', glyph: '▤', demo: true },
  { label: 'Ventas', route: '/(app)/(tabs)/sales', permission: 'sales.read', glyph: '↗', demo: true }
];

export default function DashboardScreen() {
  const { user, request, signOut } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const waking = useDelayedFlag(loading, config.coldStartNoticeMs);

  const loadSummary = useCallback(async () => {
    if (!hasPermission(user, 'dashboard.read')) { setLoading(false); setError(null); return; }
    setLoading(true);
    setError(null);
    try {
      const response = await request('/api/dashboard');
      setSummary(response.data || null);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [request, user]);

  useFocusEffect(useCallback(() => { loadSummary(); }, [loadSummary]));

  const money = value => `$${(Number(value) || 0).toLocaleString('es-MX')}`;

  return <Page refreshing={loading} onRefresh={loadSummary}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Image source={logo} resizeMode="contain" style={{ width: 48, height: 42 }} />
      <View style={{ flex: 1 }}><Text style={{ color: colors.inkMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>YORDANUP ERP</Text><Text style={{ color: colors.ink, fontSize: 22, fontWeight: '800' }}>Resumen</Text></View>
      <Pill tone="success">Sesión activa</Pill>
    </View>

    <Card style={{ backgroundColor: colors.brand, borderColor: colors.brand, padding: 19 }}>
      <Text style={{ color: '#C6D6E7', fontSize: 12, fontWeight: '700' }}>BIENVENIDO</Text>
      <Text style={{ color: '#fff', fontSize: 23, fontWeight: '800', marginTop: 4 }}>{user?.name || 'Usuario'}</Text>
      <Text style={{ color: '#D8E5F2', marginTop: 3 }}>{user?.role || 'Cuenta ERP'} · {user?.status === 'active' ? 'Activa' : 'Estado verificado'}</Text>
    </Card>

    {hasPermission(user, 'dashboard.read') ? <>
      <SectionTitle title="Indicadores" action={<Pill tone="demo">Demo</Pill>} />
      <Notice tone="warning">Estas cifras provienen del prototipo y no representan datos persistidos de ventas, compras, inventario o finanzas.</Notice>
      {error ? <Notice tone="error">{userMessage(error)}</Notice> : null}
      {loading ? <LoadingPanel title="Cargando resumen" detail={waking ? 'El backend puede tardar unos segundos en despertar.' : 'Conectando con el ERP…'} /> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {metrics.map(item => <Card key={item.key} style={{ width: '48%', flexGrow: 1, minHeight: 102, justifyContent: 'space-between' }}>
          <Text style={{ color: colors.inkMuted, fontWeight: '700', fontSize: 12 }}>{item.glyph}  {item.label}</Text>
          <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 20 }}>{summary?.metrics?.[item.key] == null ? '—' : money(summary.metrics[item.key])}</Text>
          <Text style={{ color: colors.warning, fontSize: 10, fontWeight: '700' }}>Dato de muestra</Text>
        </Card>)}
      </View>}
      {!loading && error ? <Button title="Volver a cargar" variant="secondary" onPress={loadSummary} /> : null}
    </> : <Notice>Tu perfil no tiene permiso para consultar los indicadores. Los accesos permitidos aparecen abajo.</Notice>}

    <SectionTitle title="Accesos rápidos" />
    <View style={{ gap: 9 }}>
      {shortcuts.filter(item => hasPermission(user, item.permission)).map(item => <Pressable key={item.route} onPress={() => router.push(item.route)} style={{ minHeight: 56, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', borderRadius: 13, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 18, color: colors.brand }}>{item.glyph}</Text>
        <Text style={{ color: colors.ink, fontWeight: '700', flex: 1 }}>{item.label}</Text>
        {item.demo ? <Pill tone="demo">Demo</Pill> : null}
        <Text style={{ color: colors.inkMuted, fontSize: 22 }}>›</Text>
      </Pressable>)}
      {!shortcuts.some(item => hasPermission(user, item.permission)) ? <Text style={{ color: colors.inkMuted }}>No hay accesos rápidos para tus permisos.</Text> : null}
    </View>
    <Button title="Cerrar sesión" variant="secondary" onPress={signOut} />
  </Page>;
}
