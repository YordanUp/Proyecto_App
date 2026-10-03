import CatalogManager from '../Catalog/CatalogManager';

export default function CategoriesPage({ session }) {
  return <CatalogManager entity="categories" session={session} />;
}
