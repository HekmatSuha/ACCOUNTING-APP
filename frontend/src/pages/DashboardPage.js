import './DashboardPage.css';
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Spinner, Alert } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';
import { FaUsers, FaDollarSign, FaBoxOpen, FaCreditCard, FaMoneyBillWave } from 'react-icons/fa';
import RecentActivities from '../components/RecentActivities';
import BankAccountsOverview from '../components/BankAccountsOverview';
// frontend/src/pages/DashboardPage.js

// Helper to format currency values and avoid NaN outputs
const formatCurrency = (value) => {
    const num = Number(value);
    return `$${isNaN(num) ? '0.00' : num.toFixed(2)}`;
};

// A reusable component for our summary cards
const SummaryCard = ({ title, value, icon, color }) => (
    <Card className={`summary-card shadow-sm border-start border-4 border-${color}`}>
        <Card.Body className="d-flex align-items-center">
            <div className={`icon text-${color}`}>
                {icon}
            </div>
            <div>
                <h6 className="mb-1 text-muted">{title}</h6>
                <h4 className="mb-0">{value}</h4>
            </div>
        </Card.Body>
    </Card>
);

function DashboardPage() {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchSummaryData = async () => {
            try {
                setLoading(true);
                const response = await axiosInstance.get('/dashboard-summary/');
                setSummary(response.data);
            } catch (err) {
                console.error("Failed to fetch dashboard data:", err);
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

    return (
        <div>
            <h2 className="mb-4">Dashboard</h2>
            {summary && (
                <>
                    <Row className="g-4 mb-4">
                        <Col md={6} lg={3}>
                            <SummaryCard
                                title="Today's Sales"
                                value={formatCurrency(summary.today_sales)}
                                icon={<FaDollarSign size={40} />}
                                color="secondary"
                            />
                        </Col>
                        <Col md={6} lg={3}>
                            <SummaryCard
                                title="Incoming Money"
                                value={formatCurrency(summary.today_incoming)}
                                icon={<FaMoneyBillWave size={40} />}
                                color="warning"
                            />
                        </Col>
                    </Row>
                    <Row className="g-4">
                        <Col md={6} lg={4}>
                            <SummaryCard
                                title="Total Receivables"
                                value={formatCurrency(summary.total_receivables)}
                                icon={<FaDollarSign size={40} />}
                                color="primary"
                            />
                        </Col>
                        <Col md={6} lg={4}>
                            <SummaryCard
                                title="Total Customers"
                                value={summary.customer_count ?? 0}
                                icon={<FaUsers size={40} />}
                                color="success"
                            />
                        </Col>
                        <Col md={6} lg={4}>
                            <SummaryCard
                                title="Stock Value"
                                value={formatCurrency(summary.stock_value)}
                                icon={<FaBoxOpen size={40} />}
                                color="info"
                            />
                        </Col>
                        <Col md={6} lg={4}>
                            <SummaryCard
                                title="Total Expenses"
                                value={formatCurrency(summary.expenses)}
                                icon={<FaCreditCard size={40} />}
                                color="danger"
                            />
                        </Col>
                    </Row>
                    <BankAccountsOverview />
                    <RecentActivities />
                </>
            )}
        </div>
    );
}

export default DashboardPage;
