import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminAccountListPage from '../AdminAccountListPage';
import {
  createAccount,
  listAccounts,
  listPlans,
  withOptimisticUpdate,
} from '../../../utils/adminApi';

const mockNavigate = jest.fn();
let mockLocationState = { pathname: '/admin/accounts', search: '', hash: '', state: null };

jest.mock(
  'react-router-dom',
  () => {
    const mockReactRouter = {
      useNavigate: () => mockNavigate,
      useLocation: () => mockLocationState,
    };
    return mockReactRouter;
  },
  { virtual: true },
);

jest.mock('../../../utils/adminApi', () => {
  const listAccountsMock = jest.fn();
  const createAccountMock = jest.fn();
  const listPlansMock = jest.fn();
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
    listPlans: listPlansMock,
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

describe('AdminAccountListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockLocationState = { pathname: '/admin/accounts', search: '', hash: '', state: null };
    listPlans.mockResolvedValue([
      { id: 'plan-starter', code: 'starter', name: 'Starter' },
      { id: 'plan-growth', code: 'growth', name: 'Growth' },
    ]);
  });

  test('renders accounts and allows creating a new account', async () => {
    listAccounts.mockResolvedValue([
      {
        id: '1',
        name: 'Acme Corp',
        seat_limit: 10,
        seats_used: 3,
        subscription: { plan: 'starter' },
      },
    ]);
    createAccount.mockResolvedValue({
      id: '2',
      name: 'Beta LLC',
      seat_limit: 5,
      seats_used: 0,
      subscription: { plan: 'growth' },
      owner: {
        username: 'owner.user',
        email: 'owner@example.com',
        is_admin: true,
        is_billing_manager: true,
      },
    });

    render(<AdminAccountListPage />);

    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();

    const nameInput = screen.getByLabelText('Account name');
    const seatsInput = screen.getByLabelText('Seat limit');
    const planSelect = screen.getByLabelText('Plan');
    const ownerUsernameInput = screen.getByLabelText('Owner username');
    const ownerEmailInput = screen.getByLabelText('Owner email');
    const ownerPasswordInput = screen.getByLabelText('Owner password');
    const ownerBillingCheckbox = screen.getByLabelText('Grant billing manager access');

    await act(async () => {
      fireEvent.input(nameInput, { target: { name: 'name', value: 'Beta LLC' } });
      fireEvent.input(seatsInput, { target: { name: 'seat_limit', value: '5' } });
      fireEvent.change(planSelect, { target: { name: 'plan', value: 'growth' } });
      fireEvent.input(ownerUsernameInput, { target: { name: 'owner_username', value: 'owner.user' } });
      fireEvent.input(ownerEmailInput, { target: { name: 'owner_email', value: 'owner@example.com' } });
      fireEvent.input(ownerPasswordInput, { target: { name: 'owner_password', value: 'SecurePass123!' } });
      fireEvent.click(ownerBillingCheckbox);
    });

    expect(nameInput).toHaveValue('Beta LLC');
    expect(seatsInput).toHaveValue(5);
    expect(planSelect).toHaveValue('growth');
    expect(ownerUsernameInput).toHaveValue('owner.user');
    expect(ownerEmailInput).toHaveValue('owner@example.com');
    expect(ownerPasswordInput).toHaveValue('SecurePass123!');
    expect(ownerBillingCheckbox).toBeChecked();

    await act(async () => {
      fireEvent.submit(screen.getByTestId('create-account-form'));
      await Promise.resolve();
    });

    expect(withOptimisticUpdate).toHaveBeenCalled();
    const [requestFn, { applyOptimistic }] = withOptimisticUpdate.mock.calls[0];

    createAccount.mockClear();
    await act(async () => {
      await requestFn();
    });
    expect(createAccount).toHaveBeenCalledWith({
      name: 'Beta LLC',
      seat_limit: 5,
      plan: 'growth',
      owner_email: 'owner@example.com',
      owner_username: 'owner.user',
      owner_password: 'SecurePass123!',
      owner_is_admin: true,
      owner_is_billing_manager: true,
    });

    await act(async () => {
      applyOptimistic();
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByText('Beta LLC')).toBeInTheDocument());

    await waitFor(() => {
      expect(ownerUsernameInput).toHaveValue('');
      expect(ownerEmailInput).toHaveValue('');
      expect(ownerPasswordInput).toHaveValue('');
      expect(ownerBillingCheckbox).not.toBeChecked();
    });
  });

  test('shows plan hint when navigating with plan section query', async () => {
    listAccounts.mockResolvedValue([]);
    mockLocationState = { ...mockLocationState, search: '?section=plans' };

    render(<AdminAccountListPage />);

    expect(await screen.findByTestId('admin-plan-hint')).toBeInTheDocument();
  });

  test('displays validation errors when account creation fails', async () => {
    listAccounts.mockResolvedValue([]);
    const apiError = new Error('Bad request');
    apiError.cause = {
      response: {
        data: {
          owner_username: ['Username is required when specifying owner details.'],
        },
      },
    };
    createAccount.mockRejectedValue(apiError);
    withOptimisticUpdate.mockImplementationOnce(async () => {
      throw apiError;
    });

    render(<AdminAccountListPage />);

    const nameInput = await screen.findByLabelText('Account name');
    const seatInput = screen.getByLabelText('Seat limit');
    const planSelect = screen.getByLabelText('Plan');
    const ownerEmailInput = screen.getByLabelText('Owner email');

    await act(async () => {
      fireEvent.input(nameInput, { target: { name: 'name', value: 'Gamma Inc' } });
      fireEvent.input(seatInput, { target: { name: 'seat_limit', value: '3' } });
      fireEvent.change(planSelect, { target: { name: 'plan', value: 'starter' } });
      fireEvent.input(ownerEmailInput, {
        target: { name: 'owner_email', value: 'owner@example.com' },
      });
    });

    expect(nameInput).toHaveValue('Gamma Inc');
    expect(seatInput).toHaveValue(3);
    expect(planSelect).toHaveValue('starter');
    expect(ownerEmailInput).toHaveValue('owner@example.com');

    await act(async () => {
      fireEvent.submit(screen.getByTestId('create-account-form'));
    });

    await waitFor(() => expect(withOptimisticUpdate).toHaveBeenCalled());
    expect(await screen.findByText('Username is required when specifying owner details.')).toBeInTheDocument();
  });

  test('filters accounts by search query', async () => {
    listAccounts.mockResolvedValue([
      {
        id: '1',
        name: 'Acme Corp',
        email_domain: 'acme.example',
        seat_limit: 10,
        seats_used: 3,
        subscription: { plan: 'starter' },
      },
      {
        id: '2',
        name: 'Beta LLC',
        email_domain: 'beta.test',
        seat_limit: 5,
        seats_used: 1,
        subscription: { plan: 'growth' },
      },
    ]);

    render(<AdminAccountListPage />);

    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta LLC')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search accounts');

    fireEvent.change(searchInput, { target: { value: 'growth' } });

    await waitFor(() => {
      expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
      expect(screen.getByText('Beta LLC')).toBeInTheDocument();
    });

    fireEvent.change(searchInput, { target: { value: 'acme' } });

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.queryByText('Beta LLC')).not.toBeInTheDocument();
    });
  });
});
