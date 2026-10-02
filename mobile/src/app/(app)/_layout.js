import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { LoadingPanel, Page } from '../../components/UI';

export default function AppLayout() {
  const { status } = useAuth();
  if (status === 'checking') return <Page><LoadingPanel title="Comprobando sesión" /></Page>;
  if (status !== 'signedIn') return <Redirect href={status === 'offline' ? '/' : '/login'} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
