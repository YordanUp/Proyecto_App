import React, { useCallback, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import { Button, Card, EmptyPanel, LoadingPanel, Notice, Page, SectionTitle } from '../../../components/UI';
import { ErrorPanel, MoneyText } from '../../../components/OperationalUI';
import { getDashboard } from '../../../services/operationalService';
import { logo } from '../../../constants/assets';
import config from '../../../constants/config';
import useDelayedFlag from '../../../hooks/useDelayedFlag';
import { hasPermission } from '../../../services/permissions';
import colors from '../../../theme/colors';
import { userMessage } from '../../../api/client';
const { metricDefinitions, readDashboardMetric } = require('../../../services/dashboardMetrics');

export default function DashboardScreen() {
  const { user, request, signOut } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const waking = useDelayedFlag(loading, config.coldStartNoticeMs);
  const canReadDashboard = hasPermission(user, 'dashboard.read');
  const load = useCallback(async () => {
    if (!canReadDashboard) { setLoading(false); setError(null); return; }
    setLoading(true); setError(null);
    try { const response = await getDashboard(request); setSummary(response.data || null); }
    catch (loadError) { setError(loadError); }
    finally { setLoading(false); }
  }, [canReadDashboard, request]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return <Page refreshing={loading} onRefresh={load}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Image source={logo} resizeMode="contain" style={{ width: 48, height: 42 }} />
      <View style={{ flex: 1 }}><Text style={{ color: colors.inkMuted, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>YORDANUP ERP</Text><Text style={{ color: colors.ink, fontSize: 22, fontWeight: '800' }}>Resumen real</Text></View>
    </View>
    <Card style={{ backgroundColor: colors.brand, borderColor: colors.brand }}>
      <Text style={{ color: '#C6D6E7', fontSize: 12, fontWeight: '700' }}>BIENVENIDO</Text>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{user?.name || 'Usuario'}</Text>
      <Text style={{ color: '#D8E5F2' }}>{user?.role || 'Cuenta ERP'} · Datos sincronizados con el servidor</Text>
    </Card>
    {!canReadDashboard ? <Notice tone="warning">Tu perfil no tiene permiso para consultar el dashboard.</Notice> : <>
      <SectionTitle title="Indicadores operativos" />
      <ErrorPanel error={error} onRetry={load} userMessage={userMessage} />
      {loading ? <LoadingPanel title="Cargando indicadores" detail={waking ? 'El servidor de Render puede tardar unos segundos en iniciar.' : 'Consultando el ERP…'} /> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
        {metricDefinitions.map(metric => {
          const value = readDashboardMetric(summary?.metrics, metric);
          return <Card key={metric.key} style={{ width: '47%', flexGrow: 1, minHeight: 92, justifyContent: 'space-between' }}>
            <Text style={{ color: colors.inkMuted, fontSize: 12, fontWeight: '700' }}>{metric.label}</Text>
            {metric.money ? <MoneyText value={value} style={{ fontSize: 19 }} /> : <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '800' }}>{Number(value) || 0}</Text>}
          </Card>;
        })}
      </View>}
      {!loading && !summary ? <EmptyPanel title="Sin resumen disponible" detail="La API no devolvió indicadores." /> : null}
      {summary?.stockAlerts?.length ? <><SectionTitle title="Alertas de inventario" />{summary.stockAlerts.map((item, index) => <Card key={item._id || index} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontWeight: '800' }}>{item.product?.name || 'Producto'}</Text><Text style={{ color: colors.inkMuted }}>{item.warehouse?.name || 'Almacén'} · Mínimo {item.minimumStock}</Text></View>
        <Text style={{ color: colors.warning, fontWeight: '800' }}>{item.availableQuantity} disp.</Text>
      </Card>)}</> : null}
      {summary?.recentSales?.length ? <><SectionTitle title="Ventas recientes" />{summary.recentSales.map(sale => <Card key={sale.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontWeight: '800' }}>{sale.folio}</Text><Text style={{ color: colors.inkMuted }}>{sale.customer?.name || 'Cliente'} · {sale.confirmedAt ? new Date(sale.confirmedAt).toLocaleDateString('es-MX') : ''}</Text></View><View><Text style={{ color: colors.inkMuted, fontSize: 11 }}>Bruto</Text><MoneyText value={sale.total} /></View></Card>)}</> : null}
      {summary?.recentFinancialMovements?.length ? <><SectionTitle title="Movimientos financieros recientes" />{summary.recentFinancialMovements.map(movement => <Card key={movement.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ flex: 1, gap: 3 }}><Text style={{ color: colors.ink, fontWeight: '700' }}>{movement.description || movement.type}</Text><Text style={{ color: colors.inkMuted }}>{new Date(movement.createdAt).toLocaleDateString('es-MX')} · {movement.createdBy?.name || 'Usuario'}</Text></View><MoneyText value={movement.amount} style={{ color: movement.direction === 'IN' ? colors.success : colors.warning }} /></Card>)}</> : null}
    </>}
    <SectionTitle title="Accesos rápidos" />
    <View style={{ gap: 8 }}>{[
      ['Inventario', '/(app)/(tabs)/inventory', 'inventory.read'], ['Ventas', '/(app)/(tabs)/sales', 'sales.read'], ['Compras', '/(app)/(tabs)/purchases', 'purchases.read'], ['Finanzas', '/(app)/(tabs)/finance', 'finance.read']
    ].filter(([, , permission]) => hasPermission(user, permission)).map(([label, href]) => <Pressable key={href} onPress={() => router.push(href)}><Card style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ color: colors.ink, fontWeight: '800', flex: 1 }}>{label}</Text><Text style={{ color: colors.inkMuted, fontSize: 22 }}>›</Text></Card></Pressable>)}</View>
    <Button title="Cerrar sesión" variant="secondary" onPress={signOut} />
  </Page>;
}
