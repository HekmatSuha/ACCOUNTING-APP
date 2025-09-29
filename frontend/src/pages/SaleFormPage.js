// frontend/src/pages/SaleFormPage.js

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Col, Container, Form, Row, Spinner, Stack, Table } from 'react-bootstrap';
import { PencilSquare, Plus, Trash } from 'react-bootstrap-icons';
import axiosInstance from '../utils/axiosInstance';
import '../styles/datatable.css';
import '../styles/saleForm.css';
import ProductSearchSelect from '../components/ProductSearchSelect';
import SaleItemModal from '../components/SaleItemModal';

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

    const [customer, setCustomer] = useState(null);
    const [allProducts, setAllProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [customerOptions, setCustomerOptions] = useState([]);
    const [isLoadingCustomerOptions, setIsLoadingCustomerOptions] = useState(false);
    const [loadingEntityData, setLoadingEntityData] = useState(false);
    const [initialDataError, setInitialDataError] = useState(null);
    const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const [saleDate, setSaleDate] = useState(initialSaleDate || todayIso);
    const [invoiceDate, setInvoiceDate] = useState(initialInvoiceDate || todayIso);
    const [invoiceNumber, setInvoiceNumber] = useState(initialInvoiceNumber || '');
    const [documentNumber, setDocumentNumber] = useState(initialDocumentNumber || '');
    const [description, setDescription] = useState(initialDescription || '');
    const [lineItems, setLineItems] = useState(() => initialLineItems.map((item) => ({ ...item })));
    const [formError, setFormError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [itemModalState, setItemModalState] = useState({ show: false, index: null, initialItem: null });
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
                setInitialDataError(null);
            } catch (error) {
                console.error('Failed to fetch customers', error);
                setInitialDataError('Failed to load customers. Please try again.');
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

    useEffect(() => {
        if (!entityId) {
            setCustomer(null);
            setAllProducts([]);
            setWarehouses([]);
            if (!isEditMode) {
                setLineItems([]);
            }
            return;
        }

        const fetchData = async () => {
            setLoadingEntityData(true);
            setInitialDataError(null);
            setCustomer(null);
            setAllProducts([]);
            setWarehouses([]);
            if (!isEditMode || !hasHydratedFromProps) {
                setLineItems([]);
            }

            try {
                const [custRes, prodRes, warehouseRes] = await Promise.all([
                    axiosInstance.get(isSupplierSale ? `suppliers/${entityId}/` : `customers/${entityId}/`),
                    axiosInstance.get('/products/'),
                    axiosInstance.get('/warehouses/'),
                ]);
                const entityData = { currency: 'USD', ...custRes.data };
                setCustomer(entityData);
                setAllProducts(prodRes.data);
                setWarehouses(warehouseRes.data);
            } catch (error) {
                console.error('Failed to fetch initial data', error);
                setInitialDataError('Failed to fetch sale details. Please try again.');
            } finally {
                setLoadingEntityData(false);
            }
        };

        fetchData();
    }, [entityId, hasHydratedFromProps, isEditMode, isSupplierSale]);

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

    const baseApiUrl = useMemo(() => {
        const apiBase = axiosInstance.defaults.baseURL || '';
        return apiBase.replace(/\/?api\/?$/, '');
    }, []);

    const getProductById = useCallback((productId) => {
        if (!productId) return null;
        return allProducts.find((p) => p.id === Number(productId)) || null;
    }, [allProducts]);

    const openCreateItemModal = (product = null) => {
        const defaultItem = {
            product_id: product?.id || '',
            quantity: product ? 1 : 1,
            unit_price: product ? Number(product.sale_price) : 0,
            warehouse_id: warehouses[0]?.id || '',
            discount: 0,
            note: '',
        };
        setItemModalState({ show: true, index: null, initialItem: defaultItem });
    };

    const openEditItemModal = (index) => {
        setItemModalState({ show: true, index, initialItem: lineItems[index] });
    };

    const closeItemModal = () => {
        setItemModalState({ show: false, index: null, initialItem: null });
    };

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
            payload.customer_id = entityId;
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
            payload.customer_id = entityId;
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

    return (
        <Container className="sale-form__container">
            {isStandaloneSale && (
                <Card className="sale-form__selection-card mb-4">
                    <Card.Body>
                        <Row className="align-items-end g-3">
                            <Col md={8}>
                                <Form.Group controlId="saleCustomer">
                                    <Form.Label>Select Customer</Form.Label>
                                    <Form.Select
                                        value={selectedCustomerId || ''}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setSelectedCustomerId(value ? Number(value) : null);
                                        }}
                                        disabled={isLoadingCustomerOptions}
                                    >
                                        <option value="">Choose a customer...</option>
                                        {customerOptions.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.name}
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <div className="text-muted small">
                                    {isLoadingCustomerOptions
                                        ? 'Loading customers...'
                                        : 'Select a customer to start a new sale.'}
                                </div>
                            </Col>
                        </Row>
                        {initialDataError && !entityId && (
                            <Alert
                                variant="danger"
                                className="mt-3"
                                onClose={() => setInitialDataError(null)}
                                dismissible
                            >
                                {initialDataError}
                            </Alert>
                        )}
                    </Card.Body>
                </Card>
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
                ) : initialDataError ? (
                    <Alert variant="danger" onClose={() => setInitialDataError(null)} dismissible>
                        {initialDataError}
                    </Alert>
                ) : (
                    customer && (
                        <>
                            <Form onSubmit={handleSubmit}>
                                <Row className="sale-form__layout">
                                    <Col xl={4} lg={5} className="mb-4">
                                        <Card className="sale-form__sidebar-card">
                                            <Card.Header>
                                                <div className="sale-form__sidebar-title">
                                                    <div className="sale-form__sidebar-label">{isEditMode ? 'Edit Sale' : (isOffer ? 'Offer' : 'Sale')} Summary</div>
                                                    <div className="sale-form__sidebar-entity">{customer.name}</div>
                                                </div>
                                            </Card.Header>
                                            <Card.Body>
                                                {allowCustomerSwitch && (
                                                    <Row className="gy-3 mb-1">
                                                        <Col xs={12}>
                                                            <Form.Group controlId="saleEditorCustomer">
                                                                <Form.Label>Customer</Form.Label>
                                                                <Form.Select
                                                                    value={selectedCustomerId || ''}
                                                                    onChange={(event) => {
                                                                        const value = event.target.value;
                                                                        const numericValue = value ? Number(value) : null;
                                                                        setSelectedCustomerId(numericValue);
                                                                        setLineItems([]);
                                                                    }}
                                                                    disabled={isLoadingCustomerOptions}
                                                                    required
                                                                >
                                                                    <option value="">Select a customer</option>
                                                                    {customerOptions.map((option) => (
                                                                        <option key={option.id} value={option.id}>
                                                                            {option.name}
                                                                        </option>
                                                                    ))}
                                                                </Form.Select>
                                                            </Form.Group>
                                                        </Col>
                                                    </Row>
                                                )}
                                                <div className="sale-form__entity-meta">
                                                    {customer.phone && <span>{customer.phone}</span>}
                                                    {customer.email && <span>{customer.email}</span>}
                                                    <span>{customer.currency} account</span>
                                                </div>
                                <Row className="gy-3 mt-1">
                                    <Col xs={12}>
                                        <Form.Group controlId="documentNumber">
                                            <Form.Label>Document No</Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={documentNumber}
                                                placeholder="Auto"
                                                onChange={(event) => setDocumentNumber(event.target.value)}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group controlId="saleDate">
                                            <Form.Label>{isOffer ? 'Offer Date' : 'Sale Date'}</Form.Label>
                                            <Form.Control
                                                type="date"
                                                value={saleDate}
                                                onChange={(event) => setSaleDate(event.target.value)}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group controlId="invoiceDate">
                                            <Form.Label>Invoice Date</Form.Label>
                                            <Form.Control
                                                type="date"
                                                value={invoiceDate}
                                                onChange={(event) => setInvoiceDate(event.target.value)}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group controlId="invoiceNumber">
                                            <Form.Label>Invoice No</Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={invoiceNumber}
                                                placeholder="Auto"
                                                onChange={(event) => setInvoiceNumber(event.target.value)}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12}>
                                        <Form.Group controlId="description">
                                            <Form.Label>Description</Form.Label>
                                            <Form.Control
                                                as="textarea"
                                                rows={3}
                                                value={description}
                                                onChange={(event) => setDescription(event.target.value)}
                                                placeholder="Optional notes about this transaction"
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <div className="sale-form__summary mt-4">
                                    <div className="sale-form__summary-row">
                                        <span>Subtotal</span>
                                        <span>{formatCurrency(totals.base)}</span>
                                    </div>
                                    <div className="sale-form__summary-row">
                                        <span>Discount</span>
                                        <span>{formatCurrency(totals.discount)}</span>
                                    </div>
                                    <div className="sale-form__summary-row sale-form__summary-row--strong">
                                        <span>Net Total</span>
                                        <span>{formatCurrency(totals.net)}</span>
                                    </div>
                                </div>
                            </Card.Body>
                            <Card.Footer>
                                <Stack gap={2}>
                                    <Button
                                        type="submit"
                                        variant="success"
                                        disabled={!hasWarehouses || !hasLineItems || isSubmitting}
                                    >
                                        {primaryActionLabel}
                                    </Button>
                                    <Button
                                        variant="outline-secondary"
                                        onClick={handleCancel}
                                        type="button"
                                    >
                                        Cancel
                                    </Button>
                                </Stack>
                            </Card.Footer>
                        </Card>
                    </Col>
                    <Col xl={8} lg={7}>
                        <Card className="sale-form__items-card">
                            <Card.Header>
                                <div className="sale-form__items-header">
                                    <div>
                                        <h5 className="mb-0">Products &amp; Services</h5>
                                        <small className="text-muted">Add items from your catalog to this {isOffer ? 'offer' : 'sale'}.</small>
                                    </div>
                                    <div className="sale-form__quick-add">
                                        <ProductSearchSelect
                                            key={quickSearchKey}
                                            products={allProducts}
                                            value={null}
                                            onSelect={handleQuickProductSelect}
                                            placeholder="Search products to add"
                                            imageBaseUrl={baseApiUrl}
                                        />
                                        <Button
                                            type="button"
                                            className="mt-2 mt-sm-0"
                                            variant="outline-primary"
                                            onClick={() => openCreateItemModal()}
                                            disabled={!hasWarehouses}
                                        >
                                            <Plus className="me-1" /> New Line
                                        </Button>
                                    </div>
                                </div>
                            </Card.Header>
                            <Card.Body>
                                {!hasWarehouses && (
                                    <Alert variant="warning" className="mb-3">
                                        No warehouses available. Please create a warehouse before recording sales.
                                    </Alert>
                                )}
                                {formError && (
                                    <Alert variant="danger" className="mb-3" onClose={() => setFormError(null)} dismissible>
                                        {formError}
                                    </Alert>
                                )}
                                <div className="table-responsive">
                                    <Table hover borderless className="sale-items-table align-middle">
                                        <thead>
                                            <tr>
                                                <th>Product</th>
                                                <th>Warehouse</th>
                                                <th className="text-center">Stock</th>
                                                <th className="text-center">Quantity</th>
                                                <th className="text-end">Unit Price</th>
                                                <th className="text-center">Discount</th>
                                                <th className="text-end">Line Total</th>
                                                <th className="text-end">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lineItems.length === 0 && (
                                                <tr>
                                                    <td colSpan={8} className="text-center text-muted py-4">
                                                        Add products using the search above to build this {isOffer ? 'offer' : 'sale'}.
                                                    </td>
                                                </tr>
                                            )}
                                            {lineItems.map((item, index) => {
                                                const product = getProductById(item.product_id);
                                                const warehouse = warehouses.find((w) => w.id === Number(item.warehouse_id));
                                                const warehouseQuantity = product?.warehouse_quantities?.find(
                                                    (stock) => stock.warehouse_id === Number(item.warehouse_id)
                                                );
                                                const availableStock = warehouseQuantity ? Number(warehouseQuantity.quantity) : null;
                                                const discountLabel = item.discount ? `${Number(item.discount).toFixed(2)}%` : '—';
                                                const lineTotal = Number(item.quantity) * Number(item.unit_price || 0);

                                                return (
                                                    <tr key={`${item.product_id}-${index}`}>
                                                        <td>
                                                            <div className="sale-items-table__product">
                                                                <div className="sale-items-table__name">{product?.name || 'Unnamed product'}</div>
                                                                <div className="sale-items-table__meta">
                                                                    {product?.sku && <span>SKU: {product.sku}</span>}
                                                                    {item.note && <span>Note: {item.note}</span>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {warehouse ? (
                                                                <span>{warehouse.name}</span>
                                                            ) : (
                                                                <span className="text-muted">No warehouse</span>
                                                            )}
                                                        </td>
                                                        <td className="text-center">
                                                            {product ? (
                                                                <Badge bg={availableStock && availableStock > 0 ? 'success' : 'danger'}>
                                                                    {availableStock !== null ? `${availableStock}` : 'No data'}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-muted">Select a product</span>
                                                            )}
                                                        </td>
                                                        <td className="text-center">{Number(item.quantity)}</td>
                                                        <td className="text-end">{formatCurrency(item.unit_price)}</td>
                                                        <td className="text-center">{discountLabel}</td>
                                                        <td className="text-end">{formatCurrency(lineTotal)}</td>
                                                        <td className="text-end">
                                                            <div className="sale-items-table__actions">
                                                                <Button
                                                                    variant="outline-secondary"
                                                                    size="sm"
                                                                    onClick={() => openEditItemModal(index)}
                                                                >
                                                                    <PencilSquare />
                                                                </Button>
                                                                <Button
                                                                    variant="outline-danger"
                                                                    size="sm"
                                                                    onClick={() => handleRemoveItem(index)}
                                                                >
                                                                    <Trash />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </Table>
                                </div>
                            </Card.Body>
                        </Card>
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
