import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsPage from './ReportsPage';
import { apiRequest } from '../../services/api';

vi.mock('../../services/api', () => ({ API_URL: 'http://localhost:4000', apiRequest: vi.fn() }));

describe('ReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiRequest.mockResolvedValue({ success: true, data: [], pagination: { page: 1, limit: 25, total: 0, pages: 0 }, totals: {} });
  });

  it('loads operational report data and sends selected filters to the API', async () => {
    render(<ReportsPage />);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/reports/data/sales?page=1&limit=25'));

    fireEvent.change(screen.getByLabelText('Tipo de reporte'), { target: { value: 'inventory-stock' } });
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith('/api/reports/data/inventory-stock?page=1&limit=25'));
    fireEvent.click(screen.getByLabelText(/Solo bajo mínimo/i));
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith('/api/reports/data/inventory-stock?page=1&limit=25&lowStock=true'));
    expect(screen.getByRole('button', { name: /Exportar CSV/i })).toBeInTheDocument();
  });

  it('loads a sales return report with customer and sale filters', async () => {
    render(<ReportsPage />);
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/api/reports/data/sales?page=1&limit=25'));
    fireEvent.change(screen.getByLabelText('Tipo de reporte'), { target: { value: 'sales-returns' } });
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith('/api/reports/data/sales-returns?page=1&limit=25'));
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'cliente-123' } });
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith('/api/reports/data/sales-returns?page=1&limit=25&customerId=cliente-123'));
    fireEvent.change(screen.getByLabelText('Venta'), { target: { value: '507f1f77bcf86cd799439011' } });
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith('/api/reports/data/sales-returns?page=1&limit=25&customerId=cliente-123&saleId=507f1f77bcf86cd799439011'));
  });

  it('paginates server results and exports filtered CSV', async () => {
    apiRequest.mockResolvedValueOnce({ success: true, data: [{ id: '1', folio: 'V-001', status: 'confirmed' }], pagination: { page: 1, limit: 25, total: 26, pages: 2 }, totals: { total: 50 } });
    apiRequest.mockResolvedValueOnce({ success: true, data: [{ id: '2', folio: 'V-002', status: 'confirmed' }], pagination: { page: 2, limit: 25, total: 26, pages: 2 }, totals: { total: 50 } });
    localStorage.setItem('erp_token', 'report-token');
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['Folio\r\nV-001']) });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<ReportsPage />);
    expect(await screen.findByText('V-001')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(apiRequest).toHaveBeenLastCalledWith('/api/reports/data/sales?page=2&limit=25'));
    expect(await screen.findByText('V-002')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('http://localhost:4000/api/reports/data/sales/export.csv?', { headers: { Authorization: 'Bearer report-token' } }));
    expect(await screen.findByRole('status')).toHaveTextContent('CSV exportado');
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it('shows errors returned by the API layer', async () => {
    apiRequest.mockRejectedValueOnce(new Error('Acceso denegado'));
    render(<ReportsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso denegado');
  });
});
