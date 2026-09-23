import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function InventoryPage({ session, onLogout }) {
  const [inventory, setInventory] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadInventory() {
      try {
        const token = session?.token;
        if (!token) {
          setError('Sesión no disponible.');
          setLoading(false);
          return;
        }

        const [inventoryResponse, warehouseResponse] = await Promise.all([
          fetch(`${API_URL}/api/inventory`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_URL}/api/inventory/warehouses`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        const inventoryPayload = await inventoryResponse.json();
        const warehousePayload = await warehouseResponse.json();

        if (!inventoryResponse.ok || !inventoryPayload?.success) {
          throw new Error(inventoryPayload?.message || 'No se pudo cargar el inventario');
        }

        if (!warehouseResponse.ok || !warehousePayload?.success) {
          throw new Error(warehousePayload?.message || 'No se pudo cargar los almacenes');
        }

        setInventory(Array.isArray(inventoryPayload.data) ? inventoryPayload.data : []);
        setWarehouses(Array.isArray(warehousePayload.data) ? warehousePayload.data : []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadInventory();
  }, [session]);

  return (
    <div className="app-shell dashboard-layout">
      <header className="topbar card">
        <div>
          <span className="eyebrow">Inventario</span>
          <h1>Stock y almacenes</h1>
        </div>

        <div className="user-area">
          <Link to="/" className="link-button">Dashboard</Link>
          <Link to="/products" className="link-button">Productos</Link>
          <button type="button" className="secondary" onClick={onLogout}>Cerrar sesión</button>
        </div>
      </header>

      {error ? <div className="card warning-box">{error}</div> : null}

      {loading ? (
        <div className="card">Cargando inventario...</div>
      ) : (
        <>
          <div className="card">
            <h3>Almacenes</h3>
            <div className="chip-list">
              {warehouses.map((warehouse) => (
                <span key={warehouse.id} className="chip">{warehouse.name}</span>
              ))}
            </div>
          </div>

          <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Almacén</th>
                  <th>Stock</th>
                  <th>Mínimo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {inventory.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-state">No hay registro de inventario.</td>
                  </tr>
                ) : (
                  inventory.map((item) => (
                    <tr key={item.id}>
                      <td>{item.productId}</td>
                      <td>{item.warehouseId}</td>
                      <td>{item.stock}</td>
                      <td>{item.minStock}</td>
                      <td>{item.status}</td>
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
