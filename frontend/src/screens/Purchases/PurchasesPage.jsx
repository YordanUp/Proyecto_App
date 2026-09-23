import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function PurchasesPage({ session, onLogout }) {
  const [orders, setOrders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadPurchases() {
      try {
        const token = session?.token;
        if (!token) {
          setError('Sesión no disponible.');
          setLoading(false);
          return;
        }

        const [ordersResponse, purchasesResponse] = await Promise.all([
          fetch(`${API_URL}/api/purchases/orders`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_URL}/api/purchases`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        const ordersPayload = await ordersResponse.json();
        const purchasesPayload = await purchasesResponse.json();

        if (!ordersResponse.ok || !ordersPayload?.success) {
          throw new Error(ordersPayload?.message || 'No se pudieron cargar las órdenes de compra');
        }

        if (!purchasesResponse.ok || !purchasesPayload?.success) {
          throw new Error(purchasesPayload?.message || 'No se pudieron cargar las compras');
        }

        setOrders(Array.isArray(ordersPayload.data) ? ordersPayload.data : []);
        setPurchases(Array.isArray(purchasesPayload.data) ? purchasesPayload.data : []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadPurchases();
  }, [session]);

  return (
    <div className="app-shell dashboard-layout">
      <header className="topbar card">
        <div>
          <span className="eyebrow">Compras</span>
          <h1>Órdenes y compras</h1>
        </div>

        <div className="user-area">
          <Link to="/" className="link-button">Dashboard</Link>
          <Link to="/sales" className="link-button">Ventas</Link>
          <button type="button" className="secondary" onClick={onLogout}>Cerrar sesión</button>
        </div>
      </header>

      {error ? <div className="card warning-box">{error}</div> : null}

      {loading ? (
        <div className="card">Cargando compras...</div>
      ) : (
        <>
          <div className="card">
            <h3>Órdenes de compra</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Proveedor</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-state">No hay órdenes de compra.</td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.id}</td>
                      <td>{order.supplierId}</td>
                      <td>${Number(order.total || 0).toLocaleString()}</td>
                      <td>{order.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>Compras registradas</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Proveedor</th>
                  <th>Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="empty-state">No hay compras registradas.</td>
                  </tr>
                ) : (
                  purchases.map((purchase) => (
                    <tr key={purchase.id}>
                      <td>{purchase.id}</td>
                      <td>{purchase.supplierId}</td>
                      <td>${Number(purchase.total || 0).toLocaleString()}</td>
                      <td>{purchase.status}</td>
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
