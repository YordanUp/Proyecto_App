import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../../../context/AuthContext';
import ModuleScreen from '../../../components/ModuleScreen';

export default function SalesTab() {
  const { user } = useAuth();
  if (!user?.permissions?.includes('sales.read')) return <Redirect href="/(app)/(tabs)/more" />;
  return <ModuleScreen moduleKey="sales" />;
}
