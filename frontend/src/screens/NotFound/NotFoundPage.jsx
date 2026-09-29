import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="not-found-shell">
      <div className="card not-found-card">
        <img src="/brand/logo-yordanup.png" alt="Logo YordanUp" />
        <span className="eyebrow">YordanUp ERP</span>
        <h1>404</h1>
        <p>La página que buscas no existe en el ERP.</p>
        <Link to="/" className="link-button">Volver al inicio</Link>
      </div>
    </div>
  );
}
