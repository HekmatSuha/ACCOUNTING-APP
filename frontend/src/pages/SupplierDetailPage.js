// frontend/src/pages/SupplierDetailPage.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Container, Card, Row, Col, Spinner, Alert, Button, Accordion, ButtonToolbar, Table } from 'react-bootstrap';
import { PersonCircle, Cash, Tag, Hammer, BarChart } from 'react-bootstrap-icons';
import './SupplierDetailPage.css';
import SupplierPaymentModal from '../components/SupplierPaymentModal';

const API_BASE_URL = 'http://127.0.0.1:8000';

function SupplierDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [editingPayment, setEditingPayment] = useState(null);

    const fetchDetails = async () => {
        try {
            const response = await axiosInstance.get(`suppliers/${id}/details/`);
            setData(response.data);
        } catch (err) {
            setError('Failed to fetch supplier details.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();
    }, [id]);

    const handlePaymentAdded = () => {
        fetchDetails(); // Refresh data after payment
    };

    const handleDeletePurchase = async (purchaseId) => {
        if (!window.confirm('Are you sure you want to delete this purchase?')) return;
        try {
            await axiosInstance.delete(`/purchases/${purchaseId}/`);
            fetchDetails();
        } catch (err) {
            setError('Failed to delete purchase.');
        }
    };

    const handleDeleteSale = async (saleId) => {
        if (!window.confirm('Are you sure you want to delete this sale?')) return;
        try {
            await axiosInstance.delete(`/sales/${saleId}/`);
            fetchDetails();
        } catch (err) {
            setError('Failed to delete sale.');
        }
    };

    const handleEditPayment = (payment) => {
        setEditingPayment(payment);
        setShowPaymentModal(true);
    };

    const handleDeletePayment = async (paymentId) => {
        if (!window.confirm('Are you sure you want to delete this payment?')) return;
        try {
            await axiosInstance.delete(`suppliers/${id}/payments/${paymentId}/`);
            fetchDetails();
        } catch (err) {
            setError('Failed to delete payment.');
        }
    };

    const handleClosePaymentModal = () => {
        setShowPaymentModal(false);
        setEditingPayment(null);
    };

    const formatCurrency = (amount, currency) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
    };

    const renderSummaryCard = (bg, title, amount, Icon) => (
        <Card bg={bg} text="white" className="summary-card">
            <Card.Body className="d-flex align-items-center">
                <Icon size={40} className="icon me-3" />
                <div>
                    <h6 className="mb-0">{title}</h6>
                    <div className="fs-4">{amount}</div>
                </div>
            </Card.Body>
        </Card>
    );

    const renderOpenBalanceCard = (balance, currency) => {
        let cardProps;

        if (balance > 0) {
            cardProps = {
                bg: 'danger',
                title: 'You Owe',
                amount: formatCurrency(balance, currency)
            };
        } else if (balance < 0) {
            cardProps = {
                bg: 'success',
                title: 'They Owe You (Credit)',
                amount: formatCurrency(Math.abs(balance), currency)
            };
        } else {
            cardProps = {
                bg: 'secondary',
                title: 'Settled',
                amount: formatCurrency(0, currency)
            };
        }

        return renderSummaryCard(cardProps.bg, cardProps.title, cardProps.amount, Cash);
    };

    if (loading) return <div className="text-center"><Spinner animation="border" /></div>;
    if (error) return <Alert variant="danger">{error}</Alert>;

    const { supplier, purchases, sales, expenses, summary } = data;

    return (
        <Container fluid>
            {/* Supplier Header */}
            <Card className="mb-3" style={{ background: '#f5f5f5' }}>
                <Card.Body className="d-flex align-items-center customer-header">
                    <PersonCircle size={60} className="me-3 text-secondary" />
                    <div className="flex-grow-1">
                        <h2 className="mb-0">{supplier.name}</h2>
                    </div>
                    <Button variant="info" className="ms-3" onClick={() => navigate(`/suppliers/edit/${id}`)}>Edit Supplier</Button>
                </Card.Body>
            </Card>

            {/* Summary Cards */}
            <Row className="mb-3">
                <Col md={3} sm={6} className="mb-3">
                    {renderOpenBalanceCard(summary.open_balance, supplier.currency)}
                </Col>
                <Col md={3} sm={6} className="mb-3">
                    {renderSummaryCard('info', 'Check Balance', formatCurrency(summary.check_balance, supplier.currency), Tag)}
                </Col>
                <Col md={3} sm={6} className="mb-3">
                    {renderSummaryCard('warning', 'Note Balance', formatCurrency(summary.note_balance, supplier.currency), Hammer)}
                </Col>
                <Col md={3} sm={6} className="mb-3">
                    {renderSummaryCard('success', 'Turnover', formatCurrency(summary.turnover, supplier.currency), BarChart)}
                </Col>
            </Row>

            {/* Action Buttons */}
            <ButtonToolbar className="mb-3">
                <Button
                    variant="primary"
                    className="me-2"
                    onClick={() => navigate(`/suppliers/${supplier.id}/new-purchase`)}
                >
                    Make Purchase
                </Button>
                <Button
                    variant="secondary"
                    className="me-2"
                    onClick={() => navigate(`/suppliers/${supplier.id}/new-sale`)}
                >
                    Sell to Supplier
                </Button>
                <Button
                    variant="success"
                    className="me-2"
                    onClick={() => setShowPaymentModal(true)}
                >
                    Make Payment
                </Button>
            </ButtonToolbar>

            <SupplierPaymentModal
                show={showPaymentModal}
                handleClose={handleClosePaymentModal}
                supplierId={id}
                onPaymentAdded={handlePaymentAdded}
                payment={editingPayment}
                supplierCurrency={supplier.currency}
            />

            {/* Transaction Lists */}
            <Row>
                <Col md={6}>
                    <Card>
                        <Card.Header as="h5">Previous Purchases</Card.Header>
                        <Card.Body>
                            <Accordion>
                                {purchases.map((purchase, index) => (
                                    <Accordion.Item eventKey={index.toString()} key={purchase.id}>
                                        <Accordion.Header style={{ backgroundColor: '#f8f9fa' }}>
                                            <div className="d-flex justify-content-between w-100 pe-3">
                                                <span>{new Date(purchase.purchase_date).toLocaleDateString()}</span>
                                                <strong>{formatCurrency(purchase.total_amount, purchase.original_currency)}</strong>
                                            </div>
                                        </Accordion.Header>
                                        <Accordion.Body>
                                            <div className="d-flex justify-content-end mb-2">
                                                <Button size="sm" variant="warning" onClick={() => navigate(`/purchases/${purchase.id}/edit`)}>Edit</Button>
                                                <Button size="sm" variant="danger" className="ms-2" onClick={() => handleDeletePurchase(purchase.id)}>Delete</Button>
                                            </div>
                                            <Table striped bordered hover size="sm">
                                                <thead>
                                                    <tr>
                                                        <th>Product</th>
                                                        <th>Quantity</th>
                                                        <th>Unit Price</th>
                                                        <th className="text-end">Line Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {purchase.items.map(item => (
                                                        <tr key={item.id}>
                                                            <td>{item.product_name}</td>
                                                            <td>{item.quantity}</td>
                                                            <td>{formatCurrency(item.unit_price, purchase.original_currency)}</td>
                                                            <td className="text-end">{formatCurrency(item.line_total, purchase.original_currency)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </Table>
                                        </Accordion.Body>
                                    </Accordion.Item>
                                ))}
                            </Accordion>
                        </Card.Body>
                    </Card>

                    <Card className="mt-3">
                        <Card.Header as="h5">Previous Sales</Card.Header>
                        <Card.Body>
                            <Accordion>
                                {sales.map((sale, index) => (
                                    <Accordion.Item eventKey={index.toString()} key={sale.id}>
                                        <Accordion.Header style={{ backgroundColor: '#f8f9fa' }}>
                                            <div className="d-flex justify-content-between w-100 pe-3">
                                                <span>{new Date(sale.sale_date).toLocaleDateString()}</span>
                                                <strong>{formatCurrency(sale.total_amount, sale.original_currency)}</strong>
                                            </div>
                                        </Accordion.Header>
                                        <Accordion.Body>
                                            <div className="d-flex justify-content-end mb-2">
                                                <Button size="sm" variant="warning" onClick={() => navigate(`/sales/${sale.id}/edit`)}>Edit</Button>
                                                <Button size="sm" variant="danger" className="ms-2" onClick={() => handleDeleteSale(sale.id)}>Delete</Button>
                                            </div>
                                            <Table striped bordered hover size="sm">
                                                <thead>
                                                    <tr>
                                                        <th>Product</th>
                                                        <th>Quantity</th>
                                                        <th>Unit Price</th>
                                                        <th className="text-end">Line Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sale.items.map(item => (
                                                        <tr key={item.id}>
                                                            <td>{item.product_name}</td>
                                                            <td>{item.quantity}</td>
                                                            <td>{formatCurrency(item.unit_price, sale.original_currency)}</td>
                                                            <td className="text-end">{formatCurrency(item.line_total, sale.original_currency)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </Table>
                                        </Accordion.Body>
                                    </Accordion.Item>
                                ))}
                            </Accordion>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card>
                        <Card.Header as="h5">Previous Payments</Card.Header>
                        <Card.Body>
                            <Accordion>
                                {expenses.map((payment, index) => (
                                    <Accordion.Item eventKey={index.toString()} key={payment.id}>
                                        <Accordion.Header style={{ backgroundColor: '#d4edda' }}>
                                            <div className="d-flex justify-content-between w-100 pe-3">
                                                <span>{new Date(payment.expense_date).toLocaleDateString()}</span>
                                                <span>{payment.method}</span>
                                                <strong>{formatCurrency(payment.amount, payment.currency)}</strong>
                                            </div>
                                        </Accordion.Header>
                                        <Accordion.Body>
                                            <div className="d-flex justify-content-end mb-2">
                                                <Button size="sm" variant="warning" onClick={() => handleEditPayment(payment)}>Edit</Button>
                                                <Button size="sm" variant="danger" className="ms-2" onClick={() => handleDeletePayment(payment.id)}>Delete</Button>
                                            </div>
                                            <Table borderless size="sm" className="mb-0">
                                                <tbody>
                                                    <tr>
                                                        <td className="fw-bold">Account</td>
                                                        <td>{payment.account_name || 'N/A'}</td>
                                                    </tr>
                                                    <tr>
                                                        <td className="fw-bold">Notes</td>
                                                        <td>{payment.description || 'No notes provided.'}</td>
                                                    </tr>
                                                </tbody>
                                            </Table>
                                        </Accordion.Body>
                                    </Accordion.Item>
                                ))}
                            </Accordion>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default SupplierDetailPage;
