import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SaleSidebarSummary from './SaleSidebarSummary';

describe('SaleSidebarSummary', () => {
    const formatCurrency = jest.fn((value) => `$${value}`);
    const baseProps = {
        isEditMode: false,
        isOffer: false,
        customer: { id: 1, name: 'Acme Corp', currency: 'USD', phone: '123', email: 'info@acme.test' },
        allowCustomerSwitch: true,
        customerOptions: [
            { id: 1, name: 'Acme Corp' },
            { id: 2, name: 'Globex' },
        ],
        selectedCustomerId: 1,
        onCustomerChange: jest.fn(),
        isLoadingCustomerOptions: false,
        documentNumber: 'INV-1',
        onDocumentNumberChange: jest.fn(),
        saleDate: '2023-01-01',
        onSaleDateChange: jest.fn(),
        invoiceDate: '2023-01-02',
        onInvoiceDateChange: jest.fn(),
        invoiceNumber: '100',
        onInvoiceNumberChange: jest.fn(),
        description: 'Test sale',
        onDescriptionChange: jest.fn(),
        totals: { base: 100, discount: 10, net: 90 },
        formatCurrency,
        hasWarehouses: true,
        hasLineItems: true,
        isSubmitting: false,
        primaryActionLabel: 'Save Sale',
        onCancel: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders summary totals using provided formatter', () => {
        render(<SaleSidebarSummary {...baseProps} />);
        expect(formatCurrency).toHaveBeenCalledWith(100);
        expect(formatCurrency).toHaveBeenCalledWith(10);
        expect(formatCurrency).toHaveBeenCalledWith(90);
        expect(screen.getByText('Save Sale')).toBeEnabled();
    });

    it('calls handlers when customer changes and cancel is clicked', () => {
        render(<SaleSidebarSummary {...baseProps} />);
        fireEvent.change(screen.getByLabelText('Customer'), { target: { value: '2' } });
        expect(baseProps.onCustomerChange).toHaveBeenCalledWith(2);

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(baseProps.onCancel).toHaveBeenCalled();
    });

    it('disables primary action when there are no line items or warehouses', () => {
        const { rerender } = render(
            <SaleSidebarSummary {...baseProps} hasLineItems={false} />
        );
        expect(screen.getByRole('button', { name: 'Save Sale' })).toBeDisabled();

        rerender(<SaleSidebarSummary {...baseProps} hasWarehouses={false} />);
        expect(screen.getByRole('button', { name: 'Save Sale' })).toBeDisabled();
    });
});
