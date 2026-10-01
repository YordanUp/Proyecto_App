import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { userMessage } from '../api/client';
import { Button, Field, Notice, Page } from '../components/UI';
import { logo } from '../constants/assets';
import colors from '../theme/colors';
import config from '../constants/config';

export default function LoginScreen() {
  const { status, signingIn, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showWarmup, setShowWarmup] = useState(false);

  useEffect(() => {
    if (!signingIn) return undefined;
    const timer = setTimeout(() => setShowWarmup(true), config.coldStartNoticeMs);
    return () => clearTimeout(timer);
  }, [signingIn]);

  if (status === 'signedIn') return <Redirect href="/(app)/(tabs)" />;

  async function handleSubmit() {
    setError('');
    setShowWarmup(false);
    try {
      await signIn(email.trim(), password);
      setPassword('');
      router.replace('/(app)/(tabs)');
    } catch (loginError) {
      setError(userMessage(loginError));
    }
  }

  return <Page contentStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboard>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ backgroundColor: '#fff', borderRadius: 22, padding: 24, gap: 18, borderColor: colors.border, borderWidth: 1 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Image source={logo} resizeMode="contain" style={{ width: 130, height: 100 }} accessibilityLabel="Logo YordanUp" />
          <Text style={{ color: colors.inkMuted, fontSize: 11, letterSpacing: 1, fontWeight: '800' }}>ERP MODULAR</Text>
          <Text style={{ color: colors.ink, fontSize: 26, fontWeight: '800' }}>Iniciar sesión</Text>
          <Text style={{ color: colors.inkMuted, textAlign: 'center', lineHeight: 20 }}>Accede con tu cuenta de YordanUp.</Text>
        </View>
        <Field label="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="usuario@empresa.com" />
        <Field label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="Tu contraseña" />
        {showWarmup ? <Notice tone="warning">Conectando con el servidor. En Render Free, el primer acceso puede tardar mientras el servicio despierta.</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button title="Ingresar" onPress={handleSubmit} loading={signingIn} disabled={!email.trim() || !password} />
      </View>
    </KeyboardAvoidingView>
  </Page>;
}
