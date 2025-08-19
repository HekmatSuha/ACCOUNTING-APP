// frontend/src/pages/SaleDetailPage.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Card, Button, Spinner, Alert, Row, Col, Table } from 'react-bootstrap';
import AddPaymentModal from '../components/AddPaymentModal';

function SaleDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [sale, setSale] = useState(null);
    const [payments, setPayments] = useState([]); // <-- State for payments
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // Function to fetch all data for the page
    const fetchSaleData = async () => {
        setLoading(true);
        try {
            // Use Promise.all to fetch sale details and payments concurrently
            const [saleRes, paymentsRes] = await Promise.all([
                axiosInstance.get(`/sales/${id}/`),
                axiosInstance.get(`/sales/${id}/payments/`) // <-- Fetch payments for this sale
            ]);
            setSale(saleRes.data);
            setPayments(paymentsRes.data);
            setError('');
        } catch (error) {
            console.error('Failed to fetch sale data:', error);
            setError('Could not load sale details or payments.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSaleData();
    },[id]);

    // --- 1. ADD THIS DELETE HANDLER ---
    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to delete this sale? This action will also restore product stock and cannot be undone.')) {
            try {
                // The destroy method in the backend handles all the logic
                await axiosInstance.delete(`/sales/${id}/`);
                alert('Sale deleted successfully.');
                navigate('/sales'); // Navigate back to the sales list
            } catch (err) {
                console.error('Failed to delete sale:', err);
                setError('Could not delete the sale. Please try again.');
            }
        }
    };

    // Calculate total payments and balance due
    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const balanceDue = sale ? parseFloat(sale.total_amount) - totalPaid : 0;

    if (loading) {
        return <div className="text-center"><Spinner animation="border" /></div>;
    }

    if (error) {
        return <Alert variant="danger">{error}</Alert>;
    }

    return (
        <div>
            <Button variant="secondary" onClick={() => navigate('/sales')} className="mb-3">
                &larr; Back to Sales List
            </Button>
            {sale && (
                <Card>
                    {/* ... Card.Header and top customer details section ... */}
                    <Card.Header>
                        <h4>Sale Invoice #{sale.invoice_number || sale.id}</h4>
                    </Card.Header>
                    <Card.Body>
                        <Row className="mb-4">
                            <Col md={6}>
                                <h5>Customer Details:</h5>
                                <p><strong>Name:</strong> {sale.customer_name}</p>
                            </Col>
                            <Col md={6} className="text-md-end">
                                <h5>Sale Information:</h5>
                                <p><strong>Sale Date:</strong> {new Date(sale.sale_date).toLocaleDateString()}</p>
                            </Col>
                        </Row>

                        {/* ... Items Sold Table (no changes here) ... */}
                        <h5>Items Sold</h5>
                        <Table striped bordered hover responsive>
                            <thead>
                                <tr>
                                    <th>#</th><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Line Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sale.items.map((item, index) => (
                                    <tr key={item.id}>
                                        <td>{index + 1}</td>
                                        <td>{item.product_name}</td>
                                        <td>{item.quantity}</td>
                                        <td>${parseFloat(item.unit_price).toFixed(2)}</td>
                                        <td>${(item.quantity * item.unit_price).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>

                        <hr />

                        {/* --- NEW PAYMENT HISTORY SECTION --- */}
                        <Row className="mt-4">
                            <Col md={8}>
                                  <h5>Payment History</h5>
                                  <Table bordered size="sm" responsive>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Amount</th>
                                            <th>Method</th>
                                            <th>Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payments.length > 0 ? payments.map(p => (
                                            <tr key={p.id}>
                                                <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                                                <td>${parseFloat(p.amount).toFixed(2)}</td>
                                                <td>{p.method}</td>
                                                <td>{p.notes || 'N/A'}</td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="4" className="text-center">No payments recorded.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </Table>
                                <Button variant="success" size="sm" onClick={() => setShowPaymentModal(true)}>+ Add Payment</Button>
                            </Col>

                            {/* --- NEW FINANCIAL SUMMARY SECTION --- */}
                            <Col md={4} className="text-end">
                                <p className="mb-1">
                                    <strong>Subtotal:</strong>
                                    <span className="float-end">${parseFloat(sale.total_amount).toFixed(2)}</span>
                                </p>
                                <p className="mb-1">
                                    <strong>Total Paid:</strong>
                                    <span className="float-end text-success">-${totalPaid.toFixed(2)}</span>
                                </p>
                                <hr />
                                <h4 className="mb-0">
                                    <strong>Balance Due:</strong>
                                    <span className="float-end text-danger">${balanceDue.toFixed(2)}</span>
                                </h4>
                            </Col>
                        </Row>
                    </Card.Body>
                    <Card.Footer className="text-end">
                        <Button variant="primary" className="me-2">Print Invoice</Button>
                        {/* --- 2. UPDATE THE BUTTONS --- */}
                        <Button as={Link} to={`/sales/${id}/edit`} variant="warning" className="me-2">
                            Edit Sale
                        </Button>
                        <Button variant="danger" onClick={handleDelete}>
                            Delete Sale
                        </Button>
                    </Card.Footer>
                </Card>
            )}
            {/* 4. RENDER THE MODAL COMPONENT */}
            <AddPaymentModal
                show={showPaymentModal}
                handleClose={() => setShowPaymentModal(false)}
                saleId={id}
                onPaymentAdded={fetchSaleData} // This tells the modal to re-run fetchSaleData after a successful payment
            />
            
        </div>
    );
}

export default SaleDetailPage;