import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('../utils/axiosInstance', () => ({
    __esModule: true,
    default: {
        patch: jest.fn(),
    },
}));

import SaleItemModal from './SaleItemModal';

describe('SaleItemModal', () => {
    const product = {
        id: 1,
        name: 'Sample Product',
        sale_price: 100,
        warehouse_quantities: [],
    };

    const warehouse = {
        id: 1,
        name: 'Main Warehouse',
    };

    const baseProps = {
        show: true,
        onHide: jest.fn(),
        onSave: jest.fn(),
        products: [product],
        warehouses: [warehouse],
        currency: 'USD',
    };

    it('enables discount input by default for customer sales', async () => {
        render(
            <SaleItemModal
                {...baseProps}
                initialItem={{
                    product_id: product.id,
                    quantity: 1,
                    unit_price: product.sale_price,
                    warehouse_id: warehouse.id,
                    discount: 0,
                    note: '',
                }}
            />
        );

        const discountInput = await screen.findByLabelText('Discount %');
        await waitFor(() => expect(discountInput).toBeEnabled());
    });
});

