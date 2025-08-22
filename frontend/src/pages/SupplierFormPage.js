// frontend/src/pages/SupplierFormPage.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Container, Card, Form, Button, Alert } from 'react-bootstrap';

function SupplierFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = Boolean(id);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        open_balance: 0.0,
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (isEditing) {
            const fetchSupplier = async () => {
                try {
                    const response = await axiosInstance.get(`/suppliers/${id}/`);
                    setFormData(response.data);
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

    const handleSubmit = async (e) => {
        e.preventDefault();

        const apiCall = isEditing
            ? axiosInstance.patch(`/suppliers/${id}/`, formData)
            : axiosInstance.post('/suppliers/', formData);

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
                        <Form.Group className="mb-3">
                            <Form.Label>Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="text" name="name" value={formData.name} onChange={handleChange} required />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Email</Form.Label>
                            <Form.Control type="email" name="email" value={formData.email} onChange={handleChange} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Phone</Form.Label>
                            <Form.Control type="text" name="phone" value={formData.phone} onChange={handleChange} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Address</Form.Label>
                            <Form.Control as="textarea" rows={3} name="address" value={formData.address} onChange={handleChange} />
                        </Form.Group>
                        <Form.Group>
                            <Form.Label>Opening Balance</Form.Label>
                            <Form.Control type="number" step="0.01" name="open_balance" value={formData.open_balance} onChange={handleChange} />
                        </Form.Group>
                    </Card.Body>
                </Card>
            </Form>
        </Container>
    );
}

export default SupplierFormPage;

