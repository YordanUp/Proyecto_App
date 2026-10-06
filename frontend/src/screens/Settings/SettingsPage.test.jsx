import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SettingsPage from './SettingsPage';
import { apiRequest } from '../../services/api';

vi.mock('../../services/api', () => ({ apiRequest: vi.fn() }));

const settings = [
  { key: 'company_name', label: 'Nombre de la empresa', value: 'ERP Modular', type: 'text' },
  { key: 'currency', label: 'Moneda', value: 'MXN', type: 'select' },
  { key: 'timezone', label: 'Zona horaria', value: 'America/Mexico_City', type: 'select' },
  { key: 'date_format', label: 'Formato de fecha', value: 'DD/MM/YYYY', type: 'select' }
];
const admin = { token: 'token', user: { permissions: ['settings.read', 'settings.update'] } };

beforeEach(() => { apiRequest.mockReset(); });

test('SET-WEB-001 carga configuración persistente', async () => {
  apiRequest.mockResolvedValue({ success: true, data: settings });
  render(<SettingsPage session={admin} />);
  expect(await screen.findByText('ERP Modular')).toBeInTheDocument();
  expect(screen.getByText('America/Mexico_City')).toBeInTheDocument();
  expect(screen.queryByText(/inventory_negative/i)).not.toBeInTheDocument();
  expect(apiRequest).toHaveBeenCalledWith('/api/settings');
});

test('SET-WEB-002/003 edita y guarda company_name mediante PUT', async () => {
  apiRequest.mockImplementation(async (path, options = {}) => {
    if (path === '/api/settings') return { data: settings };
    if (path === '/api/settings/company_name' && options.method === 'PUT') return { data: { ...settings[0], value: 'YordanUp' } };
    throw new Error(`Unexpected request ${path}`);
  });
  render(<SettingsPage session={admin} />);
  fireEvent.click(await screen.findAllByRole('button', { name: 'Editar' }).then(buttons => buttons[0]));
  fireEvent.change(screen.getByLabelText('Nombre de la empresa'), { target: { value: 'YordanUp' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(await screen.findByRole('status')).toHaveTextContent('guardado correctamente');
  expect(apiRequest).toHaveBeenCalledWith('/api/settings/company_name', { method: 'PUT', body: JSON.stringify({ value: 'YordanUp' }) });
  expect(screen.getByText('YordanUp')).toBeInTheDocument();
});

test('SET-WEB-004 presenta modo de solo lectura sin settings.update', async () => {
  apiRequest.mockResolvedValue({ data: settings });
  render(<SettingsPage session={{ token: 'token', user: { permissions: ['settings.read'] } }} />);
  expect(await screen.findAllByText('Solo lectura')).toHaveLength(4);
  expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
});

test('SET-WEB-005 muestra error del backend sin sustituirlo por defaults', async () => {
  apiRequest.mockRejectedValue(new Error('Servicio no disponible'));
  render(<SettingsPage session={admin} />);
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Servicio no disponible'));
  expect(screen.queryByText('ERP Modular')).not.toBeInTheDocument();
});
