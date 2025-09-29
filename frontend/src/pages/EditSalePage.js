// frontend/src/pages/EditSalePage.js

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import SaleFormPage from './SaleFormPage';

function EditSalePage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const numericId = useMemo(() => Number(id), [id]);

    const [initialSale, setInitialSale] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const fetchSale = async () => {
            setLoading(true);
            try {
                const response = await axiosInstance.get(`/sales/${numericId}/`);
                if (!isMounted) {
                    return;
                }
                const sale = response.data;
                const normalizedItems = (sale.items || []).map((item) => ({
                    product_id: item.product?.id ?? item.product_id ?? item.product,
                    quantity: Number(item.quantity) || 0,
                    unit_price: Number(item.unit_price) || 0,
                    warehouse_id: item.warehouse_id || '',
                    discount: Number(item.discount) || 0,
                    note: item.note || '',
                }));
                setInitialSale({
                    customerId: sale.customer ?? sale.customer_id ?? null,
                    saleDate: sale.sale_date ? sale.sale_date.slice(0, 10) : null,
                    invoiceDate: sale.invoice_date ? sale.invoice_date.slice(0, 10) : null,
                    invoiceNumber: sale.invoice_number || '',
                    documentNumber: sale.document_number || '',
                    description: sale.description || '',
                    lineItems: normalizedItems,
                });
                setError(null);
            } catch (fetchError) {
                console.error('Failed to load sale for editing', fetchError);
                if (isMounted) {
                    setError('Failed to load sale for editing.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        if (!Number.isNaN(numericId)) {
            fetchSale();
        } else {
            setError('Invalid sale identifier.');
            setLoading(false);
        }

        return () => {
            isMounted = false;
        };
    }, [numericId]);

    if (loading) {
        return (
            <div className="d-flex justify-content-center py-5">
                <Spinner animation="border" />
            </div>
        );
    }

    if (error) {
        return <Alert variant="danger">{error}</Alert>;
    }

    if (!initialSale) {
        return null;
    }

    return (
        <SaleFormPage
            mode="edit"
            saleId={numericId}
            initialEntityId={initialSale.customerId}
            initialSaleDate={initialSale.saleDate}
            initialInvoiceDate={initialSale.invoiceDate}
            initialInvoiceNumber={initialSale.invoiceNumber}
            initialDocumentNumber={initialSale.documentNumber}
            initialDescription={initialSale.description}
            initialLineItems={initialSale.lineItems}
            allowCustomerSwitch
            onCancel={() => navigate(`/sales/${numericId}`)}
            onSuccess={() => navigate(`/sales/${numericId}`)}
        />
    );
}

export default EditSalePage;
