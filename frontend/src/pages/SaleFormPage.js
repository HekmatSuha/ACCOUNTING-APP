// frontend/src/pages/SaleFormPage.js

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Col, Container, Form, Row, Stack, Table } from 'react-bootstrap';
import { PencilSquare, Plus, Trash } from 'react-bootstrap-icons';
import axiosInstance from '../utils/axiosInstance';
import '../styles/datatable.css';
import '../styles/saleForm.css';
import ProductSearchSelect from '../components/ProductSearchSelect';
import SaleItemModal from '../components/SaleItemModal';

function SaleFormPage() {
    const { customerId, supplierId } = useParams();
    const entityId = customerId || supplierId;
    const isSupplierSale = Boolean(supplierId);
    const navigate = useNavigate();
    const location = useLocation();
    const isOffer = new URLSearchParams(location.search).get('type') === 'offer';

    const [customer, setCustomer] = useState(null);
    const [allProducts, setAllProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [documentNumber, setDocumentNumber] = useState('');
    const [description, setDescription] = useState('');
    const [lineItems, setLineItems] = useState([]);
    const [formError, setFormError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [itemModalState, setItemModalState] = useState({ show: false, index: null, initialItem: null });
    const [quickSearchKey, setQuickSearchKey] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
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
            }
        };
        fetchData();
    }, [entityId, isSupplierSale]);

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



    const priceField = 'sale_price';
    const allowDiscounts = true;


    const getProductById = useCallback((productId) => {
        if (!productId) return null;
        return allProducts.find((p) => p.id === Number(productId)) || null;
    }, [allProducts]);


    useEffect(() => {
        if (!isSupplierSale) return;
        setLineItems((prev) =>
            prev.map((item) => {
                if (!item.product_id) return item;
                const product = allProducts.find((product) => product.id === Number(item.product_id));
                if (!product) return item;
                return {
                    ...item,
                    unit_price: Number(product[priceField]) || 0,
                };
            })
        );
    }, [allProducts, isSupplierSale, priceField]);


    const openCreateItemModal = (product = null) => {
        const defaultItem = {
            product_id: product?.id || '',
            quantity: product ? 1 : 1,

            unit_price: product ? Number(product.sale_price) : 0,

            unit_price: product ? Number(product[priceField]) || 0 : 0,

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

            discount: allowDiscounts ? Number(item.discount) || 0 : 0,

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

                const basePrice = Number(product?.[priceField]) || Number(item.unit_price) || 0;
                const quantity = Number(item.quantity) || 0;
                const lineBase = basePrice * quantity;
                const lineNet = Number(item.unit_price || 0) * quantity;
                const lineDiscount = allowDiscounts ? lineBase - lineNet : 0;

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
    }, [allowDiscounts, getProductById, lineItems, priceField]);

    const hasLineItems = lineItems.some((item) => item.product_id);

    const transactionKind = isSupplierSale ? 'sale' : isOffer ? 'offer' : 'sale';
    const transactionLabelMap = { sale: 'Sale', offer: 'Offer' };
    const transactionLabel = transactionLabelMap[transactionKind];
    const saleDateLabel = transactionKind === 'offer' ? 'Offer Date' : 'Sale Date';
    const invoiceDateLabel = 'Invoice Date';
    const invoiceNumberLabel = 'Invoice No';
    const submitLabel = transactionKind === 'offer' ? 'Save Offer' : 'Save Sale';

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormError(null);

        const payloadItems = lineItems
            .filter((item) => item.product_id)
            .map((item) => {
                const base = {
                    product_id: Number(item.product_id),
                    quantity: Number(item.quantity),
                    unit_price: Number(item.unit_price),
                };
                if (!isOffer) {
                if (transactionKind !== 'offer') {
                    base.warehouse_id = Number(item.warehouse_id);
                }
                return base;
            });

        if (payloadItems.length === 0) {
            setFormError('Add at least one product before saving.');

            setFormError('Add at least one product before saving this transaction.');
            return;
        }

        const payload = { items: payloadItems };
        let url;
        if (isOffer) {

        if (transactionKind === 'offer') {
            url = `/customers/${entityId}/offers/`;
            payload.details = description || undefined;
        } else if (transactionKind === 'sale') {
            url = '/sales/';
            if (isSupplierSale) {
                payload.supplier_id = Number(entityId);
            } else {
                payload.customer_id = Number(entityId);
            }
            payload.sale_date = saleDate;
            payload.invoice_number = invoiceNumber || undefined;
            payload.details = description || undefined;
        }

        try {
            setIsSubmitting(true);
            await axiosInstance.post(url, payload);
            navigate(isSupplierSale ? `/suppliers/${entityId}` : `/customers/${entityId}`);
        } catch (error) {
            console.error('Failed to create sale', error.response?.data);
            setFormError(error.response?.data?.detail || 'Failed to save the sale.');

            console.error('Failed to create transaction', error.response?.data);
            setFormError(error.response?.data?.detail || 'Failed to save the transaction.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!customer) return <div>Loading...</div>;

    const hasWarehouses = warehouses.length > 0;

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: customer.currency,
        }).format(amount || 0);
    };

    return (
        <Container className="sale-form__container">
            <Form onSubmit={handleSubmit}>
                <Row className="sale-form__layout">
                    <Col xl={4} lg={5} className="mb-4">
                        <Card className="sale-form__sidebar-card">
                            <Card.Header>
                                <div className="sale-form__sidebar-title">
                                    <div className="sale-form__sidebar-label">{isOffer ? 'Offer' : 'Sale'} Summary</div>
                                    <div className="sale-form__sidebar-entity">{customer.name}</div>

                                <div className="sale-form__sidebar-header">
                                    <div className="sale-form__sidebar-title">
                                        <div className="sale-form__sidebar-label">{transactionLabel} Summary</div>
                                        <div className="sale-form__sidebar-entity">{customer.name}</div>
                                    </div>
                                    {isSupplierSale && (
                                        <div className="sale-form__mode-toggle">
                                            <Button size="sm" variant="light" disabled>
                                                Sell to Supplier
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline-light"
                                                onClick={() => navigate(`/suppliers/${entityId}/new-purchase`)}
                                            >
                                                Make a Purchase
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </Card.Header>
                            <Card.Body>
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

                                            <Form.Label>{saleDateLabel}</Form.Label>
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

                                            <Form.Label>{invoiceDateLabel}</Form.Label>
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

                                            <Form.Label>{invoiceNumberLabel}</Form.Label>
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
                                    {allowDiscounts && (
                                        <div className="sale-form__summary-row">
                                            <span>Discount</span>
                                            <span>{formatCurrency(totals.discount)}</span>
                                        </div>
                                    )}
                                    <div className="sale-form__summary-row sale-form__summary-row--strong">
                                        <span>{transactionLabel} Total</span>
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
                                        {isOffer ? 'Save Offer' : 'Save Sale'}

                                        {submitLabel}
                                    </Button>
                                    <Button
                                        variant="outline-secondary"
                                        onClick={() => navigate(isSupplierSale ? `/suppliers/${entityId}` : `/customers/${entityId}`)}
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

                                        <small className="text-muted">
                                            Add items from your catalog to this {transactionLabel.toLowerCase()}.
                                        </small>
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

                                        No warehouses available. Please create a warehouse before recording this transaction.
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

                                                        Add products using the search above to build this {transactionLabel.toLowerCase()}.
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

                priceField={priceField}
            />
        </Container>
    );
}

export default SaleFormPage;
