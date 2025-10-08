import { useCallback, useEffect, useState } from 'react';
import axiosInstance from '../utils/axiosInstance';

const DEFAULT_ERROR_MESSAGE = 'Failed to fetch sale details. Please try again.';

export default function useSaleFormData({
    entityId,
    isSupplierSale,
    onBeforeFetch = null,
    onEntityCleared = null,
}) {
    const [entity, setEntity] = useState(null);
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadEntityData = useCallback(
        async (targetEntityId, isActiveRef) => {
            if (!targetEntityId) {
                setEntity(null);
                setProducts([]);
                setWarehouses([]);
                setError(null);
                return;
            }

            if (onBeforeFetch) {
                onBeforeFetch();
            }

            setIsLoading(true);
            setError(null);

            try {
                const [entityResponse, productsResponse, warehousesResponse] = await Promise.all([
                    axiosInstance.get(isSupplierSale ? `suppliers/${targetEntityId}/` : `customers/${targetEntityId}/`),
                    axiosInstance.get('/products/'),
                    axiosInstance.get('/warehouses/'),
                ]);

                if (isActiveRef && !isActiveRef()) {
                    return;
                }

                setEntity({ currency: 'USD', ...entityResponse.data });
                setProducts(productsResponse.data || []);
                setWarehouses(warehousesResponse.data || []);
            } catch (err) {
                if (isActiveRef && !isActiveRef()) {
                    return;
                }

                console.error('Failed to fetch sale details', err);
                setError(DEFAULT_ERROR_MESSAGE);
                setEntity(null);
                setProducts([]);
                setWarehouses([]);
            } finally {
                if (!isActiveRef || isActiveRef()) {
                    setIsLoading(false);
                }
            }
        },
        [isSupplierSale, onBeforeFetch]
    );

    useEffect(() => {
        if (!entityId) {
            setEntity(null);
            setProducts([]);
            setWarehouses([]);
            setError(null);
            if (onEntityCleared) {
                onEntityCleared();
            }
            return;
        }

        let isActive = true;
        const isActiveRef = () => isActive;

        loadEntityData(entityId, isActiveRef);

        return () => {
            isActive = false;
        };
    }, [entityId, loadEntityData, onEntityCleared]);

    const reload = useCallback(() => loadEntityData(entityId), [entityId, loadEntityData]);

    const clearError = useCallback(() => setError(null), []);

    return {
        entity,
        products,
        warehouses,
        isLoading,
        error,
        clearError,
        reload,
    };
}
