import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const defaultSettings = [
  {
    key: 'company_name',
    label: 'Nombre de la empresa',
    value: 'ERP Modular',
    type: 'text'
  },
  {
    key: 'currency',
    label: 'Moneda base',
    value: 'USD',
    type: 'select'
  },
  {
    key: 'timezone',
    label: 'Zona horaria',
    value: 'UTC-5',
    type: 'text'
  },
  {
    key: 'inventory_negative',
    label: 'Permitir stock negativo',
    value: false,
    type: 'boolean'
  }
];

export default function SettingsPage({ session, onLogout }) {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const token = session?.token;
      if (!token) {
        setError('Sesión no disponible.');
        return;
      }

      setSettings((current) => current.length ? current : defaultSettings);
    } catch (loadError) {
      setError(loadError.message || 'No se pudieron cargar los ajustes.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  function handleToggle(key) {
    setSettings((current) =>
      current.map((item) =>
        item.key === key ? { ...item, value: !item.value } : item
      )
    );
  }

  return (
    <div className="app-shell dashboard-layout">
      <header className="topbar card">
        <div>
          <span className="eyebrow">Sistema</span>
          <h1>Configuración del sistema</h1>
        </div>

        <div className="user-area">
          <Link to="/" className="link-button">Dashboard</Link>
          <button type="button" className="secondary" onClick={onLogout}>Cerrar sesión</button>
        </div>
      </header>

      {error ? <div className="card warning-box">{error}</div> : null}

      {loading ? (
        <div className="card">Cargando configuración...</div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Parámetro</th>
                <th>Valor</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((item) => (
                <tr key={item.key}>
                  <td>{item.label}</td>
                  <td>
                    {item.type === 'boolean' ? (
                      <span>{item.value ? 'Activado' : 'Desactivado'}</span>
                    ) : (
                      <span>{String(item.value)}</span>
                    )}
                  </td>
                  <td>
                    {item.type === 'boolean' ? (
                      <button type="button" className="secondary" onClick={() => handleToggle(item.key)}>
                        {item.value ? 'Desactivar' : 'Activar'}
                      </button>
                    ) : (
                      <button type="button" className="secondary" disabled>
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
