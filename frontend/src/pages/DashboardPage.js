import './DashboardPage.css';
import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { Card, Row, Col, Spinner, Alert, ProgressBar } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';
import RecentActivities from '../components/RecentActivities';
import BankAccountsOverview from '../components/BankAccountsOverview';
import { getBaseCurrency, loadBaseCurrency } from '../config/currency';

// Helper to format currency values and avoid NaN outputs
const formatCurrency = (value, currency) => {
    const num = Number(value);
    const safeValue = Number.isNaN(num) ? 0 : num;

    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
            currencyDisplay: 'narrowSymbol',
        }).format(safeValue);
    } catch (err) {
        // Fall back to a simple formatted string if Intl.NumberFormat fails
        return `${currency || 'USD'} ${safeValue.toFixed(2)}`;
    }
};

// A card that displays items with progress bars similar to the reference dashboard
const ProgressCard = ({ title, items, headerColor = 'primary', currency = 'USD' }) => {
    const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0);
    return (
        <Card className="progress-card shadow-sm mb-4">
            <Card.Header className={`text-white bg-${headerColor}`}>{title}</Card.Header>
            <Card.Body>
                {items.map(({ label, value, variant, breakdown }, idx) => {
                    const percentage = total > 0 ? (Number(value) / total) * 100 : 0;
                    const breakdownEntries = breakdown && Object.entries(breakdown);
                    const breakdownDisplay = breakdownEntries && breakdownEntries.length > 0
                        ? breakdownEntries
                            .map(([code, amount]) => formatCurrency(amount, code))
                            .join(', ')
                        : null;
                    const displayValue = breakdownDisplay || formatCurrency(value, currency);
                    return (
                        <div key={idx} className="mb-3">
                            <div className="d-flex justify-content-between">
                                <span>{label}</span>
                                <span>{displayValue}</span>
                            </div>
                            {breakdownEntries && breakdownEntries.length > 0 && (
                                <div className="ms-2 mt-1">
                                    {breakdownEntries.map(([code, amount]) => (
                                        <div key={code} className="d-flex justify-content-between text-muted small">
                                            <span>{code}</span>
                                            <span>{formatCurrency(amount, code)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <ProgressBar now={percentage} variant={variant || headerColor} />
                        </div>
                    );
                })}
            </Card.Body>
        </Card>
    );
};

function DashboardPage() {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [baseCurrency, setBaseCurrency] = useState(getBaseCurrency());

    useEffect(() => {
        const initialiseCurrency = async () => {
            const loadedCurrency = await loadBaseCurrency();
            setBaseCurrency(loadedCurrency || 'USD');
        };

        initialiseCurrency();
    }, []);

    useEffect(() => {
        const fetchSummaryData = async () => {
            try {
                setLoading(true);
                const response = await axiosInstance.get('/dashboard-summary/');
                setSummary(response.data);
            } catch (err) {
                console.error('Failed to fetch dashboard data:', err);
                setError('Could not load summary data. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchSummaryData();
    }, []);

    if (loading) {
        return <div className="text-center"><Spinner animation="border" /></div>;
    }

    if (error) {
        return <Alert variant="danger">{error}</Alert>;
    }

    const assetItems = summary ? [
        {
            label: 'Receivables',
            value: summary.total_receivables,
            variant: 'success',
            breakdown: summary.total_receivables_breakdown || {},
        },
        {
            label: 'Stock Value',
            value: summary.stock_value,
            variant: 'info',
            breakdown: summary.stock_value_breakdown || {},
        },
        {
            label: "Today's Incoming",
            value: summary.today_incoming,
            variant: 'warning',
            breakdown: summary.today_incoming_breakdown || {},
        }
    ] : [];

    const liabilityItems = summary ? [
        {
            label: 'Payables',
            value: summary.total_payables,
            variant: 'danger',
            breakdown: summary.total_payables_breakdown || {},
        },
        {
            label: 'Expenses',
            value: summary.expenses,
            variant: 'secondary',
            breakdown: summary.expenses_breakdown || {},
        }
    ] : [];

    const performanceItems = summary ? [
        {
            label: 'Turnover',
            value: summary.turnover,
            variant: 'primary',
            breakdown: summary.turnover_breakdown || {},
        },
        {
            label: "Today's Sales",
            value: summary.today_sales,
            variant: 'success',
            breakdown: summary.today_sales_breakdown || {},
        }
    ] : [];

    return (
        <div>
            <h2 className="mb-1">Dashboard</h2>
            <p className="text-muted mb-4">{dayjs().format('D MMMM YYYY dddd')}</p>
            {summary && (
                <Row className="g-4 mb-4">
                    <Col md={6} lg={4}>
                        <ProgressCard title="Assets" items={assetItems} headerColor="success" currency={baseCurrency} />
                    </Col>
                    <Col md={6} lg={4}>
                        <ProgressCard title="Liabilities" items={liabilityItems} headerColor="danger" currency={baseCurrency} />
                    </Col>
                    <Col md={6} lg={4}>
                        <ProgressCard title="Performance" items={performanceItems} headerColor="primary" currency={baseCurrency} />
                    </Col>
                </Row>
            )}
            <BankAccountsOverview />
            <RecentActivities />
        </div>
    );
}

export default DashboardPage;
