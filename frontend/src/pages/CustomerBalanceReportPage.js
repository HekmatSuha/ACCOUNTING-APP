// frontend/src/pages/CustomerBalanceReportPage.js

import React, { useEffect, useState } from 'react';
import axiosInstance from '../utils/axiosInstance';
import {
    Card,
    Spinner,
    Alert,
    Table,
    Button,
    Row,
    Col,
    Badge,
} from 'react-bootstrap';
import { formatCurrency } from '../utils/format';

function CustomerBalanceReportPage() {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadReport = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await axiosInstance.get('/reports/customer-balances/');
            const data = Array.isArray(response.data) ? response.data : [];
            setReportData(data);
        } catch (err) {
            console.error('Failed to load customer balance report:', err);
            setError('Could not load the customer balance report. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReport();
    }, []);

    const counts = reportData.reduce(
        (acc, customer) => {
            const balance = Number(customer.balance);
            if (balance > 0) {
                acc.oweUs += 1;
            } else if (balance < 0) {
                acc.weOwe += 1;
            } else {
                acc.settled += 1;
            }
            return acc;
        },
        { oweUs: 0, weOwe: 0, settled: 0 }
    );

    const currencySummary = reportData.reduce((acc, customer) => {
        const currency = customer.currency || 'USD';
        const balance = Number(customer.balance);
        if (!acc[currency]) {
            acc[currency] = { oweUs: 0, weOwe: 0 };
        }
        if (balance > 0) {
            acc[currency].oweUs += balance;
        } else if (balance < 0) {
            acc[currency].weOwe += Math.abs(balance);
        }
        return acc;
    }, {});

    const renderCurrencySummary = (type) => {
        const entries = Object.entries(currencySummary).filter(([, totals]) => totals[type] > 0);
        if (entries.length === 0) {
            return <div className="small text-white-50">No balance</div>;
        }
        return entries.map(([currency, totals]) => (
            <div key={`${type}-${currency}`} className="small">
                {formatCurrency(totals[type], currency)}
            </div>
        ));
    };

    const getStatusVariant = (balance) => {
        if (balance > 0) {
            return 'danger';
        }
        if (balance < 0) {
            return 'success';
        }
        return 'secondary';
    };

    const getStatusLabel = (balance) => {
        if (balance > 0) {
            return 'Owes us';
        }
        if (balance < 0) {
            return 'We owe them';
        }
        return 'Settled';
    };

    return (
        <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
                <h4 className="mb-0">Customer Balance Report</h4>
                <Button variant="primary" onClick={loadReport} disabled={loading}>
                    {loading ? (
                        <>
                            <Spinner as="span" animation="border" size="sm" role="status" className="me-2" />
                            Refreshing
                        </>
                    ) : (
                        'Refresh'
                    )}
                </Button>
            </Card.Header>
            <Card.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                {loading && reportData.length === 0 ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" role="status" />
                    </div>
                ) : (
                    <>
                        <Row className="mb-4">
                            <Col md={4} className="mb-3">
                                <Card bg="danger" text="white" className="h-100">
                                    <Card.Body>
                                        <Card.Title className="text-uppercase fs-6">Customers Owing Us</Card.Title>
                                        <div className="display-6">{counts.oweUs}</div>
                                        {renderCurrencySummary('oweUs')}
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col md={4} className="mb-3">
                                <Card bg="success" text="white" className="h-100">
                                    <Card.Body>
                                        <Card.Title className="text-uppercase fs-6">Customers We Owe</Card.Title>
                                        <div className="display-6">{counts.weOwe}</div>
                                        {renderCurrencySummary('weOwe')}
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col md={4} className="mb-3">
                                <Card bg="secondary" text="white" className="h-100">
                                    <Card.Body>
                                        <Card.Title className="text-uppercase fs-6">Settled Customers</Card.Title>
                                        <div className="display-6">{counts.settled}</div>
                                        <div className="small text-white-50">No outstanding balance</div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>
                        <Table striped bordered hover responsive>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Contact</th>
                                    <th>Currency</th>
                                    <th className="text-end">Balance</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="text-center py-4 text-muted">
                                            No customer balances to display.
                                        </td>
                                    </tr>
                                ) : (
                                    reportData.map((customer) => {
                                        const balanceValue = Number(customer.balance);
                                        const balanceClass =
                                            balanceValue > 0
                                                ? 'text-danger'
                                                : balanceValue < 0
                                                ? 'text-success'
                                                : 'text-muted';
                                        return (
                                            <tr key={customer.id}>
                                                <td>{customer.name}</td>
                                                <td>
                                                    {customer.email ? <div>{customer.email}</div> : null}
                                                    {customer.phone ? <div>{customer.phone}</div> : null}
                                                    {!customer.email && !customer.phone && <span className="text-muted">—</span>}
                                                </td>
                                                <td>{customer.currency || 'USD'}</td>
                                                <td className={`text-end ${balanceClass}`}>
                                                    {formatCurrency(customer.balance, customer.currency || 'USD')}
                                                </td>
                                                <td>
                                                    <Badge bg={getStatusVariant(balanceValue)}>{getStatusLabel(balanceValue)}</Badge>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </Table>
                    </>
                )}
            </Card.Body>
        </Card>
    );
}

export default CustomerBalanceReportPage;
