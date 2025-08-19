// frontend/src/pages/CustomerDetailPage.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Container, Card, Row, Col, Spinner, Alert, Button, Accordion, ButtonToolbar, Table } from 'react-bootstrap';
import { PersonCircle, Cash, Tag, Hammer } from 'react-bootstrap-icons';
import CustomerPaymentModal from '../components/CustomerPaymentModal';

const API_BASE_URL = 'http://127.0.0.1:8000';

function CustomerDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [editingPayment, setEditingPayment] = useState(null);

    const fetchDetails = async () => {
        try {
            // Use our new custom API endpoint
            const response = await axiosInstance.get(`/customers/${id}/details/`);
            setData(response.data);
        } catch (err) {
            setError('Failed to fetch customer details.');
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
            await axiosInstance.delete(`/customers/${id}/payments/${paymentId}/`);
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

    const renderOpenBalanceCard = (balance, currency) => {
        let cardProps;

        if (balance > 0) {
            cardProps = {
                bg: 'danger',
                title: 'Customer Debt',
                amount: formatCurrency(balance, currency)
            };
        } else if (balance < 0) {
            cardProps = {
                bg: 'success',
                title: 'Extra Money (Credit)',
                amount: formatCurrency(Math.abs(balance), currency)
            };
        } else {
            cardProps = {
                bg: 'secondary',
                title: 'Settled',
                amount: formatCurrency(0, currency)
            };
        }

        return (
            <Card bg={cardProps.bg} text="white">
                <Card.Body>
                    <Card.Title>{cardProps.title}</Card.Title>
                    <Card.Text className="fs-4">{cardProps.amount}</Card.Text>
                </Card.Body>
            </Card>
        );
    };

    if (loading) return <div className="text-center"><Spinner animation="border" /></div>;
    if (error) return <Alert variant="danger">{error}</Alert>;

    const { customer, sales, payments, summary } = data;

    return (
        <Container fluid>
            {/* Customer Header */}
            <Card className="mb-3" style={{ background: '#f5f5f5' }}>
                <Card.Body className="d-flex align-items-center">
                    {customer.image ? (
                        <img src={`${API_BASE_URL}${customer.image}`} alt={customer.name} className="rounded-circle me-3" style={{ width: '60px', height: '60px' }} />
                    ) : (
                        <PersonCircle size={60} className="me-3 text-secondary" />
                    )}
                    <h2 className="mb-0">{customer.name}</h2>
                    <Button variant="info" className="ms-auto" onClick={() => navigate(`/customers/edit/${id}`)}>Edit Customer</Button>
                </Card.Body>
            </Card>

            {/* Summary Cards */}
            <Row className="mb-3">
                <Col>{renderOpenBalanceCard(summary.open_balance, customer.currency)}</Col>
                <Col><Card bg="info" text="white"><Card.Body><Card.Title>Check Balance</Card.Title><Card.Text className="fs-4">{formatCurrency(summary.check_balance, customer.currency)}</Card.Text></Card.Body></Card></Col>
                <Col><Card bg="info" text="white"><Card.Body><Card.Title>Note Balance</Card.Title><Card.Text className="fs-4">{formatCurrency(summary.note_balance, customer.currency)}</Card.Text></Card.Body></Card></Col>
                <Col><Card bg="success" text="white"><Card.Body><Card.Title>Turnover</Card.Title><Card.Text className="fs-4">{formatCurrency(summary.turnover, customer.currency)}</Card.Text></Card.Body></Card></Col>
            </Row>

            {/* Action Buttons */}
            <ButtonToolbar className="mb-3">
                <Button variant="primary" className="me-2" onClick={() => navigate(`/customers/${customer.id}/new-sale`)}>Make Sale</Button>
                <Button
                    variant="secondary"
                    className="me-2"
                    onClick={() => navigate(`/customers/${customer.id}/new-sale?type=offer`)}
                >
                    Make Offer
                </Button>
                <Button variant="success" className="me-2" onClick={() => setShowPaymentModal(true)}>Collection / Payment</Button>
            </ButtonToolbar>

            <CustomerPaymentModal
                show={showPaymentModal}
                handleClose={handleClosePaymentModal}
                customerId={id}
                onPaymentAdded={handlePaymentAdded}
                payment={editingPayment}
            />

            {/* Transaction Lists */}
            <Row>
                <Col md={6}>
                    <Card>
                        <Card.Header as="h5">Previous Sales</Card.Header>
                        <Card.Body>
                            <Accordion>
                                {sales.map((sale, index) => (
                                    <Accordion.Item eventKey={index.toString()} key={sale.id}>
                                        <Accordion.Header style={{ backgroundColor: '#f8f9fa' }}>
                                            <div className="d-flex justify-content-between w-100 pe-3">
                                                <span>{new Date(sale.sale_date).toLocaleDateString()}</span>
                                                <strong>{formatCurrency(sale.total_amount, customer.currency)}</strong>
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
                                                            <td>{formatCurrency(item.unit_price, customer.currency)}</td>
                                                            <td className="text-end">{formatCurrency(item.line_total, customer.currency)}</td>
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
                                {payments.map((payment, index) => (
                                    <Accordion.Item eventKey={index.toString()} key={payment.id}>
                                        <Accordion.Header style={{ backgroundColor: '#d4edda' }}>
                                            <div className="d-flex justify-content-between w-100 pe-3">
                                                <span>{new Date(payment.payment_date).toLocaleDateString()}</span>
                                                <span>{payment.method}</span>
                                                <strong>{formatCurrency(payment.amount, customer.currency)}</strong>
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
                                                        <td>{payment.notes || 'No notes provided.'}</td>
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

export default CustomerDetailPage;