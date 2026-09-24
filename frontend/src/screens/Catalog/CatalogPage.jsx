import { API_URL, apiFetch } from '../../services/api';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';


export default function CatalogPage({ session, onLogout }) {
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCatalog() {
      try {
        const token = session?.token;
        if (!token) {
          setError('Sesión no disponible.');
          setLoading(false);
          return;
        }

        const [clientsResponse, suppliersResponse, categoriesResponse] = await Promise.all([
          apiFetch(`${API_URL}/api/clients`, { headers: { Authorization: `Bearer ${token}` } }),
          apiFetch(`${API_URL}/api/suppliers`, { headers: { Authorization: `Bearer ${token}` } }),
          apiFetch(`${API_URL}/api/categories`, { headers: { Authorization: `Bearer ${token}` } })
        ]);

        const clientsPayload = await clientsResponse.json();
        const suppliersPayload = await suppliersResponse.json();
        const categoriesPayload = await categoriesResponse.json();

        if (!clientsResponse.ok || !clientsPayload?.success) {
          throw new Error(clientsPayload?.message || 'No se pudieron cargar los clientes');
        }

        if (!suppliersResponse.ok || !suppliersPayload?.success) {
          throw new Error(suppliersPayload?.message || 'No se pudieron cargar los proveedores');
        }

        if (!categoriesResponse.ok || !categoriesPayload?.success) {
          throw new Error(categoriesPayload?.message || 'No se pudieron cargar las categorías');
        }

        setClients(Array.isArray(clientsPayload.data) ? clientsPayload.data : []);
        setSuppliers(Array.isArray(suppliersPayload.data) ? suppliersPayload.data : []);
        setCategories(Array.isArray(categoriesPayload.data) ? categoriesPayload.data : []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadCatalog();
  }, [session]);

  return (
    <div className="app-shell dashboard-layout">
      <header className="topbar card">
        <div>
          <span className="eyebrow">Catálogo</span>
          <h1>Clientes y proveedores</h1>
        </div>

        <div className="user-area">
          <Link to="/" className="link-button">Dashboard</Link>
          <Link to="/products" className="link-button">Productos</Link>
          <button type="button" className="secondary" onClick={onLogout}>Cerrar sesión</button>
        </div>
      </header>

      {error ? <div className="card warning-box">{error}</div> : null}

      {loading ? (
        <div className="card">Cargando catálogo...</div>
      ) : (
        <>
          <div className="card">
            <h3>Clientes</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Tipo</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-state">No hay clientes registrados.</td>
                  </tr>
                ) : (
                  clients.map((client) => (
                    <tr key={client.id}>
                      <td>{client.name}</td>
                      <td>{client.email}</td>
                      <td>{client.phone}</td>
                      <td>{client.type}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>Proveedores</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Rubro</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-state">No hay proveedores registrados.</td>
                  </tr>
                ) : (
                  suppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td>{supplier.name}</td>
                      <td>{supplier.email}</td>
                      <td>{supplier.phone}</td>
                      <td>{supplier.category}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
