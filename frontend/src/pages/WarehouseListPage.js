// frontend/src/pages/WarehouseListPage.js

import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Form, Row, Col, Alert, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import '../styles/datatable.css';

function WarehouseListPage() {
    const [warehouses, setWarehouses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({ name: '', location: '' });
    const [submitting, setSubmitting] = useState(false);

    const loadWarehouses = async () => {
        setLoading(true);
        try {
            const response = await axiosInstance.get('/warehouses/');
            setWarehouses(response.data);
            setError('');
        } catch (err) {
            console.error('Failed to load warehouses', err);
            setError('Unable to fetch warehouses.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadWarehouses();
    }, []);

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCreate = async (event) => {
        event.preventDefault();
        if (!formData.name.trim()) {
            setError('Warehouse name is required.');
            return;
        }
        setSubmitting(true);
        try {
            const response = await axiosInstance.post('/warehouses/', {
                name: formData.name,
                location: formData.location,
            });
            setWarehouses(prev => [...prev, response.data]);
            setFormData({ name: '', location: '' });
            setError('');
        } catch (err) {
            console.error('Failed to create warehouse', err.response?.data || err);
            setError(err.response?.data?.detail || 'Failed to create warehouse.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (warehouseId) => {
        if (!window.confirm('Delete this warehouse? This cannot be undone.')) {
            return;
        }
        try {
            await axiosInstance.delete(`/warehouses/${warehouseId}/`);
            setWarehouses(prev => prev.filter(w => w.id !== warehouseId));
        } catch (err) {
            console.error('Failed to delete warehouse', err.response?.data || err);
            setError(err.response?.data?.detail || 'Failed to delete warehouse.');
        }
    };

    return (
        <Card>
            <Card.Header>
                <h4 className="mb-0">Warehouses</h4>
            </Card.Header>
            <Card.Body>
                <Form onSubmit={handleCreate} className="mb-4">
                    <Row className="g-3 align-items-end">
                        <Col md={5}>
                            <Form.Group>
                                <Form.Label>Name</Form.Label>
                                <Form.Control
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="Main Warehouse"
                                    required
                                />
                            </Form.Group>
                        </Col>
                        <Col md={5}>
                            <Form.Group>
                                <Form.Label>Location</Form.Label>
                                <Form.Control
                                    name="location"
                                    value={formData.location}
                                    onChange={handleInputChange}
                                    placeholder="Optional"
                                />
                            </Form.Group>
                        </Col>
                        <Col md={2}>
                            <Button type="submit" variant="primary" disabled={submitting} className="w-100">
                                {submitting ? 'Saving...' : 'Add Warehouse'}
                            </Button>
                        </Col>
                    </Row>
                </Form>

                {error && <Alert variant="danger">{error}</Alert>}

                <div className="data-table-container">
                    <Table responsive className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Location</th>
                                <th>Total SKUs</th>
                                <th>Total Quantity</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="data-table-status">
                                        <Spinner animation="border" />
                                    </td>
                                </tr>
                            ) : warehouses.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="data-table-empty">No warehouses found.</td>
                                </tr>
                            ) : (
                                warehouses.map(warehouse => (
                                    <tr key={warehouse.id}>
                                        <td>{warehouse.name}</td>
                                        <td>{warehouse.location || '—'}</td>
                                        <td>{warehouse.total_skus}</td>
                                        <td>{warehouse.total_quantity}</td>
                                        <td className="d-flex gap-2">
                                            <Button as={Link} to={`/warehouses/${warehouse.id}`} size="sm" variant="info">
                                                View
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                onClick={() => handleDelete(warehouse.id)}
                                            >
                                                Delete
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </Table>
                </div>
            </Card.Body>
        </Card>
    );
}

export default WarehouseListPage;
