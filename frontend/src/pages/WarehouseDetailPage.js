// frontend/src/pages/WarehouseDetailPage.js

import React, { useEffect, useMemo, useState } from 'react';
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
    const [allWarehouses, setAllWarehouses] = useState([]);
    const [transferForm, setTransferForm] = useState({
        product_id: '',
        destination_warehouse_id: '',
        quantity: '',
    });
    const [transferError, setTransferError] = useState('');
    const [transferSuccess, setTransferSuccess] = useState('');
    const [transferring, setTransferring] = useState(false);

    const fetchWarehouse = async (showSpinner = true) => {
        if (showSpinner) {
            setLoading(true);
        }
        try {
            const [detailResponse, listResponse] = await Promise.all([
                axiosInstance.get(`/warehouses/${id}/`),
                axiosInstance.get('/warehouses/'),
            ]);

            setWarehouse(detailResponse.data);
            setFormData({
                name: detailResponse.data.name,
                location: detailResponse.data.location || '',
            });
            setAllWarehouses(listResponse.data);
            setError('');
        } catch (err) {
            console.error('Failed to fetch warehouse', err.response?.data || err);
            setError('Unable to load warehouse details.');
        } finally {
            if (showSpinner) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchWarehouse();
    }, [id]);

    useEffect(() => {
        if (!warehouse) return;

        setTransferForm(prev => ({
            ...prev,
            product_id: prev.product_id || warehouse.stocks?.[0]?.product || '',
        }));
    }, [warehouse]);

    useEffect(() => {
        const others = allWarehouses.filter(w => w.id !== Number(id));
        setTransferForm(prev => ({
            ...prev,
            destination_warehouse_id:
                prev.destination_warehouse_id || others[0]?.id || '',
        }));
    }, [allWarehouses, id]);

    const handleTransferFieldChange = (name, value) => {
        setTransferForm(prev => ({
            ...prev,
            [name]: value,
        }));
    };

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

    const destinationOptions = useMemo(
        () => allWarehouses.filter(w => w.id !== Number(id)),
        [allWarehouses, id]
    );

    const selectedStock = useMemo(() => {
        if (!warehouse?.stocks) return null;
        return warehouse.stocks.find(
            stock => String(stock.product) === String(transferForm.product_id)
        ) || null;
    }, [warehouse, transferForm.product_id]);

    const extractErrorMessage = (data) => {
        if (!data) return 'Failed to transfer inventory.';
        if (typeof data === 'string') return data;
        if (Array.isArray(data)) return data.join(' ');
        const messages = [];
        Object.values(data).forEach(value => {
            if (!value) return;
            if (Array.isArray(value)) {
                messages.push(value.join(' '));
            } else if (typeof value === 'string') {
                messages.push(value);
            }
        });
        return messages.join(' ') || 'Failed to transfer inventory.';
    };

    const handleTransferSubmit = async (event) => {
        event.preventDefault();
        if (!warehouse) return;

        setTransferError('');
        setTransferSuccess('');

        if (!transferForm.product_id || !transferForm.destination_warehouse_id || !transferForm.quantity) {
            setTransferError('Select a product, destination warehouse, and quantity to transfer.');
            return;
        }

        setTransferring(true);
        try {
            const payload = {
                product_id: Number(transferForm.product_id),
                source_warehouse_id: warehouse.id,
                destination_warehouse_id: Number(transferForm.destination_warehouse_id),
                quantity: transferForm.quantity,
            };
            const response = await axiosInstance.post('/warehouses/transfer/', payload);
            setTransferSuccess(
                `Transferred ${response.data.quantity} of ${response.data.product_name} to ${response.data.destination_name}.`
            );
            await fetchWarehouse(false);
            setTransferForm(prev => ({
                ...prev,
                quantity: '',
            }));
        } catch (err) {
            console.error('Failed to transfer inventory', err.response?.data || err);
            setTransferError(extractErrorMessage(err.response?.data));
        } finally {
            setTransferring(false);
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

                <h5 className="mt-4">Transfer Inventory</h5>
                {transferSuccess && <Alert variant="success">{transferSuccess}</Alert>}
                {transferError && <Alert variant="danger">{transferError}</Alert>}
                <Form onSubmit={handleTransferSubmit}>
                    <Row className="g-3 align-items-end">
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>Product</Form.Label>
                                <Form.Select
                                    value={transferForm.product_id}
                                    onChange={(event) => handleTransferFieldChange('product_id', event.target.value)}
                                    disabled={!warehouse.stocks?.length}
                                >
                                    {!warehouse.stocks?.length && <option value="">No products available</option>}
                                    {warehouse.stocks?.map(stock => (
                                        <option key={stock.id} value={stock.product}>
                                            {stock.product_name}
                                        </option>
                                    ))}
                                </Form.Select>
                                {selectedStock && (
                                    <Form.Text muted>Available: {selectedStock.quantity}</Form.Text>
                                )}
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>Destination Warehouse</Form.Label>
                                <Form.Select
                                    value={transferForm.destination_warehouse_id}
                                    onChange={(event) => handleTransferFieldChange('destination_warehouse_id', event.target.value)}
                                    disabled={destinationOptions.length === 0}
                                >
                                    {destinationOptions.length === 0 ? (
                                        <option value="">No other warehouses available</option>
                                    ) : (
                                        destinationOptions.map(option => (
                                            <option key={option.id} value={option.id}>
                                                {option.name}
                                            </option>
                                        ))
                                    )}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={2}>
                            <Form.Group>
                                <Form.Label>Quantity</Form.Label>
                                <Form.Control
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={transferForm.quantity}
                                    onChange={(event) => handleTransferFieldChange('quantity', event.target.value)}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={2}>
                            <Button
                                type="submit"
                                variant="primary"
                                className="w-100"
                                disabled={
                                    transferring
                                    || !transferForm.product_id
                                    || !transferForm.destination_warehouse_id
                                    || !transferForm.quantity
                                }
                            >
                                {transferring ? 'Transferring...' : 'Transfer'}
                            </Button>
                        </Col>
                    </Row>
                </Form>
            </Card.Body>
        </Card>
    );
}

export default WarehouseDetailPage;
