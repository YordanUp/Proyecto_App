import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Field, Notice, Pill } from './UI';
import colors from '../theme/colors';

export function StatusBadge({ status }) {
  const labels = { draft: 'Borrador', confirmed: 'Confirmada', cancelled: 'Cancelada', ordered: 'Ordenada', received: 'Recibida', pending: 'Pendiente', partial: 'Parcial', paid: 'Pagada', low: 'Stock bajo', available: 'Disponible', NO_STOCK: 'Sin stock', IN: 'Entrada', OUT: 'Salida', ADJUSTMENT: 'Ajuste', TRANSFER_OUT: 'Transferencia', TRANSFER_IN: 'Transferencia' };
  const tone = ['confirmed', 'received', 'paid', 'available', 'IN', 'TRANSFER_IN'].includes(status) ? 'success' : ['cancelled', 'low', 'NO_STOCK', 'OUT'].includes(status) ? 'demo' : 'neutral';
  return <Pill tone={tone}>{labels[status] || status || '—'}</Pill>;
}

export function MoneyText({ value, style = undefined }) {
  return <Text style={[{ color: colors.ink, fontWeight: '800' }, style]}>{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0)}</Text>;
}

export function ChoiceChips({ options, value, onChange }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{options.map(option => {
    const active = option.value === value;
    return <Pressable key={option.value} accessibilityRole="button" onPress={() => onChange(option.value)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: active ? colors.brand : '#fff', borderWidth: 1, borderColor: active ? colors.brand : colors.border }}>
      <Text style={{ color: active ? '#fff' : colors.ink, fontWeight: '700', fontSize: 12 }}>{option.label}</Text>
    </Pressable>;
  })}</View>;
}

export function SearchBar({ value, onChangeText, onSearch, placeholder = 'Buscar…' }) {
  return <View style={{ gap: 8 }}><Field label="Búsqueda" value={value} onChangeText={onChangeText} placeholder={placeholder} autoCapitalize="none" /><Button title="Buscar" variant="secondary" onPress={onSearch} /></View>;
}

export function ErrorPanel({ error, onRetry, userMessage }) {
  if (!error) return null;
  return <><Notice tone="error">{userMessage(error)}</Notice>{onRetry ? <Button title="Reintentar" onPress={onRetry} variant="secondary" /> : null}</>;
}

export function ConfirmAction({ title, message, confirmLabel, onConfirm, variant = 'primary', disabled = false }) {
  const { Alert } = require('react-native');
  return <Button title={title} variant={variant} disabled={disabled} onPress={() => Alert.alert(title, message, [
    { text: 'Volver', style: 'cancel' },
    { text: confirmLabel || title, style: variant === 'danger' ? 'destructive' : 'default', onPress: onConfirm }
  ])} />;
}

export function LoadMore({ pagination, loading, onPress }) {
  if (!pagination || Number(pagination.page) >= Number(pagination.pages)) return null;
  return <Button title="Cargar más" variant="secondary" loading={loading} onPress={onPress} />;
}

export function FieldRow({ children }) {
  return <View style={{ gap: 12 }}>{children}</View>;
}
