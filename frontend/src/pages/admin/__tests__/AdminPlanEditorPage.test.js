import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminPlanEditorPage from '../AdminPlanEditorPage';
import {
  fetchAccountPlan,
  updateAccountPlan,
} from '../../../utils/adminApi';

const mockNavigate = jest.fn();
let mockParams = { id: '123' };

jest.mock(
  'react-router-dom',
  () => ({
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  }),
  { virtual: true },
);

jest.mock('../../../utils/adminApi', () => {
  const listAccountsMock = jest.fn();
  const createAccountMock = jest.fn();
  const fetchAccountMock = jest.fn();
  const updateAccountMock = jest.fn();
  const updateSubscriptionMock = jest.fn();
  const fetchAccountPlanMock = jest.fn();
  const updateAccountPlanMock = jest.fn();
  const parseAdminErrorMock = jest.fn((_, fallback) => fallback || 'Request failed');
  const withOptimisticUpdateMock = jest.fn(async (requestFn, { applyOptimistic, commit, rollback } = {}) => {
    const token = applyOptimistic ? applyOptimistic() : undefined;
    try {
      const result = await requestFn();
      if (commit) {
        commit(result, token);
      }
      return result;
    } catch (error) {
      if (rollback) {
        rollback(token);
      }
      throw error;
    }
  });

  return {
    listAccounts: listAccountsMock,
    createAccount: createAccountMock,
    fetchAccount: fetchAccountMock,
    updateAccount: updateAccountMock,
    updateSubscription: updateSubscriptionMock,
    fetchAccountPlan: fetchAccountPlanMock,
    updateAccountPlan: updateAccountPlanMock,
    parseAdminError: parseAdminErrorMock,
    withOptimisticUpdate: withOptimisticUpdateMock,
  };
});

describe('AdminPlanEditorPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { id: '123' };
  });

  test('loads plan details and submits updates', async () => {
    fetchAccountPlan.mockResolvedValue({
      name: 'Growth',
      price: 29,
      currency: 'USD',
      billing_cycle: 'monthly',
      seat_limit: 50,
      features: ['Feature A', 'Feature B'],
    });
    updateAccountPlan.mockResolvedValue({
      name: 'Growth',
      price: 49,
      currency: 'USD',
      billing_cycle: 'yearly',
      seat_limit: 50,
      features: ['Feature A', 'Feature B', 'Priority support'],
    });

    render(<AdminPlanEditorPage />);

    expect(await screen.findByDisplayValue('Growth')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '49' } });
    fireEvent.change(screen.getByLabelText('Billing cycle'), { target: { value: 'yearly' } });
    fireEvent.submit(screen.getByTestId('admin-plan-form'));

    await waitFor(() =>
      expect(updateAccountPlan).toHaveBeenCalledWith('123', {
        name: 'Growth',
        price: 49,
        currency: 'USD',
        billing_cycle: 'yearly',
        seat_limit: 50,
        features: ['Feature A', 'Feature B'],
      }),
    );
    expect(await screen.findByTestId('admin-plan-success')).toBeInTheDocument();
  });
});
