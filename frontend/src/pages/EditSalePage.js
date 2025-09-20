// frontend/src/pages/EditSalePage.js

import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { useNavigate, useParams } from 'react-router-dom';
import { Form, Button, Card, Row, Col, Table, Alert, Spinner } from 'react-bootstrap';
import { FaTrash } from 'react-icons/fa';
import { formatCurrency } from '../utils/format';
import '../styles/datatable.css';

function EditSalePage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [customerId, setCustomerId] = useState('');
    const [saleItems, setSaleItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [customerRes, productRes, saleRes] = await Promise.all([
                    axiosInstance.get('/customers/'),
                    axiosInstance.get('/products/'),
                    axiosInstance.get(`/sales/${id}/`)
                ]);
                setCustomers(customerRes.data);
                setProducts(productRes.data);
                const saleData = saleRes.data;
                setCustomerId(saleData.customer);
                // The backend sends the full product object in the detail view, so we map it correctly
                setSaleItems(saleData.items.map(item => ({
                    product_id: item.product.id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
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
        setSaleItems([...saleItems, { product_id: '', quantity: 1, unit_price: '' }]);
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
                unit_price: parseFloat(item.unit_price)
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

    // --- PASTE THE ENTIRE JSX RETURN BLOCK HERE ---
    return (
        <Card>
            <Card.Header><h4>Edit Sale</h4></Card.Header>
            <Card.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                <Form onSubmit={handleSubmit}>
                    <Row className="mb-3">
                        <Form.Group as={Col} controlId="formCustomer">
                            <Form.Label>Customer</Form.Label>
                            <Form.Select value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                                <option value="">Select a Customer</option>
                                {customers.map(customer => (
                                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Row>
                      <h5>Sale Items</h5>
                      <div className="data-table-container">
                        <Table responsive className="data-table data-table--compact">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Quantity</th>
                                <th>Unit Price</th>
                                <th>Line Total</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {saleItems.map((item, index) => (
                                <tr key={index}>
                                    <td>
                                        <Form.Select name="product_id" value={item.product_id} onChange={e => handleItemChange(index, e)} required>
                                            <option value="">Select a Product</option>
                                            {products.map(product => (
                                                <option key={product.id} value={product.id}>{product.name}</option>
                                            ))}
                                        </Form.Select>
                                    </td>
                                    <td>
                                        <Form.Control type="number" name="quantity" value={item.quantity} onChange={e => handleItemChange(index, e)} min="1" required />
                                    </td>
                                    <td>
                                        <Form.Control type="number" name="unit_price" value={item.unit_price} onChange={e => handleItemChange(index, e)} step="0.01" required />
                                    </td>
                                    <td>{formatCurrency((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}</td>
                                    <td>
                                        <Button variant="danger" onClick={() => handleRemoveItem(index)}><FaTrash /></Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        </Table>
                      </div>
                    <Button variant="secondary" onClick={handleAddItem} className="mb-3">+ Add Item</Button>
                    <div className="text-end">
                        <h3>Total: {formatCurrency(calculateTotal())}</h3>
                    </div>
                    <div className="mt-3">
                        <Button variant="primary" type="submit">Update Sale</Button>
                        <Button variant="light" className="ms-2" onClick={() => navigate(`/sales/${id}`)}>Cancel</Button>
                    </div>
                </Form>
            </Card.Body>
        </Card>
    );
    // -------------------------------------------
}

export default EditSalePage;