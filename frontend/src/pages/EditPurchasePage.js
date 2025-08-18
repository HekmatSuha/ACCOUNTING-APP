// frontend/src/pages/EditPurchasePage.js

import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { useNavigate, useParams } from 'react-router-dom';
import { Form, Button, Card, Row, Col, Table, Alert, Spinner } from 'react-bootstrap';
import { FaTrash } from 'react-icons/fa';

function EditPurchasePage() {
    const { id } = useParams();
    const navigate = useNavigate();

    // Data state
    const [suppliers, setSuppliers] = useState([]);
    const [products, setProducts] = useState([]);
    const [accounts, setAccounts] = useState([]);

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

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [suppliersRes, productsRes, accountsRes, purchaseRes] = await Promise.all([
                    axiosInstance.get('/suppliers/'),
                    axiosInstance.get('/products/'),
                    axiosInstance.get('/accounts/'),
                    axiosInstance.get(`/purchases/${id}/`)
                ]);

                setSuppliers(suppliersRes.data);
                setProducts(productsRes.data);
                setAccounts(accountsRes.data);

                const purchaseData = purchaseRes.data;
                setFormData({
                    supplier_id: purchaseData.supplier,
                    purchase_date: purchaseData.purchase_date,
                    bill_number: purchaseData.bill_number || '',
                    account: purchaseData.account || '',
                    items: purchaseData.items.map(item => ({
                        product_id: item.product.id,
                        quantity: item.quantity,
                        unit_price: item.unit_price
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
            items: [...prev.items, { product_id: '', quantity: 1, unit_price: '' }]
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
                unit_price: parseFloat(item.unit_price)
            }))
        };
        try {
            await axiosInstance.put(`/purchases/${id}/`, dataToSubmit);
            navigate(`/purchases/${id}`);
        } catch (err) {
            console.error('Failed to update purchase:', err.response?.data);
            setError('Failed to update purchase. Please check all fields.');
        }
    };

    if (loading) return <div className="text-center"><Spinner animation="border" /></div>;
    if (error && !formData.items.length) return <Alert variant="danger">{error}</Alert>;

    return (
        <Card>
            <Card.Header><h4>Edit Purchase</h4></Card.Header>
            <Card.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                <Form onSubmit={handleSubmit}>
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

                    <div className="mt-4 d-flex justify-content-end">
                        <Button variant="light" className="me-2" onClick={() => navigate(`/purchases/${id}`)}>
                            Cancel
                        </Button>
                        <Button variant="primary" type="submit">
                            Update Purchase
                        </Button>
                    </div>
                </Form>
            </Card.Body>
        </Card>
    );
}

export default EditPurchasePage;
