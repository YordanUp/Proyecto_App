import CatalogManager from '../Catalog/CatalogManager';

export default function ProductsPage({ session }) {
  return <CatalogManager entity="products" session={session} />;
}
