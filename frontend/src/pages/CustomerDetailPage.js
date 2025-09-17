// frontend/src/pages/CustomerDetailPage.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Container, Card, Row, Col, Spinner, Alert, Button, Accordion, ButtonToolbar, Table, Modal } from 'react-bootstrap';
import { PersonCircle, Cash, Tag, Hammer, BarChart, PencilSquare, Trash } from 'react-bootstrap-icons';
import './CustomerDetailPage.css';
import CustomerPaymentModal from '../components/CustomerPaymentModal';
import ActionMenu from '../components/ActionMenu';

const API_BASE_URL = 'http://127.0.0.1:8000';

function CustomerDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [editingPayment, setEditingPayment] = useState(null);
    const [showImageModal, setShowImageModal] = useState(false);

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

    const handleImageClick = () => setShowImageModal(true);
    const handleCloseImageModal = () => setShowImageModal(false);
    
    const formatCurrency = (amount, currency) => {
        const value = isNaN(Number(amount)) ? 0 : Number(amount);
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(value);
    };

    // Format balances so debts (positive numbers) appear with a minus sign
    // and credits (negative numbers) appear as positive values
    const formatBalance = (amount, currency) => {
        const value = isNaN(Number(amount)) ? 0 : Number(amount);
        const displayValue = value > 0 ? -value : Math.abs(value);
        return formatCurrency(displayValue, currency);
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
        const numericBalance = isNaN(Number(balance)) ? 0 : Number(balance);
        if (numericBalance > 0) {
            return renderSummaryCard('danger', 'Customer Debt', formatBalance(numericBalance, currency), Cash);
        } else if (numericBalance < 0) {
            return renderSummaryCard('success', 'Extra Money (Credit)', formatBalance(numericBalance, currency), Cash);
        }

        return renderSummaryCard('secondary', 'Settled', formatCurrency(0, currency), Cash);
    };

    if (loading) return <div className="text-center"><Spinner animation="border" /></div>;
    if (error) return <Alert variant="danger">{error}</Alert>;

    const { customer, sales, payments, purchases, summary } = data;

    return (
        <Container fluid>
            {/* Customer Header */}
            <Card className="mb-3" style={{ background: '#f5f5f5' }}>
                <Card.Body className="d-flex align-items-center customer-header">
                    {customer.image ? (
                        <img
                            src={`${API_BASE_URL}${customer.image}`}
                            alt={customer.name}
                            className="rounded-circle me-3 customer-image"
                            style={{ width: '60px', height: '60px' }}
                            onClick={handleImageClick}
                        />
                    ) : (
                        <PersonCircle size={60} className="me-3 text-secondary" />
                    )}
                    <div className="flex-grow-1">
                        <h2 className="mb-0">{customer.name}</h2>
                        <div className="speech-bubble mt-2">{customer.notes || 'No notes for this customer yet.'}</div>
                    </div>
                    <Button variant="info" className="ms-3" onClick={() => navigate(`/customers/edit/${id}`)}>Edit Customer</Button>
                </Card.Body>
            </Card>

            {/* Summary Cards */}
            <Row className="mb-3">
                <Col md={3} sm={6} className="mb-3">
                    {renderOpenBalanceCard(summary.open_balance, customer.currency)}
                </Col>
                <Col md={3} sm={6} className="mb-3">
                    {renderSummaryCard('info', 'Check Balance', formatBalance(summary.check_balance, customer.currency), Tag)}
                </Col>
                <Col md={3} sm={6} className="mb-3">
                    {renderSummaryCard('warning', 'Note Balance', formatBalance(summary.note_balance, customer.currency), Hammer)}
                </Col>
                <Col md={3} sm={6} className="mb-3">
                    {renderSummaryCard('success', 'Turnover', formatCurrency(summary.turnover, customer.currency), BarChart)}
                </Col>
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
                <Button
                    variant="warning"
                    className="me-2"
                    onClick={() => navigate(`/customers/${customer.id}/new-purchase`)}
                >
                    Buy from Customer
                </Button>
                <Button variant="success" className="me-2" onClick={() => setShowPaymentModal(true)}>Collection / Payment</Button>
            </ButtonToolbar>

            <CustomerPaymentModal
                show={showPaymentModal}
                handleClose={handleClosePaymentModal}
                customerId={id}
                onPaymentAdded={handlePaymentAdded}
                payment={editingPayment}
                customerCurrency={customer.currency}
            />

            <Modal show={showImageModal} onHide={handleCloseImageModal} centered>
                <Modal.Body className="text-center">
                    {customer.image && (
                        <img src={`${API_BASE_URL}${customer.image}`} alt={customer.name} className="img-fluid" />
                    )}
                </Modal.Body>
            </Modal>

            {/* Transaction Lists */}
            <Row>
                <Col md={6}>
                    <Card>
                        <Card.Header as="h5">Previous Sales</Card.Header>
                        <Card.Body>
                            <Accordion>
                                {sales.map((sale, index) => {
                                    const saleDate = new Date(sale.sale_date).toLocaleDateString();
                                    return (
                                        <Accordion.Item eventKey={index.toString()} key={sale.id}>
                                            <Accordion.Header style={{ backgroundColor: '#f8f9fa' }}>
                                                <div className="d-flex justify-content-between w-100 pe-3">
                                                    <span>{saleDate}</span>
                                                    <strong>{formatCurrency(sale.total_amount, customer.currency)}</strong>
                                                </div>
                                            </Accordion.Header>
                                            <Accordion.Body>
                                                <div className="d-flex justify-content-end mb-2">
                                                    <ActionMenu
                                                        toggleAriaLabel={`Sale actions for ${saleDate}`}
                                                        actions={[
                                                            {
                                                                label: 'Edit Sale',
                                                                icon: <PencilSquare />,
                                                                onClick: () => navigate(`/sales/${sale.id}/edit`),
                                                            },
                                                            {
                                                                label: 'Delete Sale',
                                                                icon: <Trash />,
                                                                variant: 'text-danger',
                                                                onClick: () => handleDeleteSale(sale.id),
                                                            },
                                                        ]}
                                                    />
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
                                    );
                                })}
                            </Accordion>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card>
                       <Card.Header as="h5">Previous Payments</Card.Header>
                       <Card.Body>
                            <Accordion>
                                {payments.map((payment, index) => {
                                    const paymentDate = new Date(payment.payment_date).toLocaleDateString();
                                    const paymentAmount =
                                        payment.converted_amount ??
                                        payment.original_amount ??
                                        payment.amount ??
                                        0;
                                    const paymentCurrency =
                                        payment.converted_amount !== undefined && payment.converted_amount !== null
                                            ? customer.currency
                                            : payment.original_currency || customer.currency;
                                    return (
                                        <Accordion.Item eventKey={index.toString()} key={payment.id}>
                                            <Accordion.Header style={{ backgroundColor: '#d4edda' }}>
                                                <div className="d-flex justify-content-between w-100 pe-3">
                                                    <span>{paymentDate}</span>
                                                    <span>{payment.method}</span>
                                                    <strong>{formatCurrency(paymentAmount, paymentCurrency)}</strong>
                                                </div>
                                            </Accordion.Header>
                                            <Accordion.Body>
                                                <div className="d-flex justify-content-end mb-2">
                                                    <ActionMenu
                                                        toggleAriaLabel={`Payment actions for ${paymentDate}`}
                                                        actions={[
                                                            {
                                                                label: 'Edit Payment',
                                                                icon: <PencilSquare />,
                                                                onClick: () => handleEditPayment(payment),
                                                            },
                                                            {
                                                                label: 'Delete Payment',
                                                                icon: <Trash />,
                                                                variant: 'text-danger',
                                                                onClick: () => handleDeletePayment(payment.id),
                                                            },
                                                        ]}
                                                    />
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
                                    );
                                })}
                            </Accordion>
                       </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Row className="mt-3">
                <Col md={6}>
                    <Card>
                        <Card.Header as="h5">Purchases / Returns</Card.Header>
                        <Card.Body>
                            {purchases.length > 0 ? (
                                <Accordion>
                                    {purchases.map((purchase, index) => (
                                        <Accordion.Item eventKey={index.toString()} key={purchase.id}>
                                            <Accordion.Header style={{ backgroundColor: '#f8f9fa' }}>
                                                <div className="d-flex justify-content-between w-100 pe-3">
                                                    <span>{new Date(purchase.purchase_date).toLocaleDateString()}</span>
                                                    <strong>{formatCurrency(purchase.total_amount, customer.currency)}</strong>
                                                </div>
                                            </Accordion.Header>
                                            <Accordion.Body>
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
                            ) : (
                                <p className="text-muted mb-0">
                                    This customer has no previous purchase records.{' '}
                                    <Button variant="link" className="p-0" onClick={() => navigate(`/customers/${customer.id}/new-purchase`)}>
                                        Click to make one.
                                    </Button>
                                </p>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default CustomerDetailPage;