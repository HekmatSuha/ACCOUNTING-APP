// frontend/src/pages/ProductFormPage.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Container, Card, Form, Button, Row, Col, Alert, Spinner } from 'react-bootstrap';

function ProductFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = Boolean(id);

    const [formData, setFormData] = useState({
        name: '', description: '', sku: '', purchase_price: 0.00, sale_price: 0.00, stock_quantity: 0
    });
    const [imageFile, setImageFile] = useState(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(isEditing);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isEditing) {
            setIsLoading(true);
            axiosInstance.get(`/products/${id}/`)
                .then(response => {
                    const { id: _removed, image, ...data } = response.data;
                    setFormData(data);
                    setError('');
                })
                .catch(() => setError('Failed to fetch product details.'))
                .finally(() => setIsLoading(false));
        } else {
            setIsLoading(false);
        }
    }, [id, isEditing]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const submissionData = new FormData();
        Object.keys(formData).forEach(key => {
            if (key !== 'image' && key !== 'id' && key !== 'stock_quantity') {
                submissionData.append(key, formData[key]);
            }
        });
        if (imageFile) {
            submissionData.append('image', imageFile);
        }
        const apiCall = isEditing
            ? axiosInstance.put(`/products/${id}/`, submissionData)
            : axiosInstance.post('/products/', submissionData);

        setIsSubmitting(true);
        try {
            await apiCall;
            navigate('/inventory');
        } catch (err) {
            setError('Failed to save product. Please check the fields.');
            console.error(err.response?.data);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isFormDisabled = isLoading || isSubmitting;

    return (
        <Container>
            <Card>
                <Card.Header as="h4">{isEditing ? 'Edit Product' : 'Create New Product'}</Card.Header>
                <Card.Body>
                    {error && <Alert variant="danger">{error}</Alert>}
                    {isLoading ? (
                        <div className="d-flex justify-content-center py-5">
                            <Spinner animation="border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </Spinner>
                        </div>
                    ) : (
                        <Form onSubmit={handleSubmit}>
                            <Row>
                                <Col md={8}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Product Name <span className="text-danger">*</span></Form.Label>
                                        <Form.Control type="text" name="name" value={formData.name} onChange={handleChange} required disabled={isFormDisabled} />
                                    </Form.Group>
                                </Col>
                                <Col md={4}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>SKU (Stock Keeping Unit)</Form.Label>
                                        <Form.Control type="text" name="sku" value={formData.sku} onChange={handleChange} disabled={isFormDisabled} />
                                    </Form.Group>
                                </Col>
                            </Row>
                            <Form.Group className="mb-3">
                                <Form.Label>Description</Form.Label>
                                <Form.Control as="textarea" rows={3} name="description" value={formData.description} onChange={handleChange} disabled={isFormDisabled} />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Product Image</Form.Label>
                                <Form.Control type="file" onChange={handleImageChange} disabled={isFormDisabled} />
                            </Form.Group>
                            <Row>
                                <Col md={4}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Purchase Price ($)</Form.Label>
                                        <Form.Control type="number" step="0.01" name="purchase_price" value={formData.purchase_price} onChange={handleChange} disabled={isFormDisabled} />
                                    </Form.Group>
                                </Col>
                                <Col md={4}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Sale Price ($) <span className="text-danger">*</span></Form.Label>
                                        <Form.Control type="number" step="0.01" name="sale_price" value={formData.sale_price} onChange={handleChange} required disabled={isFormDisabled} />
                                    </Form.Group>
                                </Col>
                                <Col md={4}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Total Stock (read-only)</Form.Label>
                                        <Form.Control
                                            type="number"
                                            step="0.01"
                                            name="stock_quantity"
                                            value={formData.stock_quantity}
                                            readOnly
                                            disabled
                                        />
                                        <Form.Text className="text-muted">
                                            Manage inventory levels per warehouse from the Warehouses screen.
                                        </Form.Text>
                                    </Form.Group>
                                </Col>
                            </Row>
                            <Button variant="secondary" onClick={() => navigate('/inventory')} className="me-2">Cancel</Button>
                            <Button variant="primary" type="submit" disabled={isFormDisabled}>
                                {isSubmitting && (
                                    <Spinner
                                        as="span"
                                        animation="border"
                                        size="sm"
                                        role="status"
                                        aria-hidden="true"
                                        className="me-2"
                                    />
                                )}
                                {isSubmitting ? 'Saving…' : 'Save Product'}
                            </Button>
                        </Form>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
}

export default ProductFormPage;