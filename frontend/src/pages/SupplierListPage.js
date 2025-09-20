// frontend/src/pages/SupplierListPage.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Table, Button, Form, InputGroup, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { Plus } from 'react-bootstrap-icons';
import '../styles/datatable.css';

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
            const response = await axiosInstance.get('suppliers/', {
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

            <Row className="data-table-toolbar align-items-center">
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
            <div className="data-table-container">
                <Table responsive className="data-table">
                    <thead>
                        <tr>
                            <th>Name / Title</th>
                            <th>Open Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="2" className="data-table-status">
                                    <Spinner animation="border" />
                                </td>
                            </tr>
                        ) : suppliers.length > 0 ? (
                            suppliers.map((supplier) => (
                                <tr
                                    key={supplier.id}
                                    onClick={() => navigate(`/suppliers/${supplier.id}`)}
                                    className="data-table-row--link"
                                >
                                    <td>{supplier.name}</td>
                                    <td>{formatCurrency(supplier.open_balance, supplier.currency)}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="2" className="data-table-empty">
                                    {searchTerm ? `No suppliers found for "${searchTerm}".` : 'No suppliers found. Click "Add New Supplier" to get started.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </Table>
            </div>
        </>
    );
}

export default SupplierListPage;
