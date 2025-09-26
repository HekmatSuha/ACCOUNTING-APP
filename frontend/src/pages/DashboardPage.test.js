import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import DashboardPage from './DashboardPage';
import axiosInstance from '../utils/axiosInstance';

jest.mock('../utils/axiosInstance', () => ({
  get: jest.fn(),
}));

jest.mock('../config/currency', () => ({
  getBaseCurrency: jest.fn(() => 'USD'),
  loadBaseCurrency: jest.fn(() => Promise.resolve('USD')),
}));

jest.mock('../components/BankAccountsOverview', () => () => <div data-testid="bank-accounts-overview" />);
jest.mock('../components/RecentActivities', () => () => <div data-testid="recent-activities" />);

describe('DashboardPage currency breakdowns', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders per-currency breakdown values for dashboard metrics', async () => {
    const summary = {
      total_receivables: '260.00',
      total_receivables_breakdown: { USD: '60.00', EUR: '200.00' },
      total_payables: '100.00',
      total_payables_breakdown: { USD: '100.00' },
      turnover: '300.00',
      turnover_breakdown: { USD: '100.00', EUR: '200.00' },
      expenses: '80.00',
      expenses_breakdown: { USD: '80.00' },
      stock_value: '50.00',
      stock_value_breakdown: { USD: '50.00' },
      customer_count: 2,
      today_sales: '300.00',
      today_sales_breakdown: { USD: '100.00', EUR: '200.00' },
      today_incoming: '40.00',
      today_incoming_breakdown: { USD: '40.00' },
    };

    axiosInstance.get.mockResolvedValueOnce({ data: summary });

    render(<DashboardPage />);

    await waitFor(() => expect(axiosInstance.get).toHaveBeenCalledWith('/dashboard-summary/'));

    const receivablesLabel = await screen.findByText('Receivables');
    const receivablesSection = receivablesLabel.closest('div').parentElement;
    expect(within(receivablesSection).getByText('$60.00, €200.00')).toBeInTheDocument();
    expect(within(receivablesSection).getByText('USD')).toBeInTheDocument();
    expect(within(receivablesSection).getByText('EUR')).toBeInTheDocument();

    const expensesLabel = screen.getByText('Expenses');
    const expensesSection = expensesLabel.closest('div').parentElement;
    expect(within(expensesSection).getByText('USD')).toBeInTheDocument();

    const turnoverLabel = screen.getByText('Turnover');
    const turnoverSection = turnoverLabel.closest('div').parentElement;
    expect(within(turnoverSection).getByText('EUR')).toBeInTheDocument();
  });
});
