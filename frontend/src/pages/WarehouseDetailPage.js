// frontend/src/pages/WarehouseDetailPage.js

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Table, Button, Form, Row, Col, Alert, Spinner } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';
import '../styles/datatable.css';

function WarehouseDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [warehouse, setWarehouse] = useState(null);
    const [formData, setFormData] = useState({ name: '', location: '' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchWarehouse = async () => {
        setLoading(true);
        try {
            const response = await axiosInstance.get(`/warehouses/${id}/`);
            setWarehouse(response.data);
            setFormData({ name: response.data.name, location: response.data.location || '' });
            setError('');
        } catch (err) {
            console.error('Failed to fetch warehouse', err.response?.data || err);
            setError('Unable to load warehouse details.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWarehouse();
    }, [id]);

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (event) => {
        event.preventDefault();
        if (!warehouse) return;
        setSaving(true);
        try {
            const response = await axiosInstance.put(`/warehouses/${warehouse.id}/`, formData);
            setWarehouse(response.data);
            setError('');
        } catch (err) {
            console.error('Failed to update warehouse', err.response?.data || err);
            setError(err.response?.data?.detail || 'Failed to update warehouse.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!warehouse) return;
        if (!window.confirm('Delete this warehouse? This cannot be undone.')) {
            return;
        }
        try {
            await axiosInstance.delete(`/warehouses/${warehouse.id}/`);
            navigate('/warehouses');
        } catch (err) {
            console.error('Failed to delete warehouse', err.response?.data || err);
            setError(err.response?.data?.detail || 'Failed to delete warehouse.');
        }
    };

    if (loading) {
        return <div className="text-center"><Spinner animation="border" /></div>;
    }

    if (!warehouse) {
        return <Alert variant="danger">Warehouse not found.</Alert>;
    }

    return (
        <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
                <h4 className="mb-0">{warehouse.name}</h4>
                <Button variant="danger" onClick={handleDelete}>Delete Warehouse</Button>
            </Card.Header>
            <Card.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                <Form onSubmit={handleSave} className="mb-4">
                    <Row className="g-3 align-items-end">
                        <Col md={5}>
                            <Form.Group>
                                <Form.Label>Name</Form.Label>
                                <Form.Control
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
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
                            <Button type="submit" variant="primary" disabled={saving} className="w-100">
                                {saving ? 'Saving...' : 'Save'}
                            </Button>
                        </Col>
                    </Row>
                </Form>

                <h5>Inventory</h5>
                <div className="data-table-container">
                    <Table responsive className="data-table data-table--compact">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>SKU</th>
                                <th>Quantity</th>
                            </tr>
                        </thead>
                        <tbody>
                            {warehouse.stocks && warehouse.stocks.length > 0 ? (
                                warehouse.stocks.map(stock => (
                                    <tr key={stock.id}>
                                        <td>{stock.product_name}</td>
                                        <td>{stock.sku || '—'}</td>
                                        <td>{stock.quantity}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="3" className="data-table-empty">No inventory tracked in this warehouse.</td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </div>
            </Card.Body>
        </Card>
    );
}

export default WarehouseDetailPage;
