import { act, renderHook } from '@testing-library/react';
import useSaleItemModal from './useSaleItemModal';

describe('useSaleItemModal', () => {
    it('opens create modal with default item', () => {
        const { result } = renderHook(() => useSaleItemModal());

        act(() => {
            result.current.openCreate({ product_id: 1 });
        });

        expect(result.current.state).toEqual({ show: true, index: null, initialItem: { product_id: 1 } });
    });

    it('opens edit modal and closes it', () => {
        const { result } = renderHook(() => useSaleItemModal());

        act(() => {
            result.current.openEdit(2, { product_id: 5 });
        });

        expect(result.current.state).toEqual({ show: true, index: 2, initialItem: { product_id: 5 } });

        act(() => {
            result.current.close();
        });

        expect(result.current.state).toEqual({ show: false, index: null, initialItem: null });
    });
});
