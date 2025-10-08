import { renderHook, waitFor } from '@testing-library/react';
import useSaleFormData from './useSaleFormData';
import axiosInstance from '../utils/axiosInstance';

jest.mock('../utils/axiosInstance', () => ({
    get: jest.fn(),
    defaults: { baseURL: '' },
}));

const buildResponse = (data) => Promise.resolve({ data });

describe('useSaleFormData', () => {
    beforeEach(() => {
        axiosInstance.get.mockImplementation((url) => {
            if (url === 'customers/1/') {
                return buildResponse({ id: 1, name: 'Acme Corp', currency: 'EUR' });
            }
            if (url === '/products/') {
                return buildResponse([{ id: 1, name: 'Widget' }]);
            }
            if (url === '/warehouses/') {
                return buildResponse([{ id: 10, name: 'Main Warehouse' }]);
            }
            return buildResponse({});
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('loads entity, products, and warehouses for a customer sale', async () => {
        const { result } = renderHook(() =>
            useSaleFormData({
                entityId: 1,
                isSupplierSale: false,
            })
        );

        expect(result.current.isLoading).toBe(true);

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(axiosInstance.get).toHaveBeenCalledWith('customers/1/');
        expect(result.current.entity).toEqual(
            expect.objectContaining({ id: 1, name: 'Acme Corp', currency: 'EUR' })
        );
        expect(result.current.products).toHaveLength(1);
        expect(result.current.warehouses).toHaveLength(1);
        expect(result.current.error).toBeNull();
    });

    it('reports an error when requests fail', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        axiosInstance.get.mockRejectedValueOnce(new Error('network error'));

        const { result } = renderHook(() =>
            useSaleFormData({
                entityId: 1,
                isSupplierSale: false,
            })
        );

        await waitFor(() => {
            expect(result.current.error).toBe('Failed to fetch sale details. Please try again.');
        });

        expect(result.current.entity).toBeNull();
        expect(result.current.products).toEqual([]);
        expect(result.current.warehouses).toEqual([]);
        consoleSpy.mockRestore();
    });

    it('invokes lifecycle callbacks when entity changes', async () => {
        const onBeforeFetch = jest.fn();
        const onEntityCleared = jest.fn();

        const { rerender } = renderHook(
            ({ entityId }) =>
                useSaleFormData({
                    entityId,
                    isSupplierSale: false,
                    onBeforeFetch,
                    onEntityCleared,
                }),
            { initialProps: { entityId: 1 } }
        );

        await waitFor(() => {
            expect(onBeforeFetch).toHaveBeenCalled();
        });

        rerender({ entityId: null });

        await waitFor(() => {
            expect(onEntityCleared).toHaveBeenCalled();
        });
    });
});
