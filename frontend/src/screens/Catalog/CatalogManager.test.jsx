import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import CatalogManager from './CatalogManager';
import { apiRequest } from '../../services/api';

vi.mock('../../services/api', () => ({ apiRequest: vi.fn() }));

const allPermissions = [
  'products.read', 'products.create', 'products.update', 'products.delete', 'categories.read', 'categories.create', 'categories.update', 'categories.delete',
  'clients.read', 'clients.create', 'clients.update', 'clients.delete', 'suppliers.read', 'suppliers.create', 'suppliers.update', 'suppliers.delete',
  'warehouses.read', 'warehouses.create', 'warehouses.update', 'warehouses.delete'
];
const session = { token: 'test-token', user: { permissions: allPermissions } };
const categories = [{ id: 'category-1', name: 'General', status: 'active' }];
let records;

function setupApi(entity, initial = []) {
  records = [...initial];
  const endpoint = `/api/${entity}`;
  apiRequest.mockImplementation((path, options = {}) => {
    if (path.startsWith('/api/categories?limit=100')) return Promise.resolve({ data: categories });
    const cleanPath = path.split('?')[0];
    if (cleanPath === endpoint && options.method === 'POST') {
      const item = { id: `${entity}-${records.length + 1}`, status: 'active', ...JSON.parse(options.body) };
      records.push(item);
      return Promise.resolve({ data: item });
    }
    if (cleanPath.startsWith(`${endpoint}/`) && options.method === 'PUT') {
      const id = cleanPath.slice(endpoint.length + 1);
      records = records.map(item => item.id === id ? { ...item, ...JSON.parse(options.body) } : item);
      return Promise.resolve({ data: records.find(item => item.id === id) });
    }
    return Promise.resolve({ data: [...records], pagination: { page: 1, limit: 25, total: records.length, pages: records.length ? 1 : 0 } });
  });
}

function renderEntity(entity, permissions = allPermissions) {
  return render(<CatalogManager entity={entity} session={{ ...session, user: { permissions } }} />);
}

async function createRecord(entity, values) {
  setupApi(entity);
  renderEntity(entity);
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(`Nuevo ${values.singular}`, 'i') }));
  const dialog = screen.getByRole('dialog');
  for (const [label, value] of Object.entries(values.fields)) {
    if (label === 'Categoría') await within(dialog).findByRole('option', { name: value });
    fireEvent.change(within(dialog).getByLabelText(label), { target: { value: label === 'Categoría' ? 'category-1' : value } });
  }
  fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));
  await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(`/api/${entity}`, expect.objectContaining({ method: 'POST' })));
  return dialog;
}

beforeEach(() => { apiRequest.mockReset(); });

