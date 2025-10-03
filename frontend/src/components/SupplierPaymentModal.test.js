import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SupplierPaymentModal from './SupplierPaymentModal';
import axiosInstance from '../utils/axiosInstance';

jest.mock('../utils/axiosInstance', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

describe('SupplierPaymentModal', () => {
  const defaultProps = {
    show: true,
    handleClose: jest.fn(),
    supplierId: 1,
    onPaymentAdded: jest.fn(),
    supplierCurrency: 'USD',
    payment: null,
  };

  beforeEach(() => {
    axiosInstance.get.mockImplementation((url) => {
      if (url === 'accounts/') {
        return Promise.resolve({
          data: [
            { id: 1, name: 'USD Account', currency: 'USD' },
            { id: 2, name: 'EUR Account', currency: 'EUR' },
          ],
        });
      }
      if (url === '/currencies/') {
        return Promise.resolve({
          data: [
            { id: 1, code: 'USD', name: 'US Dollar', exchange_rate: '1', is_base_currency: true },
            { id: 2, code: 'EUR', name: 'Euro', exchange_rate: '0.900000', is_base_currency: false },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders correctly for a new payment', async () => {
    render(<SupplierPaymentModal {...defaultProps} />);
    await screen.findByText('Record Payment');
    expect(screen.getByLabelText(/^Amount$/)).toHaveValue(null);
  });

  test('shows exchange rate fields when payment currency and account currency differ', async () => {
    render(<SupplierPaymentModal {...defaultProps} />);
    await screen.findByText('Record Payment');

    fireEvent.change(screen.getByLabelText('Account'), { target: { value: '2' } }); // EUR Account

    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'USD' } });

    fireEvent.change(screen.getByLabelText(/^Amount$/), { target: { value: '100' } });

    const exchangeRateInput = await screen.findByLabelText(/Exchange Rate/i);
    expect(exchangeRateInput).toBeInTheDocument();

    fireEvent.change(exchangeRateInput, { target: { value: '0.9' } });

    await waitFor(() => {
      expect(screen.getByLabelText(/Converted Amount/)).toHaveValue('90.00');
    });
  });

  test('hides exchange rate fields when payment and account currencies are the same', async () => {
    render(<SupplierPaymentModal {...defaultProps} />);
    await screen.findByText('Record Payment');

    fireEvent.change(screen.getByLabelText('Account'), { target: { value: '1' } }); // USD Account

    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'USD' } });

    expect(screen.queryByLabelText(/Exchange Rate/i)).toBeNull();
  });

  test('submits correct data when creating a new payment with currency conversion', async () => {
    axiosInstance.post.mockResolvedValue({ data: {} });
    render(<SupplierPaymentModal {...defaultProps} />);
    await screen.findByText('Record Payment');

    fireEvent.change(screen.getByLabelText('Account'), { target: { value: '2' } }); // EUR Account
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'USD' } });
    fireEvent.change(screen.getByLabelText(/^Amount$/), { target: { value: '120' } });

    const exchangeRateInput = await screen.findByLabelText(/Exchange Rate/i);
    fireEvent.change(exchangeRateInput, { target: { value: '0.95' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Payment/i }));

    await waitFor(() => {
      expect(axiosInstance.post).toHaveBeenCalledWith(
        'suppliers/1/payments/',
        expect.objectContaining({
          original_amount: 120,
          original_currency: 'USD',
          account: 2,
          account_exchange_rate: 0.95,
          account_converted_amount: 114,
          expense_date: expect.any(String),
          description: '',
        })
      );
    });
  });
});
