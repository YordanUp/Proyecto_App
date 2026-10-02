import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { userMessage } from '../api/client';
import colors from '../theme/colors';

export default function RemoteSelect({ label, endpoint, value, onChange, required = false }) {
  const { request } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true); setError('');
      try {
        const params = new URLSearchParams({ page: '1', limit: '25' });
        if (search.trim()) params.set('search', search.trim());
        if (endpoint.includes('/products')) params.set('status', 'active');
        const response = await request(`${endpoint}?${params.toString()}`);
        const items = Array.isArray(response.data) ? response.data : [];
        if (active) {
          setOptions(items);
          if (value) setSelected(current => items.find(item => String(item.id || item._id) === String(value)) || current);
        }
      } catch (loadError) { if (active) setError(userMessage(loadError)); }
      finally { if (active) setLoading(false); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [endpoint, open, request, search, value]);

  const labelFor = item => {
    if (!item) return '';
    const title = item.name || item.folio || item.code || item.id;
    return item.code && item.name ? `${item.code} · ${item.name}` : String(title || 'Registro');
  };

  return <View style={{ gap: 7 }}>
    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '700' }}>{label}{required ? ' *' : ''}</Text>
    <Pressable accessibilityRole="button" onPress={() => setOpen(current => !current)} style={{ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: open ? colors.brand : colors.border, backgroundColor: '#fff', paddingHorizontal: 13, justifyContent: 'center' }}>
      <Text style={{ color: selected ? colors.ink : colors.inkMuted }}>{selected ? labelFor(selected) : value ? 'Seleccionado' : `Seleccionar ${label.toLowerCase()}`}</Text>
    </Pressable>
    {open ? <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', padding: 9, gap: 7 }}>
      <TextInput accessibilityLabel={`Buscar ${label}`} value={search} onChangeText={setSearch} placeholder="Buscar…" placeholderTextColor="#95A1B2" style={{ minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 10, color: colors.ink }} />
      {loading ? <ActivityIndicator color={colors.brand} /> : null}
      {error ? <Text style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
      {options.map(item => {
        const id = String(item.id || item._id);
        const active = String(value || '') === id;
        return <Pressable key={id} onPress={() => { setSelected(item); onChange(id, item); setOpen(false); }} style={{ padding: 11, borderRadius: 9, backgroundColor: active ? colors.mintLight : colors.canvas }}>
          <Text style={{ color: colors.ink, fontWeight: '700' }}>{labelFor(item)}</Text>
          {item.email ? <Text style={{ color: colors.inkMuted, fontSize: 12 }}>{item.email}</Text> : null}
          {item.address ? <Text style={{ color: colors.inkMuted, fontSize: 12 }}>{item.address}</Text> : null}
        </Pressable>;
      })}
      {!loading && !error && !options.length ? <Text style={{ color: colors.inkMuted, padding: 8 }}>No se encontraron registros.</Text> : null}
    </View> : null}
  </View>;
}
