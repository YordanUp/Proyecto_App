export default function NotFoundPage() {
  return (
    <div className="app-shell">
      <div className="card" style={{ maxWidth: 500, margin: '80px auto', textAlign: 'center' }}>
        <h1>404</h1>
        <p>La página que buscas no existe en el ERP.</p>
        <button type="button" className="secondary">Volver al inicio</button>
      </div>
    </div>
  );
}
