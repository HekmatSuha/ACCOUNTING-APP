// frontend/src/pages/PurchaseListPage.js

import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { Link } from 'react-router-dom';
import { Form, Button, Card, Row, Col, Table, Alert, Modal, Spinner } from 'react-bootstrap';
import { FaTrash } from 'react-icons/fa';

const getTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

function PurchaseListPage() {
    // Data state
    const [purchases, setPurchases] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [accounts, setAccounts] = useState([]);

    // Modal & form state
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        supplier_id: '',
        purchase_date: getTodayDate(),
        bill_number: '',
        account: '',
        items: [{ product_id: '', quantity: 1, unit_price: '' }]
    });

    // UI state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchData = async () => {
        try {
            const [purchasesRes, suppliersRes, productsRes, accountsRes] = await Promise.all([
                axiosInstance.get('/purchases/'),
                axiosInstance.get('/suppliers/'),
                axiosInstance.get('/products/'),
                axiosInstance.get('/accounts/')
            ]);
            setPurchases(purchasesRes.data);
            setSuppliers(suppliersRes.data);
            setProducts(productsRes.data);
            setAccounts(accountsRes.data);
        } catch (err) {
            setError('Could not fetch initial data.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleShowModal = () => {
        setFormData({
            supplier_id: '',
            purchase_date: getTodayDate(),
            bill_number: '',
            account: '',
            items: [{ product_id: '', quantity: 1, unit_price: '' }]
        });
        setShowModal(true);
        setError('');
    };

    const handleCloseModal = () => setShowModal(false);

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
            items: [...prev.items, { product_id: '', quantity: 1, unit_price: '' }]
        }));
    };

    const handleRemoveItem = (index) => {
        const values = [...formData.items];
        values.splice(index, 1);
        setFormData(prev => ({ ...prev, items: values }));
    };

    // --- THIS FUNCTION HAS BEEN CORRECTED ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Create a new object and convert all relevant string values to numbers
        const dataToSubmit = {
            ...formData,
            supplier_id: parseInt(formData.supplier_id, 10),
            account: formData.account ? parseInt(formData.account, 10) : null,
            items: formData.items.map(item => ({
                product_id: parseInt(item.product_id, 10),
                quantity: parseFloat(item.quantity),
                unit_price: parseFloat(item.unit_price)
            }))
        };

        try {
            await axiosInstance.post('/purchases/', dataToSubmit);
            fetchData();
            handleCloseModal();
        } catch (err) {
            // This improved error handling will now show specific messages from the backend
            if (err.response && err.response.data) {
                const errorData = err.response.data;
                const errorMessages = Object.keys(errorData).map(key => {
                    const message = errorData[key];
                    const formattedMessage = Array.isArray(message) ? message.join(' ') : message;
                    return `${key.replace("_", " ")}: ${formattedMessage}`;
                }).join(' | ');
                setError(errorMessages);
            } else {
                setError('Failed to save purchase. An unknown error occurred.');
            }
            console.error('Failed to save purchase:', err.response?.data);
        }
    };

    if (loading) return <div className="text-center"><Spinner animation="border" /></div>;

    return (
        <>
            <Card>
                <Card.Header className="d-flex justify-content-between align-items-center">
                    <h4>Purchases</h4>
                    <Button variant="primary" onClick={handleShowModal}>
                        + New Purchase
                    </Button>
                </Card.Header>
                <Card.Body>
                    {error && !showModal && <Alert variant="danger">{error}</Alert>}
                    <Table striped bordered hover responsive>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Supplier</th>
                                <th>Bill #</th>
                                <th>Account</th>
                                <th>Total Amount</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {purchases.map(purchase => (
                                <tr key={purchase.id}>
                                    <td>{purchase.purchase_date}</td>
                                    <td>{purchase.supplier_name}</td>
                                    <td>{purchase.bill_number || 'N/A'}</td>
                                    <td>{purchase.account_name || 'N/A'}</td>
                                    <td>${parseFloat(purchase.total_amount).toFixed(2)}</td>
                                    <td>
                                        <Button as={Link} to={`/purchases/${purchase.id}`} variant="info" size="sm">View</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Card.Body>
            </Card>

            <Modal show={showModal} onHide={handleCloseModal} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Record New Purchase</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleSubmit}>
                    <Modal.Body>
                        {error && <Alert variant="danger">{error}</Alert>}
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Supplier</Form.Label>
                                    <Form.Select name="supplier_id" value={formData.supplier_id} onChange={handleInputChange} required>
                                        <option value="">Select a Supplier</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={3}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Purchase Date</Form.Label>
                                    <Form.Control type="date" name="purchase_date" value={formData.purchase_date} onChange={handleInputChange} required />
                                </Form.Group>
                            </Col>
                            <Col md={3}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Bill / Invoice #</Form.Label>
                                    <Form.Control type="text" name="bill_number" value={formData.bill_number} onChange={handleInputChange} />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Account</Form.Label>
                                    <Form.Select name="account" value={formData.account} onChange={handleInputChange}>
                                        <option value="">No Account</option>
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>
                        <hr />
                        <h6>Items</h6>
                        {formData.items.map((item, index) => (
                            <Row key={index} className="align-items-end mb-2">
                                <Col md={5}>
                                    <Form.Label>Product</Form.Label>
                                    <Form.Select name="product_id" value={item.product_id} onChange={e => handleItemChange(index, e)} required>
                                        <option value="">Select a Product</option>
                                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </Form.Select>
                                </Col>
                                <Col md={2}>
                                    <Form.Label>Quantity</Form.Label>
                                    <Form.Control type="number" name="quantity" value={item.quantity} onChange={e => handleItemChange(index, e)} required />
                                </Col>
                                <Col md={3}>
                                    <Form.Label>Unit Price (Cost)</Form.Label>
                                    <Form.Control type="number" step="0.01" name="unit_price" value={item.unit_price} onChange={e => handleItemChange(index, e)} required />
                                </Col>
                                <Col md={2}>
                                    <Button variant="danger" onClick={() => handleRemoveItem(index)}><FaTrash /></Button>
                                </Col>
                            </Row>
                        ))}
                        <Button variant="secondary" onClick={handleAddItem} className="mt-2">+ Add Item</Button>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="light" onClick={handleCloseModal}>Cancel</Button>
                        <Button variant="primary" type="submit">Save Purchase</Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </>
    );
}

export default PurchaseListPage;