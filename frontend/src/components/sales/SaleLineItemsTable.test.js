import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SaleLineItemsTable from './SaleLineItemsTable';

jest.mock('../ProductSearchSelect', () => (props) => (
    <button type="button" onClick={() => props.onSelect && props.onSelect({ id: 99, sale_price: 42 })}>
        Product Search
    </button>
));

jest.mock('../../utils/image', () => ({
    getImageInitial: () => 'W',
    resolveImageUrl: () => null,
}));

describe('SaleLineItemsTable', () => {
    const baseProps = {
        isOffer: false,
        products: [
            {
                id: 1,
                name: 'Widget',
                sale_price: 50,
                sku: 'W-1',
                warehouse_quantities: [{ warehouse_id: 1, quantity: 5 }],
                image: null,
            },
        ],
        lineItems: [],
        warehouses: [{ id: 1, name: 'Main Warehouse' }],
        hasWarehouses: true,
        formError: null,
        onDismissFormError: jest.fn(),
        formatCurrency: (value) => `$${value}`,
        onQuickProductSelect: jest.fn(),
        onNewLine: jest.fn(),
        quickSearchKey: 0,
        onEditItem: jest.fn(),
        onRemoveItem: jest.fn(),
        baseApiUrl: 'http://localhost',
        getProductById: (id) => ({
            id: 1,
            name: 'Widget',
            sale_price: 50,
            sku: 'W-1',
            warehouse_quantities: [{ warehouse_id: 1, quantity: 5 }],
            image: null,
        }),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders empty state when there are no line items', () => {
        render(<SaleLineItemsTable {...baseProps} />);
        expect(
            screen.getByText('Add products using the search above to build this sale.')
        ).toBeInTheDocument();
    });

    it('renders line items and triggers edit/remove callbacks', () => {
        const props = {
            ...baseProps,
            lineItems: [
                { product_id: 1, quantity: 2, unit_price: 25, discount: 0, warehouse_id: 1, note: 'Urgent' },
            ],
        };
        render(<SaleLineItemsTable {...props} />);

        expect(screen.getByText('Widget')).toBeInTheDocument();
        expect(screen.getByText('$25')).toBeInTheDocument();
        expect(screen.getByText('$50')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Edit line item' }));
        expect(props.onEditItem).toHaveBeenCalledWith(0);

        fireEvent.click(screen.getByRole('button', { name: 'Remove line item' }));
        expect(props.onRemoveItem).toHaveBeenCalledWith(0);
    });

    it('shows form errors and allows dismissing them', () => {
        render(<SaleLineItemsTable {...baseProps} formError="Validation failed" />);
        expect(screen.getByText('Validation failed')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(baseProps.onDismissFormError).toHaveBeenCalled();
    });

    it('invokes new line handler when button clicked', () => {
        render(<SaleLineItemsTable {...baseProps} />);
        fireEvent.click(screen.getByRole('button', { name: /new line/i }));
        expect(baseProps.onNewLine).toHaveBeenCalled();
    });
});
