import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function FinancePage({ session, onLogout }) {
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadFinance() {
      try {
        const token = session?.token;
        if (!token) {
          setError('Sesión no disponible.');
          setLoading(false);
          return;
        }

        const [accountsResponse, paymentsResponse] = await Promise.all([
          fetch(`${API_URL}/api/finance/accounts`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`${API_URL}/api/finance/payments`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        const accountsPayload = await accountsResponse.json();
        const paymentsPayload = await paymentsResponse.json();

        if (!accountsResponse.ok || !accountsPayload?.success) {
          throw new Error(accountsPayload?.message || 'No se pudieron cargar las cuentas');
        }

        if (!paymentsResponse.ok || !paymentsPayload?.success) {
          throw new Error(paymentsPayload?.message || 'No se pudieron cargar los pagos');
        }

        setAccounts(Array.isArray(accountsPayload.data) ? accountsPayload.data : []);
        setPayments(Array.isArray(paymentsPayload.data) ? paymentsPayload.data : []);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadFinance();
  }, [session]);

  return (
    <div className="app-shell dashboard-layout">
      <header className="topbar card">
        <div>
          <span className="eyebrow">Finanzas</span>
          <h1>Cuentas y pagos</h1>
        </div>

        <div className="user-area">
          <Link to="/" className="link-button">Dashboard</Link>
          <Link to="/purchases" className="link-button">Compras</Link>
          <button type="button" className="secondary" onClick={onLogout}>Cerrar sesión</button>
        </div>
      </header>

      {error ? <div className="card warning-box">{error}</div> : null}

      {loading ? (
        <div className="card">Cargando finanzas...</div>
      ) : (
        <>
          <div className="card">
            <h3>Cuentas</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-state">No hay cuentas registradas.</td>
                  </tr>
                ) : (
                  accounts.map((account) => (
                    <tr key={account.id}>
                      <td>{account.code}</td>
                      <td>{account.name}</td>
                      <td>{account.type}</td>
                      <td>${Number(account.balance || 0).toLocaleString()}</td>
                      <td>{account.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="card">
            <h3>Pagos</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th>Referencia</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-state">No hay pagos registrados.</td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.id}</td>
                      <td>{payment.type}</td>
                      <td>${Number(payment.amount || 0).toLocaleString()}</td>
                      <td>{payment.reference}</td>
                      <td>{payment.status}</td>
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
