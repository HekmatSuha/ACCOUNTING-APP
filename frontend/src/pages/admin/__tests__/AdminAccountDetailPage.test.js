import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminAccountDetailPage from '../AdminAccountDetailPage';
import {
  fetchAccount,
  updateAccount,
  updateSubscription,
} from '../../../utils/adminApi';

const mockNavigate = jest.fn();
let mockParams = { id: '123' };

jest.mock(
  'react-router-dom',
  () => ({
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    Link: ({ children, ...props }) => <a {...props}>{children}</a>,
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

describe('AdminAccountDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { id: '123' };
  });

  test('updates seat limit and subscription', async () => {
    fetchAccount.mockResolvedValue({
      id: '123',
      name: 'Acme Corp',
      seat_limit: 10,
      seats_used: 5,
      owner_name: 'Ada Lovelace',
      subscription: { plan: 'starter', billing_cycle: 'monthly', renews_on: '2025-01-01' },
      members: [],
    });
    updateAccount.mockResolvedValue({
      id: '123',
      name: 'Acme Corp',
      seat_limit: 15,
      seats_used: 5,
      subscription: { plan: 'starter', billing_cycle: 'monthly', renews_on: '2025-01-01' },
      members: [],
    });
    updateSubscription.mockResolvedValue({ plan: 'growth', billing_cycle: 'yearly', renews_on: '2025-06-01' });

    render(<AdminAccountDetailPage />);

    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Seats allowed'), { target: { value: '15' } });
    fireEvent.submit(screen.getByTestId('seat-limit-form'));

    await waitFor(() => expect(updateAccount).toHaveBeenCalledWith('123', { seat_limit: 15 }));
    expect(await screen.findByTestId('seat-limit-success')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'growth' } });
    fireEvent.change(screen.getByLabelText('Billing cycle'), { target: { value: 'yearly' } });
    fireEvent.submit(screen.getByTestId('subscription-form'));

    await waitFor(() =>
      expect(updateSubscription).toHaveBeenCalledWith('123', { plan: 'growth', billing_cycle: 'yearly' }),
    );
    expect(await screen.findByTestId('subscription-success')).toBeInTheDocument();
  });
});
