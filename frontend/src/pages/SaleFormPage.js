// frontend/src/pages/SaleFormPage.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Container, Card, Form, Button, Row, Col, Table, InputGroup } from 'react-bootstrap';
import { Trash } from 'react-bootstrap-icons';

function SaleFormPage() {
    const { customerId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const isOffer = new URLSearchParams(location.search).get('type') === 'offer';

    const [customer, setCustomer] = useState(null);
    const [allProducts, setAllProducts] = useState([]);
    const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
    const [lineItems, setLineItems] = useState([{ product_id: '', quantity: 1, unit_price: 0 }]);
    
    useEffect(() => {
        // Fetch customer and all products
        const fetchData = async () => {
            try {
                const [custRes, prodRes] = await Promise.all([
                    axiosInstance.get(`/customers/${customerId}/`),
                    axiosInstance.get('/products/')
                ]);
                setCustomer(custRes.data);
                setAllProducts(prodRes.data);
            } catch (error) { console.error("Failed to fetch initial data", error); }
        };
        fetchData();
    }, [customerId]);

    const handleLineItemChange = (index, event) => {
        const values = [...lineItems];
        values[index][event.target.name] = event.target.value;

        // If product changes, update the price
        if (event.target.name === 'product_id') {
            const selectedProduct = allProducts.find(p => p.id === parseInt(event.target.value));
            values[index].unit_price = selectedProduct ? selectedProduct.sale_price : 0;
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
        // Base payload used for both sales and offers
        const payload = {
            items: lineItems.filter(item => item.product_id)
        };

        // Choose the correct endpoint and augment payload as needed
        let url;
        if (isOffer) {
            // When creating an offer, use the nested customer route and
            // avoid sending sale-specific fields like ``sale_date``.
            url = `/customers/${customerId}/offers/`;
        } else {
            url = '/sales/';
            payload.customer_id = customerId;
            payload.sale_date = saleDate;
        }

        try {
            await axiosInstance.post(url, payload);
            // Redirect back to the customer detail page after creation
            navigate(`/customers/${customerId}`);
        } catch (error) {
            console.error("Failed to create sale", error.response?.data);
        }
    };
    
    if (!customer) return <div>Loading...</div>;

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
                                        <td>{new Intl.NumberFormat('en-US', { style: 'currency', currency: customer.currency }).format(item.quantity * item.unit_price)}</td>
                                        <td><Button variant="danger" onClick={() => handleRemoveItem(index)}><Trash /></Button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                        <Button variant="secondary" onClick={handleAddItem}>+ Add Item</Button>

                        <div className="d-flex justify-content-end mt-3">
                            <h3>Total: {new Intl.NumberFormat('en-US', { style: 'currency', currency: customer.currency }).format(calculateTotal())}</h3>
                        </div>
                        
                        <div className="mt-4">
                            <Button variant="success" type="submit">{isOffer ? 'Save Offer' : 'Save Sale'}</Button>
                            <Button variant="light" className="ms-2" onClick={() => navigate(`/customers/${customerId}`)}>Cancel</Button>
                        </div>
                    </Form>
                </Card.Body>
            </Card>
        </Container>
    );
}

export default SaleFormPage;