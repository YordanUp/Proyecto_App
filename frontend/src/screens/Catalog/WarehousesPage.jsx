import CatalogManager from './CatalogManager';

export default function WarehousesPage({ session }) {
  return <CatalogManager entity="warehouses" session={session} />;
}
