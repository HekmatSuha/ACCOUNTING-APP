import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import * as adminApi from '../../../utils/adminApi';
import AdminPlansPage from '../AdminPlansPage';

jest.mock('../../../utils/adminApi', () => ({
  listPlans: jest.fn(),
  createPlan: jest.fn(),
  updatePlan: jest.fn(),
  deletePlan: jest.fn(),
  parseAdminError: (e) => e.message,
}));

const mockPlans = [
  { id: 1, name: 'Starter', price: 10, currency: 'USD', billing_cycle: 'monthly', seat_limit: 5, features: ['feature1'] },
  { id: 2, name: 'Growth', price: 20, currency: 'USD', billing_cycle: 'monthly', seat_limit: 10, features: ['feature2'] },
];

const TestComponent = () => (
  <BrowserRouter>
    <AdminPlansPage />
  </BrowserRouter>
);

describe('AdminPlansPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the plans list', async () => {
    adminApi.listPlans.mockResolvedValue(mockPlans);
    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText('Starter')).toBeInTheDocument();
      expect(screen.getByText('Growth')).toBeInTheDocument();
    });
  });

  it('opens the modal to add a new plan', async () => {
    adminApi.listPlans.mockResolvedValue(mockPlans);
    render(<TestComponent />);

    await waitFor(() => {
      fireEvent.click(screen.getByText('Add new plan'));
      expect(screen.getByText('Add new plan')).toBeInTheDocument();
    });
  });

  it('opens the modal to edit a plan', async () => {
    adminApi.listPlans.mockResolvedValue(mockPlans);
    render(<TestComponent />);

    await waitFor(() => {
      fireEvent.click(screen.getAllByText('Edit')[0]);
      expect(screen.getByText('Edit plan')).toBeInTheDocument();
    });
  });

  it('deletes a plan', async () => {
    adminApi.listPlans.mockResolvedValue(mockPlans);
    window.confirm = jest.fn(() => true);
    render(<TestComponent />);

    await waitFor(() => {
      fireEvent.click(screen.getAllByText('Delete')[0]);
      expect(adminApi.deletePlan).toHaveBeenCalledWith(1);
    });
  });
});