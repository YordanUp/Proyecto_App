import { useEffect, useState } from 'react';
import CatalogManager from './CatalogManager';

const choices = [
  { entity: 'clients', label: 'Clientes', permission: 'clients.read' },
  { entity: 'suppliers', label: 'Proveedores', permission: 'suppliers.read' }
];

export default function CatalogPage({ session }) {
  const [activeEntity, setActiveEntity] = useState('clients');
  const permissions = session?.user?.permissions || [];
  const visibleChoices = choices.filter(choice => permissions.includes(choice.permission));
  const visibleChoiceKey = visibleChoices.map(choice => choice.entity).join('|');

  useEffect(() => {
    if (visibleChoices.length && !visibleChoices.some(choice => choice.entity === activeEntity)) setActiveEntity(visibleChoices[0].entity);
  }, [activeEntity, visibleChoiceKey]);

  return (
    <div className="catalog-section-page">
      <div className="catalog-tabs" role="tablist" aria-label="Catálogos de personas y proveedores">
        {visibleChoices.map(choice => <button key={choice.entity} role="tab" type="button" aria-selected={activeEntity === choice.entity} className={activeEntity === choice.entity ? 'active' : ''} onClick={() => setActiveEntity(choice.entity)}>{choice.label}</button>)}
      </div>
      <CatalogManager key={activeEntity} entity={activeEntity} session={session} />
    </div>
  );
}
