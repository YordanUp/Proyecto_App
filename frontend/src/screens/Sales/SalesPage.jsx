import { API_URL, apiFetch } from '../../services/api';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';


export default function SalesPage({ session, onLogout }) {
  const [quotations, setQuotations] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadSales() {
      try {
        const token = session?.token;
        if (!token) {
          setError('Sesión no disponible.');
          setLoading(false);
          return;
        }

        const [quotationsResponse, salesResponse] = await Promise.all([
          apiFetch(`${API_URL}/api/sales/quotations`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          apiFetch(`${API_URL}/api/sales/sales`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        const quotationsPayload = await quotationsResponse.json();
        const salesPayload = await salesResponse.json();

        if (!quotationsResponse.ok || !quotationsPayload?.success) {
          throw new Error(quotationsPayload?.message || 'No se pudieron cargar las cotizaciones');
        }

        if (!salesResponse.ok || !salesPayload?.success) {
          throw new Error(salesPayload?.message || 'No se pudieron cargar las ventas');
        }

        setQuotations(Array.isArray(quotationsPayload.data) ? quotationsPayload.data : []);
        setSales(Array.isArray(salesPayload.data) ? salesPayload.data : []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadSales();
  }, [session]);

  return (
    <div className="app-shell dashboard-layout">
      <header className="topbar card">
        <div>
          <span className="eyebrow">Ventas</span>
          <h1>Cotizaciones y ventas</h1>
        </div>

        <div className="user-area">
          <Link to="/" className="link-button">Dashboard</Link>
          <Link to="/products" className="link-button">Productos</Link>
          <button type="button" className="secondary" onClick={onLogout}>Cerrar sesión</button>
        </div>
      </header>

      {error ? <div className="card warning-box">{error}</div> : null}

      {loading ? (
        <div className="card">Cargando ventas...</div>
      ) : (
        <>
          <div className="card">
            <h3>Cotizaciones</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {quotations.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-state">No hay cotizaciones.</td>
                  </tr>
                ) : (
                  quotations.map((quotation) => (
                    <tr key={quotation.id}>
                      <td>{quotation.id}</td>
                      <td>{quotation.customerId}</td>
                      <td>${Number(quotation.total || 0).toLocaleString()}</td>
                      <td>{quotation.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>Ventas</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-state">No hay ventas registradas.</td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{sale.id}</td>
                      <td>{sale.customerId}</td>
                      <td>${Number(sale.total || 0).toLocaleString()}</td>
                      <td>{sale.status}</td>
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
