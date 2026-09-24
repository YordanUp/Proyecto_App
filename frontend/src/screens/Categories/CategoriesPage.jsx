import { API_URL, apiFetch } from '../../services/api';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';


export default function CategoriesPage({ session, onLogout }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCategories() {
      try {
        const token = session?.token;
        if (!token) {
          setError('Sesión no disponible.');
          setLoading(false);
          return;
        }

        const response = await apiFetch(`${API_URL}/api/categories`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const payload = await response.json();

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || 'No se pudieron cargar las categorías');
        }

        setCategories(Array.isArray(payload.data) ? payload.data : []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadCategories();
  }, [session]);

  return (
    <div className="app-shell dashboard-layout">
      <header className="topbar card">
        <div>
          <span className="eyebrow">Categorías</span>
          <h1>Categorías</h1>
        </div>

        <div className="user-area">
          <Link to="/" className="link-button">Dashboard</Link>
          <Link to="/clients" className="link-button">Clientes</Link>
          <button type="button" className="secondary" onClick={onLogout}>Cerrar sesión</button>
        </div>
      </header>

      {error ? <div className="card warning-box">{error}</div> : null}

      {loading ? (
        <div className="card">Cargando categorías...</div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan="3" className="empty-state">No hay categorías registradas.</td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td>{category.description || 'Sin descripción'}</td>
                    <td>{category.status || 'active'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