describe('catálogos web sincronizados con API', () => {
  it('CAT-WEB-001: crea producto con categoría y precios reales', async () => {
    await createRecord('products', { singular: 'producto', fields: { 'Código / SKU': 'SKU-1', Nombre: 'Producto nuevo', Categoría: 'General', 'Precio de compra': '10', 'Precio de venta': '15' } });
    const body = JSON.parse(apiRequest.mock.calls.find(([, options]) => options?.method === 'POST')[1].body);
    expect(body).toMatchObject({ code: 'SKU-1', name: 'Producto nuevo', categoryId: 'category-1', purchasePrice: 10, salePrice: 15 });
    expect(body).not.toHaveProperty('minStock');
  });

  it('CAT-WEB-002: edita producto sin enviar ni modificar stock', async () => {
    const product = { id: 'product-1', code: 'SKU-1', name: 'Producto', categoryId: 'category-1', purchasePrice: 10, salePrice: 15, minStock: 2, status: 'active' };
    setupApi('products', [product]);
    renderEntity('products');
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: 'Producto actualizado' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/products/product-1', expect.objectContaining({ method: 'PUT' })));
    const body = JSON.parse(apiRequest.mock.calls.find(([path, options]) => path === '/api/products/product-1' && options.method === 'PUT')[1].body);
    expect(body).toMatchObject({ name: 'Producto actualizado', minStock: 2 });
    expect(body).not.toHaveProperty('stock');
  });

  it('CAT-WEB-003: crea cliente', async () => {
    await createRecord('clients', { singular: 'cliente', fields: { Nombre: 'Ana Cliente', Correo: 'ana@example.com', Teléfono: '5551234567' } });
    expect(JSON.parse(apiRequest.mock.calls.find(([, options]) => options?.method === 'POST')[1].body)).toMatchObject({ name: 'Ana Cliente', email: 'ana@example.com', phone: '5551234567' });
  });

  it('CAT-WEB-004: edita cliente', async () => {
    setupApi('clients', [{ id: 'client-1', name: 'Ana', email: 'ana@example.com', phone: '555', status: 'active' }]);
    renderEntity('clients');
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: 'Ana Editada' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/clients/client-1', expect.objectContaining({ method: 'PUT' })));
  });

  it('CAT-WEB-005: crea proveedor', async () => {
    await createRecord('suppliers', { singular: 'proveedor', fields: { Nombre: 'Proveedor Uno', Correo: 'proveedor@example.com', Teléfono: '5559876543' } });
    expect(JSON.parse(apiRequest.mock.calls.find(([, options]) => options?.method === 'POST')[1].body)).toMatchObject({ name: 'Proveedor Uno', email: 'proveedor@example.com', phone: '5559876543' });
  });

  it('CAT-WEB-006: edita proveedor', async () => {
    setupApi('suppliers', [{ id: 'supplier-1', name: 'Proveedor', email: 'p@example.com', phone: '', status: 'active' }]);
    renderEntity('suppliers');
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: 'Proveedor Editado' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/suppliers/supplier-1', expect.objectContaining({ method: 'PUT' })));
  });

  it('CAT-WEB-007: crea categoría', async () => {
    await createRecord('categories', { singular: 'categoría', fields: { Nombre: 'Categoría Uno', Descripción: 'Descripción de prueba' } });
    expect(JSON.parse(apiRequest.mock.calls.find(([, options]) => options?.method === 'POST')[1].body)).toMatchObject({ name: 'Categoría Uno', description: 'Descripción de prueba' });
  });

  it('CAT-WEB-008: edita categoría', async () => {
    setupApi('categories', [{ id: 'category-1', name: 'General', description: '', status: 'active' }]);
    renderEntity('categories');
    fireEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: 'Nueva categoría' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/categories/category-1', expect.objectContaining({ method: 'PUT' })));
  });

  it('CAT-WEB-009: crea almacén sin mezclar existencias', async () => {
    await createRecord('warehouses', { singular: 'almacén', fields: { Nombre: 'Almacén Norte', Dirección: 'Calle 1' } });
    expect(JSON.parse(apiRequest.mock.calls.find(([, options]) => options?.method === 'POST')[1].body)).toMatchObject({ name: 'Almacén Norte', address: 'Calle 1' });
    expect(apiRequest).not.toHaveBeenCalledWith(expect.stringContaining('/api/inventory'), expect.anything());
  });

  it('CAT-WEB-010: oculta acciones sin permisos de escritura', async () => {
    setupApi('clients', [{ id: 'client-1', name: 'Ana', status: 'active' }]);
    renderEntity('clients', ['clients.read']);
    await screen.findByText('Ana');
    expect(screen.queryByRole('button', { name: /nuevo cliente/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument();
  });

  it('CAT-WEB-011: muestra de forma clara conflicto por duplicado HTTP 409', async () => {
    setupApi('categories');
    apiRequest.mockImplementation((path, options = {}) => {
      if (path.includes('/api/categories?')) return Promise.resolve({ data: [] });
      if (options.method === 'POST') return Promise.reject(Object.assign(new Error('Ya existe una categoría con ese nombre.'), { status: 409, code: 'DUPLICATE_RECORD' }));
      return Promise.resolve({ data: [], pagination: { total: 0, pages: 0 } });
    });
    renderEntity('categories');
    fireEvent.click(await screen.findByRole('button', { name: /nuevo categoría/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nombre'), { target: { value: 'Repetida' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Ya existe una categoría con ese nombre.');
    expect(within(dialog).queryByText(/stack|trace/i)).not.toBeInTheDocument();
  });

  it('CAT-WEB-012: refresca la lista al terminar la creación', async () => {
    await createRecord('clients', { singular: 'cliente', fields: { Nombre: 'Cliente Nuevo' } });
    expect(await screen.findByText('Cliente Nuevo')).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('creado correctamente');
    expect(apiRequest.mock.calls.filter(([path, options]) => path.startsWith('/api/clients?') && !options?.method).length).toBeGreaterThanOrEqual(2);
  });
});
