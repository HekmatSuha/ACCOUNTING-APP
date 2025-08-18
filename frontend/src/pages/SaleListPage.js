// frontend/src/pages/SaleListPage.js

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Card, Button, Table, Alert, Spinner } from 'react-bootstrap';

function SaleListPage() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchSales = async () => {
            try {
                setLoading(true);
                // The backend uses SaleReadSerializer for list views
                const response = await axiosInstance.get('/sales/');
                setSales(response.data);
                setError('');
            } catch (err) {
                console.error("Failed to fetch sales:", err);
                setError('Could not retrieve sales data.');
            } finally {
                setLoading(false);
            }
        };

        fetchSales();
    }, []);

    if (loading) {
        return <Spinner animation="border" />;
    }

    return (
        <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
                <h4>Sales</h4>
                <Button as={Link} to="/sales/new" variant="primary">
                    + New Sale
                </Button>
            </Card.Header>
            <Card.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Invoice No.</th>
                            <th>Customer</th>
                            <th>Date</th>
                            <th>Total Amount</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sales.length > 0 ? (
                            sales.map((sale, index) => (
                                <tr key={sale.id}>
                                    <td>{index + 1}</td>
                                    <td>{sale.invoice_number || `SALE-${sale.id}`}</td>
                                    {/* 'customer_name' comes from our SaleReadSerializer */}
                                    <td>{sale.customer_name}</td>
                                    <td>{new Date(sale.sale_date).toLocaleDateString()}</td>
                                    <td>${parseFloat(sale.total_amount).toFixed(2)}</td>
                                    <td>
                                        <Button as={Link} to={`/sales/${sale.id}`} variant="info" size="sm">
                                        View
                                    </Button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" className="text-center">No sales found.</td>
                            </tr>
                        )}
                    </tbody>
                </Table>
            </Card.Body>
        </Card>
    );
}

export default SaleListPage;