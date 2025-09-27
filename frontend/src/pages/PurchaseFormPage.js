// frontend/src/pages/PurchaseFormPage.js

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Alert,
    Badge,
    Button,
    Card,
    Col,
    Container,
    Form,
    Row,
    Stack,
    Table,
} from 'react-bootstrap';
import { PencilSquare, Plus, Trash } from 'react-bootstrap-icons';
import axiosInstance from '../utils/axiosInstance';
import ProductSearchSelect from '../components/ProductSearchSelect';
import SaleItemModal from '../components/SaleItemModal';
import '../styles/datatable.css';
import '../styles/saleForm.css';

function PurchaseFormPage() {
    const { supplierId, customerId } = useParams();
    const navigate = useNavigate();

    const [partner, setPartner] = useState(null);
    const [allProducts, setAllProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
    const [billNumber, setBillNumber] = useState('');
    const [lineItems, setLineItems] = useState([]);
    const [formError, setFormError] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [itemModalState, setItemModalState] = useState({ show: false, index: null, initialItem: null });
    const [quickSearchKey, setQuickSearchKey] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [partnerRes, prodRes, warehouseRes] = await Promise.all([
                    supplierId
                        ? axiosInstance.get(`/suppliers/${supplierId}/`)
                        : axiosInstance.get(`/customers/${customerId}/`),
                    axiosInstance.get('/products/'),
                    axiosInstance.get('/warehouses/'),
                ]);
                const entityData = { currency: 'USD', ...partnerRes.data };
                setPartner(entityData);
                setAllProducts(prodRes.data);
                setWarehouses(warehouseRes.data);
            } catch (error) {
                console.error('Failed to fetch initial data', error);
            }
        };

        fetchData();
    }, [supplierId, customerId]);

    useEffect(() => {
        if (!warehouses.length) return;
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

    const getProductById = useCallback(
        (productId) => {
            if (!productId) return null;
            return allProducts.find((product) => product.id === Number(productId)) || null;
        },
        [allProducts]
    );

    const openCreateItemModal = (product = null) => {
        const defaultWarehouse = warehouses[0]?.id || '';
        const defaultItem = {
            product_id: product?.id || '',
            quantity: product ? 1 : 1,
            unit_price: product ? Number(product.purchase_price) || 0 : 0,
            warehouse_id: defaultWarehouse,
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
            discount: 0,
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
                if (!item.product_id) return acc;
                const lineTotal = Number(item.quantity || 0) * Number(item.unit_price || 0);
                return {
                    net: acc.net + lineTotal,
                };
            },
            { net: 0 }
        );
    }, [lineItems]);

    const hasLineItems = lineItems.some((item) => item.product_id);
    const hasWarehouses = warehouses.length > 0;

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: partner?.currency || 'USD',
        }).format(amount || 0);
    };

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
            setFormError('Add at least one product before saving this purchase.');
            return;
        }

        const payload = {
            items: payloadItems,
            purchase_date: purchaseDate,
            bill_number: billNumber || undefined,
        };

        if (supplierId) {
            payload.supplier_id = Number(supplierId);
        } else if (customerId) {
            payload.customer_id = Number(customerId);
        }

        try {
            setIsSubmitting(true);
            await axiosInstance.post('/purchases/', payload);
            navigate(supplierId ? `/suppliers/${supplierId}` : `/customers/${customerId}`);
        } catch (error) {
            console.error('Failed to create purchase', error.response?.data);
            setFormError(error.response?.data?.detail || 'Failed to save the purchase.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!partner) {
        return <div>Loading...</div>;
    }

    return (
        <Container className="sale-form__container">
            <Form onSubmit={handleSubmit}>
                <Row className="sale-form__layout">
                    <Col xl={4} lg={5} className="mb-4">
                        <Card className="sale-form__sidebar-card">
                            <Card.Header>
                                <div className="sale-form__sidebar-header">
                                    <div className="sale-form__sidebar-title">
                                        <div className="sale-form__sidebar-label">Purchase Summary</div>
                                        <div className="sale-form__sidebar-entity">{partner.name}</div>
                                    </div>
                                </div>
                            </Card.Header>
                            <Card.Body>
                                <div className="sale-form__entity-meta">
                                    {partner.phone && <span>{partner.phone}</span>}
                                    {partner.email && <span>{partner.email}</span>}
                                    <span>{(partner.currency || 'USD').toUpperCase()} account</span>
                                </div>
                                <Row className="gy-3 mt-1">
                                    <Col xs={12}>
                                        <Form.Group controlId="purchaseDate">
                                            <Form.Label>Purchase Date</Form.Label>
                                            <Form.Control
                                                type="date"
                                                value={purchaseDate}
                                                onChange={(event) => setPurchaseDate(event.target.value)}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12}>
                                        <Form.Group controlId="billNumber">
                                            <Form.Label>Bill No</Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={billNumber}
                                                placeholder="Optional"
                                                onChange={(event) => setBillNumber(event.target.value)}
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <div className="sale-form__summary mt-4">
                                    <div className="sale-form__summary-row sale-form__summary-row--strong">
                                        <span>Purchase Total</span>
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
                                        Save Purchase
                                    </Button>
                                    <Button
                                        variant="outline-secondary"
                                        type="button"
                                        onClick={() => navigate(supplierId ? `/suppliers/${supplierId}` : `/customers/${customerId}`)}
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
                                        No warehouses available. Please create a warehouse before recording this purchase.
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
                                                <th className="text-end">Line Total</th>
                                                <th className="text-end">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lineItems.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="text-center text-muted py-4">
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
                currency={partner.currency || 'USD'}
                imageBaseUrl={baseApiUrl}
                priceField="purchase_price"
            />
        </Container>
    );
}

export default PurchaseFormPage;
