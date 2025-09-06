import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CustomerPaymentModal from './CustomerPaymentModal';
import axiosInstance from '../utils/axiosInstance';

jest.mock('../utils/axiosInstance', () => ({
  get: jest.fn(),
}));

describe('CustomerPaymentModal currency display', () => {
  const defaultProps = {
    show: true,
    handleClose: jest.fn(),
    customerId: 1,
    onPaymentAdded: jest.fn(),
    customerCurrency: 'USD',
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('shows converted amount when account currency differs', async () => {
    axiosInstance.get.mockResolvedValueOnce({
      data: [{ id: 1, name: 'Euro', currency: 'EUR' }],
    });

    render(<CustomerPaymentModal {...defaultProps} />);

    await waitFor(() => expect(axiosInstance.get).toHaveBeenCalledWith('/accounts/'));
    await screen.findByText(/Euro \(EUR\)/);

    fireEvent.change(screen.getByLabelText(/account/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/^Amount$/i), { target: { value: '10' } });

    const rateInput = await screen.findByLabelText(/exchange rate/i);
    fireEvent.change(rateInput, { target: { value: '2' } });

    const converted = await screen.findByLabelText(/converted amount/i);
    await waitFor(() => expect(converted.value).toBe('20.00'));
  });

  test('hides exchange fields when currencies match', async () => {
    axiosInstance.get.mockResolvedValueOnce({
      data: [{ id: 1, name: 'USD Acc', currency: 'USD' }],
    });

    render(<CustomerPaymentModal {...defaultProps} />);
    await waitFor(() => expect(axiosInstance.get).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/account/i), { target: { value: '1' } });

    expect(screen.queryByLabelText(/exchange rate/i)).toBeNull();
    expect(screen.queryByLabelText(/converted amount/i)).toBeNull();
  });
});
