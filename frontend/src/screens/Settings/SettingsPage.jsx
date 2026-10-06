import { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { hasPermission } from '../../services/permissions';

const options = {
  currency: ['MXN', 'USD', 'EUR'],
  timezone: ['America/Mexico_City', 'UTC'],
  date_format: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']
};

export default function SettingsPage({ session }) {
  const [settings, setSettings] = useState([]);
  const [editingKey, setEditingKey] = useState(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const canUpdate = hasPermission(session?.user, 'settings.update');

  async function loadSettings() {
    setLoading(true); setError('');
    try {
      const response = await apiRequest('/api/settings');
      setSettings(Array.isArray(response.data) ? response.data : []);
    } catch (loadError) { setError(loadError.message || 'No se pudo cargar la configuración.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadSettings(); }, [session?.token]);

  function beginEdit(setting) {
    setEditingKey(setting.key); setDraft(String(setting.value)); setError(''); setSuccess('');
  }

  async function saveSetting(setting) {
    setSaving(true); setError(''); setSuccess('');
    try {
      const response = await apiRequest(`/api/settings/${encodeURIComponent(setting.key)}`, { method: 'PUT', body: JSON.stringify({ value: draft }) });
      setSettings(current => current.map(item => item.key === setting.key ? response.data : item));
      setEditingKey(null); setSuccess(`${setting.label} guardado correctamente.`);
    } catch (saveError) { setError(saveError.message || 'No se pudo guardar la configuración.'); }
    finally { setSaving(false); }
  }

  return <div className="app-shell dashboard-layout settings-page">
    <div className="page-heading"><div><span className="eyebrow">Preferencias del sistema</span><h2>Configuración general</h2><p>Administra las preferencias generales persistidas del ERP.</p></div></div>
    {error ? <div className="card warning-box" role="alert">{error}</div> : null}
    {success ? <div className="card settings-success" role="status">{success}</div> : null}
    {loading ? <div className="card" role="status">Cargando configuración...</div> : settings.length ? <div className="card">
      <table className="data-table">
        <thead><tr><th>Preferencia</th><th>Valor</th><th>Acción</th></tr></thead>
        <tbody>{settings.map(setting => <tr key={setting.key}>
          <td>{setting.label}</td>
          <td>{editingKey === setting.key ? options[setting.key]
            ? <select aria-label={setting.label} value={draft} onChange={event => setDraft(event.target.value)}>{options[setting.key].map(value => <option key={value} value={value}>{value}</option>)}</select>
            : <input aria-label={setting.label} value={draft} maxLength={120} onChange={event => setDraft(event.target.value)} />
            : <span>{String(setting.value)}</span>}</td>
          <td>{editingKey === setting.key ? <div className="settings-actions"><button type="button" disabled={saving || !draft.trim()} onClick={() => saveSetting(setting)}>{saving ? 'Guardando…' : 'Guardar cambios'}</button><button type="button" className="secondary" disabled={saving} onClick={() => setEditingKey(null)}>Cancelar</button></div>
            : canUpdate ? <button type="button" className="secondary" onClick={() => beginEdit(setting)}>Editar</button> : <span>Solo lectura</span>}</td>
        </tr>)}</tbody>
      </table>
    </div> : <div className="card" role="status">No hay preferencias sincronizadas. Ejecuta <code>npm run db:sync-settings -- --apply</code> en backend.</div>}
  </div>;
}
