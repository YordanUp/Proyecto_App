import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import { apiRequest } from '../../services/api';

vi.mock('../../services/api', () => ({ apiRequest: vi.fn() }));

describe('DashboardPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders persisted KPI metrics and operational lists', async () => {
    apiRequest.mockResolvedValue({ data: {
      metrics: { salesToday: 100, salesMonth: 1200, salesCountToday: 2, confirmedSalesCount: 12, pendingPurchases: 3, receivedPurchasesMonth: 4, lowStockCount: 1, outOfStockCount: 0, receivables: { count: 2, balance: 80 }, payables: { count: 1, balance: 25 } },
      recentSales: [{ id: 'sale-1', folio: 'V-001', customer: { name: 'Cliente real' }, confirmedAt: '2026-10-01T10:00:00Z', total: 100 }],
      recentFinancialMovements: [{ id: 'movement-1', direction: 'IN', referenceId: { folio: 'V-001' }, createdAt: '2026-10-01T10:00:00Z', amount: 20 }],
      stockAlerts: [{ _id: 'stock-1', product: { name: 'Producto real', code: 'P-1' }, warehouse: { name: 'Central' }, quantity: 1, reservedQuantity: 0, minimumStock: 2 }]
    } });
    render(<MemoryRouter><DashboardPage session={{ token: 'session-token', user: { name: 'Ada' } }} /></MemoryRouter>);
    expect(await screen.findByText('Ventas de hoy')).toBeInTheDocument();
    expect(screen.getByText('Cliente real')).toBeInTheDocument();
    expect(screen.getByText('Producto real')).toBeInTheDocument();
    expect(screen.getByText('Movimientos financieros recientes')).toBeInTheDocument();
    expect(screen.queryByText(/datos de muestra/i)).not.toBeInTheDocument();
  });

  it('shows loading, empty and error states', async () => {
    let resolve;
    apiRequest.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const { rerender } = render(<MemoryRouter><DashboardPage session={{ token: 'session-token' }} /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando indicadores');
    resolve({ data: { metrics: {}, recentSales: [], recentFinancialMovements: [], stockAlerts: [] } });
    expect(await screen.findByText('Sin ventas confirmadas.')).toBeInTheDocument();

    apiRequest.mockRejectedValueOnce(new Error('API no disponible'));
    rerender(<MemoryRouter><DashboardPage session={{ token: 'another-token' }} /></MemoryRouter>);
    expect(await screen.findByRole('alert')).toHaveTextContent('API no disponible');
  });
});
