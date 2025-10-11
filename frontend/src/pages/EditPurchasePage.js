// frontend/src/pages/EditPurchasePage.js

import React, { useEffect, useMemo, useState } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Col, Container, Form, Row, Spinner, Stack, Table } from 'react-bootstrap';
import { FaTrash } from 'react-icons/fa';
import { formatCurrency } from '../utils/format';
import '../styles/saleForm.css';
import { getBaseApiUrl, getImageInitial, resolveImageUrl } from '../utils/image';

function EditPurchasePage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const returnTo = location.state?.returnTo ?? null;

    const navigateBackToOrigin = () => {
        if (returnTo) {
            navigate(returnTo, { replace: true });
            return;
        }

        navigate('/purchases');
    };

    // Data state
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);

    // Form state
    const [formData, setFormData] = useState({
        supplier_id: '',
        purchase_date: '',
        bill_number: '',
        account: '',
        items: []
    });

    // UI state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const hasWarehouses = warehouses.length > 0;
    const baseApiUrl = useMemo(() => getBaseApiUrl(), []);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [suppliersRes, productsRes, accountsRes, warehouseRes, purchaseRes] = await Promise.all([
                    axiosInstance.get('suppliers/'),
                    axiosInstance.get('/products/'),
                    axiosInstance.get('/accounts/'),
                    axiosInstance.get('/warehouses/'),
                    axiosInstance.get(`/purchases/${id}/`)
                ]);

                setSuppliers(suppliersRes.data);
                setProducts(productsRes.data);
                setAccounts(accountsRes.data);
                setWarehouses(warehouseRes.data);

                const purchaseData = purchaseRes.data;
                setFormData({
                    supplier_id: purchaseData.supplier,
                    purchase_date: purchaseData.purchase_date,
                    bill_number: purchaseData.bill_number || '',
                    account: purchaseData.account || '',
                    items: purchaseData.items.map(item => ({
                        product_id: item.product.id,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                        warehouse_id: item.warehouse_id,
                    }))
                });

            } catch (err) {
                setError('Failed to load initial data.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, [id]);

    useEffect(() => {
        if (!warehouses.length) return;
        setFormData(prev => ({
            ...prev,
            items: prev.items.map(item => ({
                ...item,
                warehouse_id: item.warehouse_id || warehouses[0]?.id || '',
            })),
        }));
    }, [warehouses]);

    // --- Helper Functions ---
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleItemChange = (index, event) => {
        const values = [...formData.items];
        const { name, value } = event.target;
        values[index][name] = value;
        if (name === 'product_id') {
            const selectedProduct = products.find(p => p.id.toString() === value);
            values[index]['unit_price'] = selectedProduct ? selectedProduct.purchase_price : '';
        }
        setFormData(prev => ({ ...prev, items: values }));
    };

    const handleAddItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    product_id: '',
                    quantity: 1,
                    unit_price: '',
                    warehouse_id: warehouses[0]?.id || '',
                },
            ]
        }));
    };

    const handleRemoveItem = (index) => {
        const values = [...formData.items];
        values.splice(index, 1);
        setFormData(prev => ({ ...prev, items: values }));
    };
    // -------------------------

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Create a clean data object to send
        const dataToSubmit = {
            ...formData,
            supplier_id: parseInt(formData.supplier_id),
            account: formData.account ? parseInt(formData.account) : null,
            items: formData.items.map(item => ({
                ...item,
                product_id: parseInt(item.product_id),
                quantity: parseFloat(item.quantity),
                unit_price: parseFloat(item.unit_price),
                warehouse_id: parseInt(item.warehouse_id),
            }))
        };
        try {
            await axiosInstance.put(`/purchases/${id}/`, dataToSubmit);
            navigateBackToOrigin();
        } catch (err) {
            console.error('Failed to update purchase:', err.response?.data);
            setError('Failed to update purchase. Please check all fields.');
        }
    };

    if (loading) return <div className="text-center"><Spinner animation="border" /></div>;
    if (error && !formData.items.length) return <Alert variant="danger">{error}</Alert>;

    const selectedSupplier = suppliers.find((supplier) => supplier.id === Number(formData.supplier_id));
    const supplierCurrency = selectedSupplier?.currency || 'USD';
    const totalQuantity = formData.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const totalAmount = formData.items.reduce((sum, item) => {
        const quantity = Number(item.quantity) || 0;
        const price = Number(item.unit_price) || 0;
        return sum + quantity * price;
    }, 0);

    return (
        <Container className="sale-form__container">
            <Form onSubmit={handleSubmit}>
                <Row className="sale-form__layout">
                    <Col xl={4} lg={5} className="mb-4">
                        <Card className="sale-form__sidebar-card">
                            <Card.Header>
                                <div className="sale-form__sidebar-title">
                                    <div className="sale-form__sidebar-label">Edit Purchase</div>
                                    <div className="sale-form__sidebar-entity">{selectedSupplier?.name || 'Choose supplier'}</div>
                                </div>
                                {selectedSupplier && (
                                    <div className="sale-form__entity-meta mt-3">
                                        {selectedSupplier.email && <span>{selectedSupplier.email}</span>}
                                        {selectedSupplier.phone && <span>{selectedSupplier.phone}</span>}
                                        <span>{supplierCurrency} account</span>
                                    </div>
                                )}
                            </Card.Header>
                            <Card.Body>
                                <Row className="gy-3">
                                    <Col xs={12}>
                                        <Form.Group controlId="editPurchaseSupplier">
                                            <Form.Label>Supplier</Form.Label>
                                            <Form.Select
                                                name="supplier_id"
                                                value={formData.supplier_id}
                                                onChange={handleInputChange}
                                                required
                                            >
                                                <option value="">Select a Supplier</option>
                                                {suppliers.map((supplier) => (
                                                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                                                ))}
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group controlId="editPurchaseDate">
                                            <Form.Label>Purchase Date</Form.Label>
                                            <Form.Control
                                                type="date"
                                                name="purchase_date"
                                                value={formData.purchase_date}
                                                onChange={handleInputChange}
                                                required
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group controlId="editPurchaseBill">
                                            <Form.Label>Bill / Invoice #</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="bill_number"
                                                value={formData.bill_number}
                                                onChange={handleInputChange}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12}>
                                        <Form.Group controlId="editPurchaseAccount">
                                            <Form.Label>Account</Form.Label>
                                            <Form.Select
                                                name="account"
                                                value={formData.account}
                                                onChange={handleInputChange}
                                            >
                                                <option value="">No Account</option>
                                                {accounts.map((account) => {
                                                    const formattedBalance = formatCurrency(
                                                        account.balance ?? 0,
                                                        account.currency || selectedSupplier?.currency || 'USD',
                                                    );
                                                    return (
                                                        <option key={account.id} value={account.id}>
                                                            {account.name} ({formattedBalance})
                                                        </option>
                                                    );
                                                })}
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                </Row>

                                <div className="sale-form__summary mt-4">
                                    <div className="sale-form__summary-row">
                                        <span>Line items</span>
                                        <span>{formData.items.length}</span>
                                    </div>
                                    <div className="sale-form__summary-row">
                                        <span>Total quantity</span>
                                        <span>{totalQuantity}</span>
                                    </div>
                                    <div className="sale-form__summary-row sale-form__summary-row--strong">
                                        <span>Grand total</span>
                                        <span>{formatCurrency(totalAmount, supplierCurrency)}</span>
                                    </div>
                                </div>
                            </Card.Body>
                            <Card.Footer>
                                <Stack gap={2}>
                                    <Button type="submit" variant="success" disabled={!hasWarehouses}>
                                        Update Purchase
                                    </Button>
                                    <Button
                                        variant="outline-secondary"
                                        type="button"
                                        onClick={navigateBackToOrigin}
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
                                        <h5 className="mb-0">Purchase Items</h5>
                                        <small className="text-muted">Adjust the products, warehouses, and cost for this purchase.</small>
                                    </div>
                                    <Button
                                        variant="outline-primary"
                                        type="button"
                                        onClick={handleAddItem}
                                        disabled={!hasWarehouses}
                                    >
                                        + Add Item
                                    </Button>
                                </div>
                            </Card.Header>
                            <Card.Body>
                                {!hasWarehouses && (
                                    <Alert variant="warning" className="mb-3">
                                        No warehouses available. Please create a warehouse before updating purchases.
                                    </Alert>
                                )}
                                {error && (
                                    <Alert variant="danger" className="mb-3">
                                        {error}
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
                                            {formData.items.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="text-center text-muted py-4">
                                                        Add products using the button above to build this purchase.
                                                    </td>
                                                </tr>
                                            )}
                                            {formData.items.map((item, index) => {
                                                const product = products.find((p) => p.id === Number(item.product_id));
                                                const warehouse = warehouses.find((w) => w.id === Number(item.warehouse_id));
                                                const warehouseQuantity = product?.warehouse_quantities?.find(
                                                    (stock) => stock.warehouse_id === Number(item.warehouse_id)
                                                );
                                                const availableStock = warehouseQuantity ? Number(warehouseQuantity.quantity) : null;
                                                const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
                                                const resolvedImage = resolveImageUrl(product?.image, baseApiUrl);
                                                const imageInitial = getImageInitial(product?.name);

                                                return (
                                                    <tr key={`${index}-${item.product_id || 'new'}`}>
                                                        <td>
                                                            <div className="sale-items-table__product product-name-cell">
                                                                <div className="product-name-cell__image">
                                                                    {resolvedImage ? (
                                                                        <img src={resolvedImage} alt={product?.name || 'Product preview'} />
                                                                    ) : (
                                                                        <span>{imageInitial}</span>
                                                                    )}
                                                                </div>
                                                                <div className="sale-items-table__info product-name-cell__info">
                                                                    <div className="sale-items-table__field">
                                                                        <Form.Select
                                                                            name="product_id"
                                                                            value={item.product_id}
                                                                            onChange={(event) => handleItemChange(index, event)}
                                                                            required
                                                                        >
                                                                            <option value="">Select a Product</option>
                                                                            {products.map((productOption) => (
                                                                                <option key={productOption.id} value={productOption.id}>
                                                                                    {productOption.name}
                                                                                </option>
                                                                            ))}
                                                                        </Form.Select>
                                                                    </div>
                                                                    <div className="sale-items-table__meta product-name-cell__meta">
                                                                        {product?.sku && <span>SKU: {product.sku}</span>}
                                                                        {product?.category_name && <span>{product.category_name}</span>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="sale-items-table__field">
                                                                <Form.Select
                                                                    name="warehouse_id"
                                                                    value={item.warehouse_id}
                                                                    onChange={(event) => handleItemChange(index, event)}
                                                                    required
                                                                    disabled={!hasWarehouses}
                                                                >
                                                                    <option value="">Select a Warehouse</option>
                                                                    {warehouses.map((warehouseOption) => (
                                                                        <option key={warehouseOption.id} value={warehouseOption.id}>
                                                                            {warehouseOption.name}
                                                                        </option>
                                                                    ))}
                                                                </Form.Select>
                                                            </div>
                                                            {!warehouse && (
                                                                <small className="text-muted">Choose where this stock is received.</small>
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
                                                        <td className="text-center">
                                                            <div className="sale-items-table__field">
                                                                <Form.Control
                                                                    type="number"
                                                                    min="0"
                                                                    step="0.01"
                                                                    name="quantity"
                                                                    value={item.quantity}
                                                                    onChange={(event) => handleItemChange(index, event)}
                                                                    required
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="text-end">
                                                            <div className="sale-items-table__field">
                                                                <Form.Control
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    name="unit_price"
                                                                    value={item.unit_price}
                                                                    onChange={(event) => handleItemChange(index, event)}
                                                                    required
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="text-end">{formatCurrency(lineTotal, supplierCurrency)}</td>
                                                        <td className="text-end">
                                                            <div className="sale-items-table__actions">
                                                                <Button
                                                                    variant="outline-danger"
                                                                    size="sm"
                                                                    onClick={() => handleRemoveItem(index)}
                                                                >
                                                                    <FaTrash />
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
        </Container>
    );
}

export default EditPurchasePage;
