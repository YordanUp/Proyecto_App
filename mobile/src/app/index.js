import React from 'react';
import { Redirect, router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { Button, LoadingPanel, Notice, Page } from '../components/UI';
import { userMessage } from '../api/client';

export default function IndexRoute() {
  const { status, error, retrySession } = useAuth();
  if (status === 'checking') return <Page><LoadingPanel title="Comprobando sesión" /></Page>;
  if (status === 'signedIn') return <Redirect href="/(app)/(tabs)" />;
  if (status === 'signedOut') return <Redirect href="/login" />;

  return <Page contentStyle={{ flex: 1, justifyContent: 'center' }}>
    <Notice tone="warning">No fue posible validar la sesión. {userMessage(error)} Si la cuenta ya tenía sesión, el token se conserva para reintentar cuando el backend vuelva.</Notice>
    <Button title="Reintentar conexión" onPress={retrySession} />
    <Button title="Ir al inicio de sesión" variant="secondary" onPress={() => router.replace('/login')} />
  </Page>;
}
