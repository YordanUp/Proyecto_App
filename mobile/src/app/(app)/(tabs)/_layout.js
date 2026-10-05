import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';
import { hasAnyPermission, hasPermission } from '../../../services/permissions';
import colors from '../../../theme/colors';
import { tabBarMetrics } from '../../../services/layout';

const glyphs = { index: '⌂', inventory: '▤', sales: '↗', purchases: '⇣', finance: '$', catalogs: '▦', more: '•••' };

export default function TabLayout() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const catalogAccess = hasAnyPermission(user, ['products.read', 'clients.read', 'suppliers.read', 'categories.read', 'warehouses.read']);
  return <Tabs screenOptions={({ route }) => ({
    headerShown: false,
    tabBarActiveTintColor: colors.brand,
    tabBarInactiveTintColor: colors.inkMuted,
    tabBarStyle: { ...tabBarMetrics(insets.bottom), borderTopColor: colors.border, backgroundColor: '#fff' },
    tabBarHideOnKeyboard: true,
    tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
    tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20, fontWeight: '700' }}>{glyphs[route.name] || '•'}</Text>
  })}>
    <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
    <Tabs.Screen name="inventory" options={{ title: 'Inventario', href: hasPermission(user, 'inventory.read') ? undefined : null }} />
    <Tabs.Screen name="sales" options={{ title: 'Ventas', href: hasPermission(user, 'sales.read') ? undefined : null }} />
    <Tabs.Screen name="purchases" options={{ title: 'Compras', href: hasPermission(user, 'purchases.read') ? undefined : null }} />
    <Tabs.Screen name="finance" options={{ title: 'Finanzas', href: hasPermission(user, 'finance.read') ? undefined : null }} />
    <Tabs.Screen name="catalogs" options={{ title: 'Catálogos', href: catalogAccess ? undefined : null }} />
    <Tabs.Screen name="more" options={{ title: 'Más' }} />
  </Tabs>;
}
