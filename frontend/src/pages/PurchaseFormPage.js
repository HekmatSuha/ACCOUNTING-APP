// frontend/src/pages/PurchaseFormPage.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Container, Card, Form, Button, Row, Col, Table } from 'react-bootstrap';
import { Trash } from 'react-bootstrap-icons';

function PurchaseFormPage() {
    const { supplierId, customerId } = useParams();
    const navigate = useNavigate();

    const [partner, setPartner] = useState(null);
    const [allProducts, setAllProducts] = useState([]);
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
    const [lineItems, setLineItems] = useState([{ product_id: '', quantity: 1, unit_price: 0 }]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [partnerRes, prodRes] = await Promise.all([
                    supplierId
                        ? axiosInstance.get(`/suppliers/${supplierId}/`)
                        : axiosInstance.get(`/customers/${customerId}/`),
                    axiosInstance.get('/products/')
                ]);
                setPartner(partnerRes.data);
                setAllProducts(prodRes.data);
            } catch (error) { console.error("Failed to fetch initial data", error); }
        };
        fetchData();
    }, [supplierId, customerId]);

    const handleLineItemChange = (index, event) => {
        const values = [...lineItems];
        values[index][event.target.name] = event.target.value;

        if (event.target.name === 'product_id') {
            const selectedProduct = allProducts.find(p => p.id === parseInt(event.target.value));
            values[index].unit_price = selectedProduct ? selectedProduct.purchase_price : 0;
        }
        setLineItems(values);
    };

    const handleAddItem = () => {
        setLineItems([...lineItems, { product_id: '', quantity: 1, unit_price: 0 }]);
    };

    const handleRemoveItem = (index) => {
        const values = [...lineItems];
        values.splice(index, 1);
        setLineItems(values);
    };

    const calculateTotal = () => {
        return lineItems.reduce((total, item) => total + (item.quantity * item.unit_price), 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            purchase_date: purchaseDate,
            items: lineItems.filter(item => item.product_id)
        };
        if (supplierId) {
            payload.supplier_id = supplierId;
        } else {
            payload.customer_id = customerId;
        }

        try {
            await axiosInstance.post('/purchases/', payload);
            navigate(supplierId ? `/suppliers/${supplierId}` : `/customers/${customerId}`);
        } catch (error) {
            console.error("Failed to create purchase", error.response?.data);
        }
    };

    if (!partner) return <div>Loading...</div>;

    return (
        <Container>
            <Card>
                <Card.Header as="h4">{`New Purchase from ${partner.name}`}</Card.Header>
                <Card.Body>
                    <Form onSubmit={handleSubmit}>
                        <Row className="mb-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label>Purchase Date</Form.Label>
                                    <Form.Control type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                                </Form.Group>
                            </Col>
                        </Row>

                          <h5>Items</h5>
                          <Table striped bordered hover responsive>
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Quantity</th>
                                    <th>Unit Price</th>
                                    <th>Line Total</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lineItems.map((item, index) => (
                                    <tr key={index}>
                                        <td>
                                            <Form.Select name="product_id" value={item.product_id} onChange={e => handleLineItemChange(index, e)}>
                                                <option>Select Product</option>
                                                {allProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                            </Form.Select>
                                        </td>
                                        <td><Form.Control type="number" name="quantity" value={item.quantity} onChange={e => handleLineItemChange(index, e)} /></td>
                                        <td><Form.Control type="number" step="0.01" name="unit_price" value={item.unit_price} onChange={e => handleLineItemChange(index, e)} /></td>
                                        <td>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.quantity * item.unit_price)}</td>
                                        <td><Button variant="danger" onClick={() => handleRemoveItem(index)}><Trash /></Button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                        <Button variant="secondary" onClick={handleAddItem}>+ Add Item</Button>

                        <div className="d-flex justify-content-end mt-3">
                            <h3>Total: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(calculateTotal())}</h3>
                        </div>

                        <div className="mt-4">
                            <Button variant="success" type="submit">Save Purchase</Button>
                            <Button variant="light" className="ms-2" onClick={() => navigate(supplierId ? `/suppliers/${supplierId}` : `/customers/${customerId}`)}>Cancel</Button>
                        </div>
                    </Form>
                </Card.Body>
            </Card>
        </Container>
    );
}

export default PurchaseFormPage;
