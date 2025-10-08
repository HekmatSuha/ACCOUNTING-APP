import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SaleCustomerSelector from './SaleCustomerSelector';

describe('SaleCustomerSelector', () => {
    const baseProps = {
        customerOptions: [
            { id: 1, name: 'Acme Corp' },
            { id: 2, name: 'Globex' },
        ],
        selectedCustomerId: null,
        onChange: jest.fn(),
        isLoading: false,
        error: null,
        onDismissError: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('displays loading text when fetching customers', () => {
        render(<SaleCustomerSelector {...baseProps} isLoading />);
        expect(screen.getByText('Loading customers...')).toBeInTheDocument();
    });

    it('calls onChange with numeric value when a customer is selected', () => {
        render(<SaleCustomerSelector {...baseProps} />);
        fireEvent.change(screen.getByLabelText('Select Customer'), { target: { value: '2' } });
        expect(baseProps.onChange).toHaveBeenCalledWith(2);
    });

    it('renders error message and allows dismissing it', () => {
        render(<SaleCustomerSelector {...baseProps} error="Failed to load" />);
        expect(screen.getByText('Failed to load')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(baseProps.onDismissError).toHaveBeenCalled();
    });
});
