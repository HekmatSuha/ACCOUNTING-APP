// frontend/src/pages/SupplierDetailPage.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Container, Card, Row, Col, Spinner, Alert, Button, Accordion, ButtonToolbar, Table } from 'react-bootstrap';
import { PersonCircle, Cash, Tag, Hammer, BarChart, PencilSquare, Trash, ReceiptCutoff, Wallet2, CartCheck } from 'react-bootstrap-icons';
import './SupplierDetailPage.css';
import SupplierPaymentModal from '../components/SupplierPaymentModal';
import ActionMenu from '../components/ActionMenu';
import '../styles/datatable.css';
import '../styles/transaction-history.css';

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
                    onClick={() => navigate(`/suppliers/${supplier.id}/payment`)}
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
            <Row className="g-4">
                <Col md={6} className="d-flex flex-column gap-4">
                    <Card className="transaction-history-card transaction-history-card--purchases">
                        <Card.Header className="transaction-history-card__header">
                            <div>
                                <span className="transaction-history-card__eyebrow">History</span>
                                <h5 className="transaction-history-card__title mb-1">Previous Purchases</h5>
                                <p className="transaction-history-card__subtitle mb-0">Bills received from this supplier</p>
                            </div>
                            <div className="transaction-history-card__icon transaction-history-card__icon--purchases">
                                <CartCheck size={24} />
                            </div>
                        </Card.Header>
                        <Card.Body className="p-0">
                            {purchases.length > 0 ? (
                                <Accordion alwaysOpen className="transaction-accordion">
                                    {purchases.map((purchase, index) => {
                                        const purchaseDate = new Date(purchase.purchase_date).toLocaleDateString();
                                        const purchaseItems = Array.isArray(purchase.items) ? purchase.items : [];
                                        const itemsCount = purchaseItems.length;
                                        const purchaseCurrency = purchase.original_currency || supplier.currency;
                                        const purchaseTags = [];
                                        if (purchase.invoice_number) {
                                            purchaseTags.push(`Invoice ${purchase.invoice_number}`);
                                        } else if (purchase.reference) {
                                            purchaseTags.push(purchase.reference);
                                        }
                                        if (itemsCount > 0) {
                                            purchaseTags.push(`${itemsCount} item${itemsCount !== 1 ? 's' : ''}`);
                                        }

                                        return (
                                            <Accordion.Item
                                                eventKey={index.toString()}
                                                key={purchase.id}
                                                className="transaction-accordion__item"
                                            >
                                                <Accordion.Header>
                                                    <div className="transaction-accordion__header">
                                                        <div className="transaction-accordion__meta">
                                                            <span className="transaction-accordion__date">{purchaseDate}</span>
                                                            {purchaseTags.length > 0 && (
                                                                <div className="transaction-accordion__tags">
                                                                    {purchaseTags.map(tag => (
                                                                        <span key={tag} className="transaction-accordion__tag">
                                                                            {tag}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="transaction-accordion__amount">
                                                            {formatCurrency(purchase.total_amount, purchaseCurrency)}
                                                        </div>
                                                    </div>
                                                </Accordion.Header>
                                                <Accordion.Body>
                                                    <div className="transaction-accordion__actions">
                                                        <ActionMenu
                                                            toggleAriaLabel={`Purchase actions for ${purchaseDate}`}
                                                            actions={[
                                                                {
                                                                    label: 'Edit Purchase',
                                                                    icon: <PencilSquare />,
                                                                    onClick: () => navigate(`/purchases/${purchase.id}/edit`),
                                                                },
                                                                {
                                                                    label: 'Delete Purchase',
                                                                    icon: <Trash />,
                                                                    variant: 'text-danger',
                                                                    onClick: () => handleDeletePurchase(purchase.id),
                                                                },
                                                            ]}
                                                        />
                                                    </div>
                                                    <Table responsive borderless size="sm" className="transaction-detail-table">
                                                        <thead>
                                                            <tr>
                                                                <th scope="col">Product</th>
                                                                <th scope="col">Quantity</th>
                                                                <th scope="col">Unit Price</th>
                                                                <th scope="col" className="text-end">
                                                                    Line Total
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {purchaseItems.map(item => (
                                                                <tr key={item.id}>
                                                                    <td>{item.product_name}</td>
                                                                    <td>{item.quantity}</td>
                                                                    <td>{formatCurrency(item.unit_price, purchaseCurrency)}</td>
                                                                    <td className="text-end">
                                                                        {formatCurrency(item.line_total, purchaseCurrency)}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </Table>
                                                </Accordion.Body>
                                            </Accordion.Item>
                                        );
                                    })}
                                </Accordion>
                            ) : (
                                <div className="transaction-empty-state">
                                    <p className="fw-semibold mb-1">No purchases recorded</p>
                                    <p className="mb-0">Log a purchase to build this supplier history.</p>
                                </div>
                            )}
                        </Card.Body>
                    </Card>

                    <Card className="transaction-history-card transaction-history-card--sales">
                        <Card.Header className="transaction-history-card__header">
                            <div>
                                <span className="transaction-history-card__eyebrow">History</span>
                                <h5 className="transaction-history-card__title mb-1">Previous Sales</h5>
                                <p className="transaction-history-card__subtitle mb-0">Goods sold back to this supplier</p>
                            </div>
                            <div className="transaction-history-card__icon transaction-history-card__icon--sales">
                                <ReceiptCutoff size={24} />
                            </div>
                        </Card.Header>
                        <Card.Body className="p-0">
                            {sales.length > 0 ? (
                                <Accordion alwaysOpen className="transaction-accordion">
                                    {sales.map((sale, index) => {
                                        const saleDate = new Date(sale.sale_date).toLocaleDateString();
                                        const saleItems = Array.isArray(sale.items) ? sale.items : [];
                                        const itemsCount = saleItems.length;
                                        const saleCurrency = sale.original_currency || supplier.currency;
                                        const saleTags = [];
                                        if (sale.invoice_number) {
                                            saleTags.push(`Invoice ${sale.invoice_number}`);
                                        } else if (sale.reference) {
                                            saleTags.push(sale.reference);
                                        }
                                        if (itemsCount > 0) {
                                            saleTags.push(`${itemsCount} item${itemsCount !== 1 ? 's' : ''}`);
                                        }

                                        return (
                                            <Accordion.Item
                                                eventKey={index.toString()}
                                                key={sale.id}
                                                className="transaction-accordion__item"
                                            >
                                                <Accordion.Header>
                                                    <div className="transaction-accordion__header">
                                                        <div className="transaction-accordion__meta">
                                                            <span className="transaction-accordion__date">{saleDate}</span>
                                                            {saleTags.length > 0 && (
                                                                <div className="transaction-accordion__tags">
                                                                    {saleTags.map(tag => (
                                                                        <span key={tag} className="transaction-accordion__tag">
                                                                            {tag}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="transaction-accordion__amount">
                                                            {formatCurrency(sale.total_amount, saleCurrency)}
                                                        </div>
                                                    </div>
                                                </Accordion.Header>
                                                <Accordion.Body>
                                                    <div className="transaction-accordion__actions">
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
                                                    <Table responsive borderless size="sm" className="transaction-detail-table">
                                                        <thead>
                                                            <tr>
                                                                <th scope="col">Product</th>
                                                                <th scope="col">Quantity</th>
                                                                <th scope="col">Unit Price</th>
                                                                <th scope="col" className="text-end">
                                                                    Line Total
                                                                </th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {saleItems.map(item => (
                                                                <tr key={item.id}>
                                                                    <td>{item.product_name}</td>
                                                                    <td>{item.quantity}</td>
                                                                    <td>{formatCurrency(item.unit_price, saleCurrency)}</td>
                                                                    <td className="text-end">
                                                                        {formatCurrency(item.line_total, saleCurrency)}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </Table>
                                                </Accordion.Body>
                                            </Accordion.Item>
                                        );
                                    })}
                                </Accordion>
                            ) : (
                                <div className="transaction-empty-state">
                                    <p className="fw-semibold mb-1">No sales to show</p>
                                    <p className="mb-0">Sales recorded for this supplier will appear here.</p>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="transaction-history-card transaction-history-card--payments h-100">
                        <Card.Header className="transaction-history-card__header">
                            <div>
                                <span className="transaction-history-card__eyebrow">History</span>
                                <h5 className="transaction-history-card__title mb-1">Previous Payments</h5>
                                <p className="transaction-history-card__subtitle mb-0">Outgoing payments to this supplier</p>
                            </div>
                            <div className="transaction-history-card__icon transaction-history-card__icon--payments">
                                <Wallet2 size={24} />
                            </div>
                        </Card.Header>
                        <Card.Body className="p-0">
                            {expenses.length > 0 ? (
                                <Accordion alwaysOpen className="transaction-accordion">
                                    {expenses.map((payment, index) => {
                                        const paymentDate = new Date(payment.expense_date).toLocaleDateString();
                                        const paymentTags = [];
                                        if (payment.method) paymentTags.push(payment.method);
                                        if (payment.account_name) paymentTags.push(payment.account_name);

                                        return (
                                            <Accordion.Item
                                                eventKey={index.toString()}
                                                key={payment.id}
                                                className="transaction-accordion__item"
                                            >
                                                <Accordion.Header>
                                                    <div className="transaction-accordion__header">
                                                        <div className="transaction-accordion__meta">
                                                            <span className="transaction-accordion__date">{paymentDate}</span>
                                                            {paymentTags.length > 0 && (
                                                                <div className="transaction-accordion__tags">
                                                                    {paymentTags.map(tag => (
                                                                        <span key={tag} className="transaction-accordion__tag">
                                                                            {tag}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="transaction-accordion__amount">
                                                            {formatCurrency(payment.amount, payment.currency || supplier.currency)}
                                                        </div>
                                                    </div>
                                                </Accordion.Header>
                                                <Accordion.Body>
                                                    <div className="transaction-accordion__actions">
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
                                                    <div className="transaction-meta-grid">
                                                        <div className="transaction-meta-item">
                                                            <span className="transaction-meta-label">Account</span>
                                                            <span className="transaction-meta-value">
                                                                {payment.account_name || 'N/A'}
                                                            </span>
                                                        </div>
                                                        <div className="transaction-meta-item transaction-meta-item--full">
                                                            <span className="transaction-meta-label">Notes</span>
                                                            <span className="transaction-meta-note">
                                                                {payment.description || 'No notes provided.'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </Accordion.Body>
                                            </Accordion.Item>
                                        );
                                    })}
                                </Accordion>
                            ) : (
                                <div className="transaction-empty-state">
                                    <p className="fw-semibold mb-1">No payments recorded</p>
                                    <p className="mb-0">Capture a payment when you settle a supplier bill.</p>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default SupplierDetailPage;
