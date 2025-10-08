// frontend/src/pages/SaleFormPage.js

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';
import '../styles/datatable.css';
import '../styles/saleForm.css';
import SaleItemModal from '../components/SaleItemModal';
import useSaleFormData from '../hooks/useSaleFormData';
import SaleCustomerSelector from '../components/sales/SaleCustomerSelector';
import SaleSidebarSummary from '../components/sales/SaleSidebarSummary';
import SaleLineItemsTable from '../components/sales/SaleLineItemsTable';
import useSaleItemModal from '../components/sales/useSaleItemModal';
import { getBaseApiUrl } from '../utils/image';

function SaleFormPage({
    mode: modeProp,
    saleId: saleIdProp = null,
    initialEntityId = null,
    initialSaleDate = null,
    initialInvoiceDate = null,
    initialInvoiceNumber = '',
    initialDocumentNumber = '',
    initialDescription = '',
    initialLineItems = [],
    allowCustomerSwitch = false,
    onCancel = null,
    onSuccess = null,
} = {}) {
    const routeParams = useParams();
    const { customerId: customerIdParam, supplierId: supplierIdParam, id: saleIdRouteParam } = routeParams;
    const initialCustomerIdFromRoute = customerIdParam ? Number(customerIdParam) : null;
    const initialSupplierIdFromRoute = supplierIdParam ? Number(supplierIdParam) : null;
    const saleIdFromRoute = saleIdRouteParam ? Number(saleIdRouteParam) : null;

    const saleId = saleIdProp ?? saleIdFromRoute;
    const computedMode = modeProp ?? (saleId ? 'edit' : 'create');
    const isEditMode = computedMode === 'edit';

    const [selectedCustomerId, setSelectedCustomerId] = useState(
        isEditMode
            ? (initialEntityId ?? null)
            : (initialEntityId ?? initialCustomerIdFromRoute)
    );
    const [selectedSupplierId] = useState(initialSupplierIdFromRoute ?? null);

    const isSupplierSale = selectedSupplierId !== null;
    const entityId = isSupplierSale ? selectedSupplierId : selectedCustomerId;
    const isStandaloneSale = !isEditMode && !initialCustomerIdFromRoute && !initialSupplierIdFromRoute;
    const navigate = useNavigate();
    const location = useLocation();
    const isOffer = !isEditMode && new URLSearchParams(location.search).get('type') === 'offer';

    const [customerOptions, setCustomerOptions] = useState([]);
    const [isLoadingCustomerOptions, setIsLoadingCustomerOptions] = useState(false);
    const [customerSelectionError, setCustomerSelectionError] = useState(null);
    const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const [saleDate, setSaleDate] = useState(initialSaleDate || todayIso);
    const [invoiceDate, setInvoiceDate] = useState(initialInvoiceDate || todayIso);
    const [invoiceNumber, setInvoiceNumber] = useState(initialInvoiceNumber || '');
    const [documentNumber, setDocumentNumber] = useState(initialDocumentNumber || '');
    const [description, setDescription] = useState(initialDescription || '');
    const [lineItems, setLineItems] = useState(() => initialLineItems.map((item) => ({ ...item })));
    const [formError, setFormError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { state: itemModalState, openCreate: openItemCreateModal, openEdit: openItemEditModal, close: closeItemModal } =
        useSaleItemModal();
    const [quickSearchKey, setQuickSearchKey] = useState(0);
    const [hasHydratedFromProps, setHasHydratedFromProps] = useState(initialLineItems.length > 0);

    useEffect(() => {
        if (!(isStandaloneSale || allowCustomerSwitch)) {
            return;
        }

        const fetchCustomers = async () => {
            setIsLoadingCustomerOptions(true);
            try {
                const response = await axiosInstance.get('/customers/');
                setCustomerOptions(response.data || []);
                setCustomerSelectionError(null);
            } catch (error) {
                console.error('Failed to fetch customers', error);
                setCustomerSelectionError('Failed to load customers. Please try again.');
            } finally {
                setIsLoadingCustomerOptions(false);
            }
        };

        fetchCustomers();
    }, [allowCustomerSwitch, isStandaloneSale]);

    useEffect(() => {
        if (!isEditMode || !initialEntityId || hasHydratedFromProps) {
            return;
        }

        setSelectedCustomerId(initialEntityId);
    }, [hasHydratedFromProps, initialEntityId, isEditMode]);

    useEffect(() => {
        if (initialLineItems.length === 0 || hasHydratedFromProps) {
            return;
        }
        setLineItems(initialLineItems.map((item) => ({ ...item })));
        setHasHydratedFromProps(true);
    }, [hasHydratedFromProps, initialLineItems]);

    const handleResetLineItemsBeforeFetch = useCallback(() => {
        if (!isEditMode || !hasHydratedFromProps) {
            setLineItems([]);
        }
    }, [hasHydratedFromProps, isEditMode]);

    const handleEntityCleared = useCallback(() => {
        if (!isEditMode) {
            setLineItems([]);
        }
    }, [isEditMode]);

    const {
        entity: fetchedEntity,
        products: allProducts,
        warehouses,
        isLoading: loadingEntityData,
        error: entityError,
        clearError: clearEntityError,
    } = useSaleFormData({
        entityId,
        isSupplierSale,
        onBeforeFetch: handleResetLineItemsBeforeFetch,
        onEntityCleared: handleEntityCleared,
    });

    const customer = fetchedEntity;

    useEffect(() => {
        if (!entityId) {
            return;
        }
        setQuickSearchKey((prev) => prev + 1);
        setFormError(null);
    }, [entityId]);

    useEffect(() => {
        if (warehouses.length === 0) return;
        setLineItems((prev) =>
            prev.map((item) => ({
                ...item,
                warehouse_id: item.warehouse_id || warehouses[0]?.id || '',
            }))
        );
    }, [warehouses]);

    const baseApiUrl = useMemo(() => getBaseApiUrl(), []);

    const getProductById = useCallback((productId) => {
        if (!productId) return null;
        return allProducts.find((p) => p.id === Number(productId)) || null;
    }, [allProducts]);

    const openCreateItemModal = useCallback(
        (product = null) => {
            const defaultItem = {
                product_id: product?.id || '',
                quantity: product ? 1 : 1,
                unit_price: product ? Number(product.sale_price) : 0,
                warehouse_id: warehouses[0]?.id || '',
                discount: 0,
                note: '',
            };
            openItemCreateModal(defaultItem);
        },
        [openItemCreateModal, warehouses]
    );

    const openEditItemModal = useCallback(
        (index) => {
            openItemEditModal(index, lineItems[index]);
        },
        [lineItems, openItemEditModal]
    );

    const handleSaveItem = (item, index) => {
        const normalized = {
            product_id: Number(item.product_id),
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            warehouse_id: item.warehouse_id ? Number(item.warehouse_id) : warehouses[0]?.id || '',
            discount: Number(item.discount) || 0,
            note: item.note || '',
        };
        setLineItems((prev) => {
            if (index === null || typeof index === 'undefined') {
                return [...prev, normalized];
            }
            return prev.map((existing, idx) => (idx === index ? normalized : existing));
        });
        closeItemModal();
    };

    const handleRemoveItem = (index) => {
        setLineItems((prev) => prev.filter((_, idx) => idx !== index));
    };

    const handleQuickProductSelect = (product) => {
        if (!product) return;
        if (!warehouses.length) {
            setFormError('Please create a warehouse before adding items.');
            return;
        }
        openCreateItemModal(product);
        setQuickSearchKey((prev) => prev + 1);
    };

    const totals = useMemo(() => {
        return lineItems.reduce(
            (acc, item) => {
                if (!item.product_id) {
                    return acc;
                }
                const product = getProductById(item.product_id);
                const basePrice = Number(product?.sale_price) || Number(item.unit_price) || 0;
                const quantity = Number(item.quantity) || 0;
                const lineBase = basePrice * quantity;
                const lineNet = Number(item.unit_price || 0) * quantity;
                const lineDiscount = lineBase - lineNet;

                return {
                    base: acc.base + lineBase,
                    discount: acc.discount + lineDiscount,
                    net: acc.net + lineNet,
                };
            },
            { base: 0, discount: 0, net: 0 }
        );
    }, [getProductById, lineItems]);

    const hasLineItems = lineItems.length > 0;

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError(null);

        if (!entityId) {
            setFormError('Select a customer before saving.');
            return;
        }

        const payloadItems = lineItems
            .filter((item) => item.product_id)
            .map((item) => {
                const base = {
                    product_id: Number(item.product_id),
                    quantity: Number(item.quantity),
                    unit_price: Number(item.unit_price),
                };
                if (!isOffer) {
                    base.warehouse_id = Number(item.warehouse_id);
                }
                return base;
            });

        if (payloadItems.length === 0) {
            setFormError('Add at least one product before saving.');
            return;
        }

        const payload = { items: payloadItems };
        let url;
        let method;
        if (isOffer) {
            url = `/customers/${entityId}/offers/`;
            method = 'post';
        } else if (isEditMode) {
            url = `/sales/${saleId}/`;
            method = 'put';
            if (isSupplierSale) {
                payload.supplier_id = entityId;
            } else {
                payload.customer_id = entityId;
            }
            payload.sale_date = saleDate;
            payload.invoice_date = invoiceDate;
            if (invoiceNumber) {
                payload.invoice_number = invoiceNumber;
            }
            if (documentNumber) {
                payload.document_number = documentNumber;
            }
            if (description) {
                payload.description = description;
            }
        } else {
            url = '/sales/';
            method = 'post';
            if (isSupplierSale) {
                payload.supplier_id = entityId;
            } else {
                payload.customer_id = entityId;
            }
            payload.sale_date = saleDate;
        }

        try {
            setIsSubmitting(true);
            if (method === 'put') {
                await axiosInstance.put(url, payload);
            } else {
                await axiosInstance.post(url, payload);
            }

            if (onSuccess) {
                onSuccess();
            } else if (isEditMode) {
                navigate(`/sales/${saleId}`);
            } else if (isSupplierSale) {
                navigate(`/suppliers/${entityId}`);
            } else if (isStandaloneSale) {
                navigate('/sales');
            } else {
                navigate(`/customers/${entityId}`);
            }
        } catch (error) {
            console.error('Failed to create sale', error.response?.data);
            setFormError(error.response?.data?.detail || 'Failed to save the sale.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const hasWarehouses = warehouses.length > 0;

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: customer?.currency || 'USD',
        }).format(amount || 0);
    };

    const handleCancel = () => {
        if (onCancel) {
            onCancel();
            return;
        }

        if (isEditMode && saleId) {
            navigate(`/sales/${saleId}`);
            return;
        }

        if (isStandaloneSale) {
            navigate('/sales');
            return;
        }

        if (isSupplierSale && entityId) {
            navigate(`/suppliers/${entityId}`);
            return;
        }

        if (entityId) {
            navigate(`/customers/${entityId}`);
            return;
        }

        navigate('/sales');
    };

    const primaryActionLabel = isEditMode ? 'Update Sale' : (isOffer ? 'Save Offer' : 'Save Sale');

    const handleSidebarCustomerChange = useCallback(
        (value) => {
            setSelectedCustomerId(value);
            setLineItems([]);
            setCustomerSelectionError(null);
        },
        []
    );

    return (
        <Container className="sale-form__container">
            {isStandaloneSale && (
                <SaleCustomerSelector
                    customerOptions={customerOptions}
                    selectedCustomerId={selectedCustomerId}
                    onChange={(value) => {
                        setSelectedCustomerId(value);
                        setLineItems([]);
                        setCustomerSelectionError(null);
                    }}
                    isLoading={isLoadingCustomerOptions}
                    error={!entityId ? customerSelectionError : null}
                    onDismissError={() => setCustomerSelectionError(null)}
                />
            )}

            {!entityId && isStandaloneSale && (
                <Card className="sale-form__empty-card">
                    <Card.Body className="text-center text-muted py-5">
                        {isLoadingCustomerOptions ? (
                            <div className="d-flex flex-column align-items-center gap-2">
                                <Spinner animation="border" size="sm" />
                                <span>Loading customers...</span>
                            </div>
                        ) : (
                            <div>
                                <h5 className="fw-semibold mb-1">Select a customer to start a sale</h5>
                                <p className="mb-0">Choose a customer above to load the sale workspace.</p>
                            </div>
                        )}
                    </Card.Body>
                </Card>
            )}

            {entityId && (
                loadingEntityData ? (
                    <div className="d-flex justify-content-center align-items-center py-5">
                        <Spinner animation="border" />
                    </div>
                ) : entityError ? (
                    <Alert variant="danger" onClose={clearEntityError} dismissible>
                        {entityError}
                    </Alert>
                ) : (
                    customer && (
                        <>
                            <Form onSubmit={handleSubmit}>
                                <Row className="sale-form__layout">
                                    <Col xl={4} lg={5} className="mb-4">
                                        <SaleSidebarSummary
                                            isEditMode={isEditMode}
                                            isOffer={isOffer}
                                            customer={customer}
                                            allowCustomerSwitch={allowCustomerSwitch}
                                            customerOptions={customerOptions}
                                            selectedCustomerId={selectedCustomerId}
                                            onCustomerChange={handleSidebarCustomerChange}
                                            isLoadingCustomerOptions={isLoadingCustomerOptions}
                                            documentNumber={documentNumber}
                                            onDocumentNumberChange={setDocumentNumber}
                                            saleDate={saleDate}
                                            onSaleDateChange={setSaleDate}
                                            invoiceDate={invoiceDate}
                                            onInvoiceDateChange={setInvoiceDate}
                                            invoiceNumber={invoiceNumber}
                                            onInvoiceNumberChange={setInvoiceNumber}
                                            description={description}
                                            onDescriptionChange={setDescription}
                                            totals={totals}
                                            formatCurrency={formatCurrency}
                                            hasWarehouses={hasWarehouses}
                                            hasLineItems={hasLineItems}
                                            isSubmitting={isSubmitting}
                                            primaryActionLabel={primaryActionLabel}
                                            onCancel={handleCancel}
                                        />
                                    </Col>
                                    <Col xl={8} lg={7}>
                                        <SaleLineItemsTable
                                            isOffer={isOffer}
                                            products={allProducts}
                                            lineItems={lineItems}
                                            warehouses={warehouses}
                                            hasWarehouses={hasWarehouses}
                                            formError={formError}
                                            onDismissFormError={() => setFormError(null)}
                                            formatCurrency={formatCurrency}
                                            onQuickProductSelect={handleQuickProductSelect}
                                            onNewLine={() => openCreateItemModal()}
                                            quickSearchKey={quickSearchKey}
                                            onEditItem={openEditItemModal}
                                            onRemoveItem={handleRemoveItem}
                                            baseApiUrl={baseApiUrl}
                                            getProductById={getProductById}
                                        />
                                    </Col>
                                </Row>
                            </Form>
                            <SaleItemModal
                                show={itemModalState.show}
                                onHide={closeItemModal}
                                onSave={(item) => handleSaveItem(item, itemModalState.index)}
                                initialItem={itemModalState.initialItem}
                                products={allProducts}
                                warehouses={warehouses}
                                currency={customer.currency}
                                imageBaseUrl={baseApiUrl}
                            />
                        </>
                    )
                )
            )}
        </Container>
    );
}

export default SaleFormPage;
