// frontend/src/pages/SaleFormPage.js

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Container, Card, Form, Button, Row, Col, Table, Alert, Image, Badge } from 'react-bootstrap';
import { Trash } from 'react-bootstrap-icons';
import '../styles/datatable.css';
import '../styles/saleForm.css';
import ProductSearchSelect from '../components/ProductSearchSelect';

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
    const [lineItems, setLineItems] = useState([{ product_id: '', quantity: 1, unit_price: 0, warehouse_id: '', discount: 0 }]);
    
    useEffect(() => {
        // Fetch customer/supplier and all products
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
        setLineItems(prev => prev.map(item => ({
            ...item,
            warehouse_id: item.warehouse_id || warehouses[0]?.id || '',
        })));
    }, [warehouses]);

    const baseApiUrl = useMemo(() => {
        const apiBase = axiosInstance.defaults.baseURL || '';
        return apiBase.replace(/\/?api\/?$/, '');
    }, []);

    const getProductById = (productId) => {
        if (!productId) return null;
        return allProducts.find(p => p.id === Number(productId)) || null;
    };

    const handleProductSelect = (index, product) => {
        setLineItems(prev => {
            const updated = [...prev];
            const warehouseId = updated[index].warehouse_id || warehouses[0]?.id || '';
            updated[index] = {
                ...updated[index],
                product_id: product?.id || '',
                unit_price: product ? Number(product.sale_price) : 0,
                discount: 0,
                warehouse_id: warehouseId,
            };
            return updated;
        });
    };

    const handleLineItemChange = (index, event) => {
        const { name } = event.target;
        let { value } = event.target;
        setLineItems(prev => {
            const values = [...prev];
            const current = { ...values[index] };

            if (name === 'quantity' || name === 'unit_price' || name === 'discount') {
                value = Number(value);
            }

            if (name === 'discount') {
                const boundedDiscount = Math.min(Math.max(value || 0, 0), 100);
                current.discount = boundedDiscount;
                const selectedProduct = getProductById(current.product_id);
                if (selectedProduct) {
                    const basePrice = Number(selectedProduct.sale_price) || 0;
                    current.unit_price = Number((basePrice * (1 - boundedDiscount / 100)).toFixed(2));
                }
            } else if (name === 'unit_price') {
                current.unit_price = value || 0;
                current.discount = 0;
            } else if (name === 'quantity') {
                current.quantity = value ? Math.max(value, 0) : 0;
            } else if (name === 'warehouse_id') {
                current.warehouse_id = value;
            } else if (name === 'product_id') {
                current.product_id = value;
                const selectedProduct = getProductById(value);
                current.unit_price = selectedProduct ? Number(selectedProduct.sale_price) : 0;
                current.discount = 0;
            }

            values[index] = current;
            return values;
        });
    };

    const handleAddItem = () => {
        setLineItems([
            ...lineItems,
            {
                product_id: '',
                quantity: 1,
                unit_price: 0,
                warehouse_id: warehouses[0]?.id || '',
                discount: 0,
            },
        ]);
    };

    const handleRemoveItem = (index) => {
        const values = [...lineItems];
        values.splice(index, 1);
        setLineItems(values);
    };

    const calculateTotal = () => {
        return lineItems.reduce((total, item) => total + (Number(item.quantity) * Number(item.unit_price || 0)), 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Base payload used for both sales and offers
        const payloadItems = lineItems
            .filter(item => item.product_id)
            .map(item => {
                const base = {
                    product_id: parseInt(item.product_id, 10),
                    quantity: Number(item.quantity),
                    unit_price: parseFloat(item.unit_price),
                };
                if (!isOffer) {
                    base.warehouse_id = parseInt(item.warehouse_id, 10);
                }
                return base;
            });

        const payload = { items: payloadItems };

        // Choose the correct endpoint and augment payload as needed
        let url;
        if (isOffer) {
            // When creating an offer, use the nested customer route and
            // avoid sending sale-specific fields like ``sale_date``.
            url = `/customers/${entityId}/offers/`;
        } else {
            url = '/sales/';
            payload.customer_id = entityId;
            payload.sale_date = saleDate;
        }

        try {
            await axiosInstance.post(url, payload);
            // Redirect back to the detail page after creation
            navigate(isSupplierSale ? `/suppliers/${entityId}` : `/customers/${entityId}`);
        } catch (error) {
            console.error("Failed to create sale", error.response?.data);
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
        <Container>
            <Card>
                <Card.Header as="h4">{isOffer ? `New Offer for ${customer.name}` : `New Sale for ${customer.name}`}</Card.Header>
                <Card.Body>
                    <Form onSubmit={handleSubmit}>
                        <Row className="mb-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>{isOffer ? 'Offer Date' : 'Sale Date'}</Form.Label>
                                    <Form.Control type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
                                </Form.Group>
                            </Col>
                        </Row>

                        <h5>Items</h5>
                        {!hasWarehouses && (
                            <Alert variant="warning">
                                No warehouses available. Please create a warehouse before recording sales.
                            </Alert>
                        )}
                        <div className="data-table-container">
                            <Table responsive className="data-table data-table--compact">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Quantity</th>
                                        <th>Warehouse</th>
                                        <th>Stock Remaining</th>
                                        <th>Discount (%)</th>
                                        <th>Unit Price</th>
                                        <th>Line Total</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineItems.map((item, index) => {
                                        const selectedProduct = getProductById(item.product_id);
                                        const warehouseQuantity = selectedProduct?.warehouse_quantities?.find(
                                            (stock) => stock.warehouse_id === Number(item.warehouse_id)
                                        );
                                        const stockRemaining = warehouseQuantity ? Number(warehouseQuantity.quantity) : null;
                                        const productImage = selectedProduct?.image
                                            ? (selectedProduct.image.startsWith('http')
                                                ? selectedProduct.image
                                                : `${baseApiUrl}${selectedProduct.image}`)
                                            : null;

                                        return (
                                            <tr key={index}>
                                                <td>
                                                    <div className="d-flex align-items-start gap-3">
                                                        <div className="sale-form__product-thumb">
                                                            {productImage ? (
                                                                <Image src={productImage} rounded thumbnail alt={selectedProduct?.name || 'Product preview'} />
                                                            ) : (
                                                                <div className="sale-form__product-placeholder">No Image</div>
                                                            )}
                                                        </div>
                                                        <div className="flex-grow-1">
                                                            <ProductSearchSelect
                                                                products={allProducts}
                                                                value={selectedProduct}
                                                                onSelect={(product) => handleProductSelect(index, product)}
                                                                placeholder="Search name or SKU"
                                                                imageBaseUrl={baseApiUrl}
                                                            />
                                                            {selectedProduct && (
                                                                <div className="mt-2 small text-muted">
                                                                    <div>{selectedProduct.sku ? `SKU: ${selectedProduct.sku}` : 'No SKU assigned'}</div>
                                                                    <div>Base price: {formatCurrency(Number(selectedProduct.sale_price))}</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <Form.Control
                                                        type="number"
                                                        name="quantity"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.quantity}
                                                        onChange={(e) => handleLineItemChange(index, e)}
                                                    />
                                                </td>
                                                <td>
                                                    <Form.Select
                                                        name="warehouse_id"
                                                        value={item.warehouse_id}
                                                        onChange={(e) => handleLineItemChange(index, e)}
                                                        disabled={!hasWarehouses}
                                                    >
                                                        <option value="">Select Warehouse</option>
                                                        {warehouses.map((warehouse) => (
                                                            <option key={warehouse.id} value={warehouse.id}>
                                                                {warehouse.name}
                                                            </option>
                                                        ))}
                                                    </Form.Select>
                                                </td>
                                                <td className="align-middle">
                                                    {selectedProduct ? (
                                                        <Badge bg={stockRemaining && stockRemaining > 0 ? 'success' : 'danger'}>
                                                            {stockRemaining !== null ? `${stockRemaining} available` : 'No data'}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted">Select a product</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <Form.Control
                                                        type="number"
                                                        name="discount"
                                                        min="0"
                                                        max="100"
                                                        step="0.1"
                                                        value={item.discount}
                                                        onChange={(e) => handleLineItemChange(index, e)}
                                                        placeholder="0"
                                                        disabled={!selectedProduct}
                                                    />
                                                </td>
                                                <td>
                                                    <Form.Control
                                                        type="number"
                                                        step="0.01"
                                                        name="unit_price"
                                                        value={item.unit_price}
                                                        onChange={(e) => handleLineItemChange(index, e)}
                                                        disabled={!selectedProduct}
                                                    />
                                                    <Form.Text muted>Final unit price</Form.Text>
                                                </td>
                                                <td className="fw-semibold align-middle">{formatCurrency(Number(item.quantity) * Number(item.unit_price || 0))}</td>
                                                <td className="text-center">
                                                    <Button variant="danger" onClick={() => handleRemoveItem(index)}>
                                                        <Trash />
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </Table>
                        </div>
                        <Button variant="secondary" onClick={handleAddItem} disabled={!hasWarehouses}>+ Add Item</Button>

                        <div className="d-flex justify-content-end mt-3">
                            <h3>Total: {formatCurrency(calculateTotal())}</h3>
                        </div>
                        
                        <div className="mt-4">
                            <Button variant="success" type="submit" disabled={!hasWarehouses}>{isOffer ? 'Save Offer' : 'Save Sale'}</Button>
                            <Button
                                variant="light"
                                className="ms-2"
                                onClick={() => navigate(isSupplierSale ? `/suppliers/${entityId}` : `/customers/${entityId}`)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </Form>
                </Card.Body>
            </Card>
        </Container>
    );
}

export default SaleFormPage;