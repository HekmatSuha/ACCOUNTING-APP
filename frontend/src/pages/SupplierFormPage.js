// frontend/src/pages/SupplierFormPage.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Container, Card, Form, Button, Alert, Row, Col, Image as BootstrapImage, Tabs, Tab } from 'react-bootstrap';
import { Image as ImageIcon } from 'react-bootstrap-icons';

const API_BASE_URL = 'http://127.0.0.1:8000';

function SupplierFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = Boolean(id);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        currency: 'USD',
        open_balance: 0.0,
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (isEditing) {
            const fetchSupplier = async () => {
                try {
                    const response = await axiosInstance.get(`/suppliers/${id}/`);
                    setFormData(response.data);
                    if (response.data.image) {
                        setImagePreview(`${API_BASE_URL}${response.data.image}`);
                    }
                } catch (error) {
                    setError('Failed to fetch supplier details.');
                }
            };
            fetchSupplier();
        }
    }, [id, isEditing]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const submissionData = new FormData();
        Object.keys(formData).forEach(key => {
            if (key !== 'image' && formData[key] !== null) {
                submissionData.append(key, formData[key]);
            }
        });
        if (imageFile) {
            submissionData.append('image', imageFile);
        }

        const apiCall = isEditing
            ? axiosInstance.patch(`/suppliers/${id}/`, submissionData)
            : axiosInstance.post('/suppliers/', submissionData);

        try {
            await apiCall;
            setSuccess(`Supplier successfully ${isEditing ? 'updated' : 'created'}!`);
            setTimeout(() => navigate('/suppliers'), 1500);
        } catch (error) {
            setError('Failed to save supplier. Check all required fields.');
            console.error('API Error:', error.response?.data);
        }
    };

    return (
        <Container>
            <Form onSubmit={handleSubmit}>
                <Card>
                    <Card.Header className="d-flex justify-content-between">
                        <h4>{isEditing ? `Edit Supplier: ${formData.name}` : 'New Supplier'}</h4>
                        <div>
                            <Button variant="success" type="submit" className="me-2">Save</Button>
                            <Button variant="secondary" onClick={() => navigate('/suppliers')}>Go Back</Button>
                        </div>
                    </Card.Header>
                    <Card.Body>
                        {error && <Alert variant="danger">{error}</Alert>}
                        {success && <Alert variant="success">{success}</Alert>}
                        <Tabs defaultActiveKey="identity" className="mb-3">
                            <Tab eventKey="identity" title="Identity">
                                <Row>
                                    <Col md={8}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Name <span className="text-danger">*</span></Form.Label>
                                            <Form.Control type="text" name="name" value={formData.name} onChange={handleChange} required />
                                        </Form.Group>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Currency <span className="text-danger">*</span></Form.Label>
                                            <Form.Select name="currency" value={formData.currency} onChange={handleChange}>
                                                <option value="USD">United States Dollar (USD)</option>
                                                <option value="EUR">Euro (EUR)</option>
                                                <option value="KZT">Kazakhstani Tenge (KZT)</option>
                                                <option value="TRY">Turkish Lira (TRY)</option>
                                            </Form.Select>
                                        </Form.Group>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Opening Balance</Form.Label>
                                            <Form.Control type="number" step="0.01" name="open_balance" value={formData.open_balance} onChange={handleChange} />
                                        </Form.Group>
                                    </Col>
                                    <Col md={4}>
                                        <Form.Group>
                                            <Form.Label>Supplier Image</Form.Label>
                                            <div className="d-flex flex-column align-items-center justify-content-center h-100 border rounded bg-light p-2">
                                                {imagePreview ? (
                                                    <BootstrapImage src={imagePreview} thumbnail style={{ maxHeight: '150px', marginBottom: '10px' }} />
                                                ) : (
                                                    <ImageIcon size={50} className="mb-2" />
                                                )}
                                                <Form.Control type="file" onChange={handleImageChange} />
                                            </div>
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </Tab>
                            <Tab eventKey="contact" title="Contact">
                                <Form.Group className="mb-3">
                                    <Form.Label>Email</Form.Label>
                                    <Form.Control type="email" name="email" value={formData.email} onChange={handleChange} />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Phone</Form.Label>
                                    <Form.Control type="text" name="phone" value={formData.phone} onChange={handleChange} />
                                </Form.Group>
                                <Form.Group>
                                    <Form.Label>Address</Form.Label>
                                    <Form.Control as="textarea" rows={3} name="address" value={formData.address} onChange={handleChange} />
                                </Form.Group>
                            </Tab>
                        </Tabs>
                    </Card.Body>
                </Card>
            </Form>
        </Container>
    );
}

export default SupplierFormPage;

