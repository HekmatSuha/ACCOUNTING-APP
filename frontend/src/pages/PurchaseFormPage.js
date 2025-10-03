// frontend/src/pages/PurchaseFormPage.js

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Col, Container, Form, Row, Stack, Table } from 'react-bootstrap';
import { PencilSquare, Plus, Trash } from 'react-bootstrap-icons';
import axiosInstance from '../utils/axiosInstance';
import '../styles/saleForm.css';
import ProductSearchSelect from '../components/ProductSearchSelect';
import PurchaseItemModal from '../components/PurchaseItemModal';
import { getBaseApiUrl, getImageInitial, resolveImageUrl } from '../utils/image';

function PurchaseFormPage() {
    const { supplierId, customerId } = useParams();
    const isCustomerPurchase = Boolean(customerId);
    const navigate = useNavigate();
    const location = useLocation();
    const purchaseId = location.state?.purchaseId ?? null;
    const returnTo = location.state?.returnTo ?? null;
    const isEditing = Boolean(purchaseId);

    const [partner, setPartner] = useState(null);
    const [allProducts, setAllProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
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
                setIsLoadingInitialData(true);
                const requests = [
                    axiosInstance.get(supplierId ? `suppliers/${supplierId}/` : `customers/${customerId}/`),
                    axiosInstance.get('/products/'),
                    axiosInstance.get('/warehouses/'),
                ];

                if (purchaseId) {
                    requests.push(axiosInstance.get(`/purchases/${purchaseId}/`));
                }

                const responses = await Promise.all(requests);
                const [partnerRes, productRes, warehouseRes, purchaseRes] = responses;
                const partnerData = { currency: 'USD', ...partnerRes.data };
                setPartner(partnerData);
                setAllProducts(productRes.data);
                setWarehouses(warehouseRes.data);

                if (purchaseId && purchaseRes) {
                    const purchaseData = purchaseRes.data;
                    setPurchaseDate(purchaseData.purchase_date || new Date().toISOString().slice(0, 10));
                    const fallbackWarehouseId = warehouseRes.data[0]?.id || '';
                    setLineItems(
                        (purchaseData.items || []).map((item) => ({
                            product_id:
                                typeof item.product === 'object'
                                    ? item.product.id
                                    : item.product,
                            quantity: Number(item.quantity),
                            unit_price: Number(item.unit_price),
                            warehouse_id: item.warehouse_id || fallbackWarehouseId,
                            discount: Number(item.discount) || 0,
                            note: item.note || '',
                        }))
                    );
                }
            } catch (error) {
                console.error('Failed to fetch initial data', error);
                setFormError('Failed to load purchase details.');
            } finally {
                setIsLoadingInitialData(false);
            }
        };
        fetchData();
    }, [supplierId, customerId, purchaseId]);

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

    const getProductById = useCallback(
        (productId) => {
            if (!productId) return null;
            return allProducts.find((product) => product.id === Number(productId)) || null;
        },
        [allProducts]
    );

    const openCreateItemModal = (product = null) => {
        const defaultItem = {
            product_id: product?.id || '',
            quantity: product ? 1 : 1,
            unit_price: product ? Number(product.purchase_price) : 0,
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
                const basePrice = Number(product?.purchase_price) || Number(item.unit_price) || 0;
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

        const payloadItems = lineItems
            .filter((item) => item.product_id)
            .map((item) => ({
                product_id: Number(item.product_id),
                quantity: Number(item.quantity),
                unit_price: Number(item.unit_price),
                warehouse_id: Number(item.warehouse_id),
            }));

        if (payloadItems.length === 0) {
            setFormError('Add at least one product before saving.');
            return;
        }

        const payload = {
            items: payloadItems,
            purchase_date: purchaseDate,
        };

        if (supplierId) {
            payload.supplier_id = Number(supplierId);
        } else if (customerId) {
            payload.customer_id = Number(customerId);
        }

        try {
            setIsSubmitting(true);
            if (isEditing) {
                await axiosInstance.put(`/purchases/${purchaseId}/`, payload);
            } else {
                await axiosInstance.post('/purchases/', payload);
            }

            if (returnTo) {
                navigate(returnTo, { replace: true });
            } else {
                navigate(supplierId ? `/suppliers/${supplierId}` : `/customers/${customerId}`);
            }
        } catch (error) {
            console.error('Failed to save purchase', error.response?.data);
            setFormError(error.response?.data?.detail || 'Failed to save the purchase.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoadingInitialData) return <div>Loading...</div>;
    if (!partner) return <Alert variant="danger">Unable to load purchase information.</Alert>;

    const hasWarehouses = warehouses.length > 0;

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: partner.currency,
        }).format(amount || 0);
    };

    const formTitle = isCustomerPurchase
        ? isEditing
            ? 'Edit Purchase from Customer'
            : 'Purchase from Customer'
        : isEditing
            ? 'Edit Purchase from Supplier'
            : 'Purchase from Supplier';
    const submitLabel = isEditing ? 'Update Purchase' : 'Save Purchase';
    const submittingLabel = isEditing ? 'Updating...' : 'Saving...';

    return (
        <Container className="sale-form__container">
            <Form onSubmit={handleSubmit}>
                <Row className="sale-form__layout">
                    <Col xl={4} lg={5} className="mb-4">
                        <Card className="sale-form__sidebar-card">
                            <Card.Header>
                                <div className="sale-form__sidebar-title">
                                    <div className="sale-form__sidebar-label">{formTitle}</div>
                                    <div className="sale-form__sidebar-entity">{partner.name}</div>
                                </div>
                            </Card.Header>
                            <Card.Body>
                                <div className="sale-form__entity-meta">
                                    {partner.phone && <span>{partner.phone}</span>}
                                    {partner.email && <span>{partner.email}</span>}
                                    <span>{partner.currency} account</span>
                                </div>
                                <Row className="gy-3 mt-1">
                                    <Col xs={12}>
                                        <Form.Group controlId="purchaseDocumentNumber">
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
                                        <Form.Group controlId="purchaseDate">
                                            <Form.Label>Purchase Date</Form.Label>
                                            <Form.Control
                                                type="date"
                                                value={purchaseDate}
                                                onChange={(event) => setPurchaseDate(event.target.value)}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group controlId="purchaseInvoiceDate">
                                            <Form.Label>Invoice Date</Form.Label>
                                            <Form.Control
                                                type="date"
                                                value={invoiceDate}
                                                onChange={(event) => setInvoiceDate(event.target.value)}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group controlId="purchaseInvoiceNumber">
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
                                        <Form.Group controlId="purchaseDescription">
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
                                        {isSubmitting ? submittingLabel : submitLabel}
                                    </Button>
                                    <Button
                                        variant="outline-secondary"
                                        onClick={() => {
                                            if (returnTo) {
                                                navigate(returnTo);
                                            } else {
                                                navigate(
                                                    supplierId
                                                        ? `/suppliers/${supplierId}`
                                                        : `/customers/${customerId}`
                                                );
                                            }
                                        }}
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
                                        <small className="text-muted">
                                            Add items from your catalog to this purchase.
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
                                        No warehouses available. Please create a warehouse before recording purchases.
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
                                                <th className="text-end">Unit Cost</th>
                                                <th className="text-center">Discount</th>
                                                <th className="text-end">Line Total</th>
                                                <th className="text-end">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lineItems.length === 0 && (
                                                <tr>
                                                    <td colSpan={8} className="text-center text-muted py-4">
                                                        Add products using the search above to build this purchase.
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
                                                const resolvedImage = resolveImageUrl(product?.image, baseApiUrl);
                                                const imageInitial = getImageInitial(product?.name);
                                                const metaDetails = [];

                                                if (item.note) {
                                                    metaDetails.push(
                                                        <span key="note">Note: {item.note}</span>
                                                    );
                                                }

                                                return (
                                                    <tr key={`${item.product_id}-${index}`}>
                                                        <td>
                                                            <div className="sale-items-table__product product-name-cell">
                                                                <div className="product-name-cell__image">
                                                                    {resolvedImage ? (
                                                                        <img src={resolvedImage} alt={product?.name || 'Product preview'} />
                                                                    ) : (
                                                                        <span>{imageInitial}</span>
                                                                    )}
                                                                </div>
                                                                <div className="sale-items-table__info product-name-cell__info product-name-cell__body">
                                                                    <div className="product-name-cell__header">
                                                                        <div className="sale-items-table__name product-name-cell__name">
                                                                            {product?.name || 'Unnamed product'}
                                                                        </div>
                                                                        {product?.sku && (
                                                                            <span className="product-name-cell__badge">SKU {product.sku}</span>
                                                                        )}
                                                                    </div>
                                                                    {metaDetails.length > 0 && (
                                                                        <div className="sale-items-table__meta product-name-cell__meta">
                                                                            {metaDetails}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>{warehouse ? <span>{warehouse.name}</span> : <span className="text-muted">No warehouse</span>}</td>
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
            <PurchaseItemModal
                show={itemModalState.show}
                onHide={closeItemModal}
                onSave={(item) => handleSaveItem(item, itemModalState.index)}
                initialItem={itemModalState.initialItem}
                products={allProducts}
                warehouses={warehouses}
                currency={partner.currency}
                imageBaseUrl={baseApiUrl}
            />
        </Container>
    );
}

export default PurchaseFormPage;

