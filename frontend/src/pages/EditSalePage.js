// frontend/src/pages/EditSalePage.js

import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Col, Container, Form, Row, Spinner, Stack, Table } from 'react-bootstrap';
import { FaTrash } from 'react-icons/fa';
import { formatCurrency } from '../utils/format';
import '../styles/datatable.css';
import '../styles/saleForm.css';

function EditSalePage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [customerId, setCustomerId] = useState('');
    const [saleItems, setSaleItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const hasWarehouses = warehouses.length > 0;

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [customerRes, productRes, warehouseRes, saleRes] = await Promise.all([
                    axiosInstance.get('/customers/'),
                    axiosInstance.get('/products/'),
                    axiosInstance.get('/warehouses/'),
                    axiosInstance.get(`/sales/${id}/`)
                ]);
                setCustomers(customerRes.data);
                setProducts(productRes.data);
                setWarehouses(warehouseRes.data);
                const saleData = saleRes.data;
                setCustomerId(saleData.customer);
                // The backend sends the full product object in the detail view, so we map it correctly
                setSaleItems(saleData.items.map(item => ({
                    product_id: item.product.id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    warehouse_id: item.warehouse_id,
                })));
            } catch (err) {
                setError('Failed to load initial sale data.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, [id]);

    useEffect(() => {
        if (!warehouses.length) return;
        setSaleItems(prev => prev.map(item => ({
            ...item,
            warehouse_id: item.warehouse_id || warehouses[0]?.id || '',
        })));
    }, [warehouses]);

    // --- PASTE THE 4 HELPER FUNCTIONS HERE ---
    const handleItemChange = (index, event) => {
        const values = [...saleItems];
        const { name, value } = event.target;
        values[index][name] = value;
        if (name === 'product_id') {
            const selectedProduct = products.find(p => p.id.toString() === value);
            values[index]['unit_price'] = selectedProduct ? selectedProduct.sale_price : '';
        }
        setSaleItems(values);
    };
    const handleAddItem = () => {
        setSaleItems([
            ...saleItems,
            {
                product_id: '',
                quantity: 1,
                unit_price: '',
                warehouse_id: warehouses[0]?.id || '',
            },
        ]);
    };
    const handleRemoveItem = (index) => {
        const values = [...saleItems];
        values.splice(index, 1);
        setSaleItems(values);
    };
    const calculateTotal = () => {
        return saleItems.reduce((total, item) => {
            const quantity = Number(item.quantity) || 0;
            const price = Number(item.unit_price) || 0;
            return total + quantity * price;
        }, 0);
    };
    // -----------------------------------------

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        const saleData = {
            customer_id: parseInt(customerId),
            items: saleItems.map(item => ({
                product_id: parseInt(item.product_id),
                quantity: parseInt(item.quantity),
                unit_price: parseFloat(item.unit_price),
                warehouse_id: parseInt(item.warehouse_id),
            }))
        };
        try {
            await axiosInstance.put(`/sales/${id}/`, saleData);
            navigate(`/sales/${id}`);
        } catch (err) {
            console.error(err);
            setError('Failed to update sale. Please check your input.');
        }
    };

    if (loading) return <div className="text-center"><Spinner animation="border" /></div>;
    if (error && !saleItems.length) return <Alert variant="danger">{error}</Alert>;

    const selectedCustomer = customers.find(customer => customer.id === Number(customerId)) || null;
    const customerCurrency = selectedCustomer?.currency || 'USD';
    const totalQuantity = saleItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const totalAmount = calculateTotal();

    return (
        <Container className="sale-form__container">
            <Form onSubmit={handleSubmit}>
                <Row className="sale-form__layout">
                    <Col xl={4} lg={5} className="mb-4">
                        <Card className="sale-form__sidebar-card">
                            <Card.Header>
                                <div className="sale-form__sidebar-title">
                                    <div className="sale-form__sidebar-label">Edit Sale</div>
                                    <div className="sale-form__sidebar-entity">{selectedCustomer?.name || 'Choose customer'}</div>
                                </div>
                                {selectedCustomer && (
                                    <div className="sale-form__entity-meta mt-3">
                                        {selectedCustomer.email && <span>{selectedCustomer.email}</span>}
                                        {selectedCustomer.phone && <span>{selectedCustomer.phone}</span>}
                                        <span>{customerCurrency} account</span>
                                    </div>
                                )}
                            </Card.Header>
                            <Card.Body>
                                <Row className="gy-3">
                                    <Col xs={12}>
                                        <Form.Group controlId="editSaleCustomer">
                                            <Form.Label>Customer</Form.Label>
                                            <Form.Select
                                                value={customerId}
                                                onChange={(event) => setCustomerId(event.target.value)}
                                                required
                                            >
                                                <option value="">Select a Customer</option>
                                                {customers.map(customer => (
                                                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                                                ))}
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                </Row>

                                <div className="sale-form__summary mt-4">
                                    <div className="sale-form__summary-row">
                                        <span>Line items</span>
                                        <span>{saleItems.length}</span>
                                    </div>
                                    <div className="sale-form__summary-row">
                                        <span>Total quantity</span>
                                        <span>{totalQuantity}</span>
                                    </div>
                                    <div className="sale-form__summary-row sale-form__summary-row--strong">
                                        <span>Grand total</span>
                                        <span>{formatCurrency(totalAmount, customerCurrency)}</span>
                                    </div>
                                </div>
                            </Card.Body>
                            <Card.Footer>
                                <Stack gap={2}>
                                    <Button type="submit" variant="success" disabled={!hasWarehouses}>
                                        Update Sale
                                    </Button>
                                    <Button
                                        variant="outline-secondary"
                                        type="button"
                                        onClick={() => navigate(`/sales/${id}`)}
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
                                        <h5 className="mb-0">Sale Items</h5>
                                        <small className="text-muted">Update the products and pricing for this sale.</small>
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
                                        No warehouses available. Please create a warehouse before updating sales.
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
                                                <th className="text-end">Unit Price</th>
                                                <th className="text-end">Line Total</th>
                                                <th className="text-end">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {saleItems.length === 0 && (
                                                <tr>
                                                    <td colSpan={7} className="text-center text-muted py-4">
                                                        Use the button above to add products to this sale.
                                                    </td>
                                                </tr>
                                            )}
                                            {saleItems.map((item, index) => {
                                                const product = products.find(p => p.id === Number(item.product_id));
                                                const warehouse = warehouses.find(w => w.id === Number(item.warehouse_id));
                                                const warehouseQuantity = product?.warehouse_quantities?.find(
                                                    stock => stock.warehouse_id === Number(item.warehouse_id)
                                                );
                                                const availableStock = warehouseQuantity ? Number(warehouseQuantity.quantity) : null;
                                                const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);

                                                return (
                                                    <tr key={`${index}-${item.product_id || 'new'}`}>
                                                        <td>
                                                            <div className="sale-items-table__product">
                                                                <div className="sale-items-table__field">
                                                                    <Form.Select
                                                                        name="product_id"
                                                                        value={item.product_id}
                                                                        onChange={(event) => handleItemChange(index, event)}
                                                                        required
                                                                    >
                                                                        <option value="">Select a Product</option>
                                                                        {products.map(productOption => (
                                                                            <option key={productOption.id} value={productOption.id}>
                                                                                {productOption.name}
                                                                            </option>
                                                                        ))}
                                                                    </Form.Select>
                                                                </div>
                                                                <div className="sale-items-table__meta">
                                                                    {product?.sku && <span>SKU: {product.sku}</span>}
                                                                    {product?.category_name && <span>{product.category_name}</span>}
                                                                    {product && (
                                                                        <span>
                                                                            Base: {formatCurrency(product.sale_price, customerCurrency)}
                                                                        </span>
                                                                    )}
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
                                                                    {warehouses.map(warehouseOption => (
                                                                        <option key={warehouseOption.id} value={warehouseOption.id}>
                                                                            {warehouseOption.name}
                                                                        </option>
                                                                    ))}
                                                                </Form.Select>
                                                            </div>
                                                            {!warehouse && (
                                                                <small className="text-muted">Choose where this item ships from.</small>
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
                                                        <td className="text-end">{formatCurrency(lineTotal, customerCurrency)}</td>
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

export default EditSalePage;