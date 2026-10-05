import React, { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { userMessage } from '../api/client';
import { Button, Field, Notice, Page } from '../components/UI';
import { logo } from '../constants/assets';
import colors from '../theme/colors';
import config from '../constants/config';
import { keyboardAvoidingBehavior } from '../services/layout';

export default function LoginScreen() {
  const { status, signingIn, signIn, request } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showWarmup, setShowWarmup] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  useEffect(() => {
    if (!signingIn) return undefined;
    const timer = setTimeout(() => setShowWarmup(true), config.coldStartNoticeMs);
    return () => clearTimeout(timer);
  }, [signingIn]);

  if (status === 'signedIn') return <Redirect href="/(app)/(tabs)" />;

  async function handleSubmit() {
    setError('');
    setEmailNotVerified(false);
    setResendMessage('');
    setShowWarmup(false);
    try {
      await signIn(email.trim(), password);
      setPassword('');
      router.replace('/(app)/(tabs)');
    } catch (loginError) {
      setError(userMessage(loginError));
      setEmailNotVerified(loginError?.code === 'EMAIL_NOT_VERIFIED');
    }
  }

  async function resendVerification() {
    setResending(true); setResendMessage('');
    try {
      const result = await request('/api/auth/resend-verification', { method: 'POST', body: { email: email.trim() } });
      setResendMessage(result.message || 'Si la cuenta existe, recibirás instrucciones para verificarla.');
    } catch (resendError) { setResendMessage(userMessage(resendError)); }
    finally { setResending(false); }
  }

  return <Page contentStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboard>
    <KeyboardAvoidingView style={{ flexGrow: 1, justifyContent: 'center' }} behavior={keyboardAvoidingBehavior(Platform.OS)}>
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
        {emailNotVerified ? <Button title="Reenviar verificación" variant="secondary" loading={resending} onPress={resendVerification} disabled={!email.trim()} /> : null}
        {resendMessage ? <Notice>{resendMessage}</Notice> : null}
        <Button title="Ingresar" onPress={handleSubmit} loading={signingIn} disabled={!email.trim() || !password} />
      </View>
    </KeyboardAvoidingView>
  </Page>;
}
