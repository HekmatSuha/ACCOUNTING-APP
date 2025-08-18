// frontend/src/pages/CustomerListPage.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Table, Button, Form, InputGroup, Row, Col, Spinner, Alert } from 'react-bootstrap';
import { Plus, Upload, Wrench } from 'react-bootstrap-icons';

function CustomerListPage() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    
    // 1. ADD STATE FOR THE SEARCH TERM
    const [searchTerm, setSearchTerm] = useState('');

    // 2. MODIFY USEEFFECT TO HANDLE SEARCHING
    useEffect(() => {
        // Set a timer to avoid sending API requests on every single keystroke
        const delayDebounceFn = setTimeout(() => {
            fetchCustomers();
        }, 300); // 300ms delay

        // Cleanup function to cancel the timer if the user keeps typing
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]); // This effect will re-run whenever the searchTerm changes

    // 3. UPDATE THE FETCH FUNCTION TO INCLUDE THE SEARCH PARAMETER
    const fetchCustomers = async () => {
        try {
            // We don't need to set loading to true here on every search to avoid flickering
            // setLoading(true); 
            
            const response = await axiosInstance.get('/customers/', {
                params: { search: searchTerm } // Send search term to the backend
            });
            setCustomers(response.data);
        } catch (error) {
            setError('Failed to fetch customers. Please try again later.');
            console.error('Failed to fetch customers:', error);
        } finally {
            // Ensure loading is false after the initial load
            if (loading) {
                setLoading(false);
            }
        }
    };

    const formatCurrency = (amount, currency) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency }).format(amount);
    };

    return (
        <>
            {error && <Alert variant="danger">{error}</Alert>}

            <Row className="mb-3 align-items-center">
                <Col md={6}>
                    <div className="d-flex">
                        <Button variant="success" className="me-2" onClick={() => navigate('/customers/new')}>
                            <Plus size={20} className="me-1" /> Add New Customer
                        </Button>
                        <Button variant="warning" className="me-2">
                            <Upload size={20} className="me-1" /> Upload from Excel
                        </Button>
                        <Button variant="info">
                            <Wrench size={20} className="me-1" /> Bulk Update Customers
                        </Button>
                    </div>
                </Col>
                <Col md={6}>
                    {/* 4. CONNECT THE SEARCH INPUT TO THE STATE */}
                    <InputGroup>
                        <Form.Control
                            placeholder="Search by name, email, or phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </InputGroup>
                </Col>
            </Row>

            <h2 className="mb-3">Customers</h2>
            <div className="table-container border rounded">
                <Table striped hover responsive className="m-0">
                    <thead className="table-dark">
                        <tr>
                            <th style={{ padding: '1rem' }}>Name / Title</th>
                            <th style={{ padding: '1rem' }}>Open Balance</th>
                            <th style={{ padding: '1rem' }}>Check/Note Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="3" className="text-center p-5">
                                    <Spinner animation="border" />
                                </td>
                            </tr>
                        ) : customers.length > 0 ? (
                            customers.map((customer) => (
                                <tr key={customer.id} onClick={() => navigate(`/customers/${customer.id}`)} style={{ cursor: 'pointer' }}>
                                    <td>{customer.name}</td>
                                    <td>{formatCurrency(customer.open_balance, customer.currency)}</td>
                                    <td>{formatCurrency(0, customer.currency)}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="3" className="text-center p-5">
                                    {searchTerm ? `No customers found for "${searchTerm}".` : 'No customers found. Click "Add New Customer" to get started.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </Table>
            </div>
        </>
    );
}

export default CustomerListPage;