// frontend/src/pages/SupplierListPage.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Table, Button, Form, InputGroup, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { Plus } from 'react-bootstrap-icons';

function SupplierListPage() {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchSuppliers();
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const fetchSuppliers = async () => {
        try {
            const response = await axiosInstance.get('/suppliers/', {
                params: { search: searchTerm }
            });
            setSuppliers(response.data);
        } catch (error) {
            setError('Failed to fetch suppliers. Please try again later.');
            console.error('Failed to fetch suppliers:', error);
        } finally {
            if (loading) {
                setLoading(false);
            }
        }
    };

    const formatCurrency = (amount, currency) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
    };

    return (
        <>
            {error && <Alert variant="danger">{error}</Alert>}

            <Row className="mb-3 align-items-center">
                <Col md={6}>
                    <Button variant="success" className="me-2" onClick={() => navigate('/suppliers/new')}>
                        <Plus size={20} className="me-1" /> Add New Supplier
                    </Button>
                </Col>
                <Col md={6}>
                    <InputGroup>
                        <Form.Control
                            placeholder="Search by name, email, or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </InputGroup>
                </Col>
            </Row>

            <h2 className="mb-3">Suppliers</h2>
            <div className="table-container border rounded">
                <Table striped hover responsive className="m-0">
                    <thead className="table-dark">
                        <tr>
                            <th style={{ padding: '1rem' }}>Name / Title</th>
                            <th style={{ padding: '1rem' }}>Open Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="2" className="text-center p-5">
                                    <Spinner animation="border" />
                                </td>
                            </tr>
                        ) : suppliers.length > 0 ? (
                            suppliers.map((supplier) => (
                                <tr key={supplier.id} onClick={() => navigate(`/suppliers/${supplier.id}`)} style={{ cursor: 'pointer' }}>
                                    <td>{supplier.name}</td>
                                    <td>{formatCurrency(supplier.open_balance, 'USD')}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="2" className="text-center p-5">
                                    {searchTerm ? `No suppliers found for "${searchTerm}".` : 'No suppliers found. Click "Add New Supplier" to get started.'}
                                d>
                            </tr>
                        )}
                    </tbody>
                </Table>
            </div>
        </>
    );
}

export default SupplierListPage;