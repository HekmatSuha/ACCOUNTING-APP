// frontend/src/pages/DashboardPage.js

import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Spinner, Alert } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';
import { FaUsers, FaDollarSign, FaBoxOpen, FaCreditCard } from 'react-icons/fa';
// frontend/src/pages/DashboardPage.js



// A reusable component for our summary cards
const SummaryCard = ({ title, value, icon, color }) => (
    <Card className={`shadow-sm bg-${color} text-white`}>
        <Card.Body className="d-flex align-items-center">
            <div className="me-3">
                {icon}
            </div>
            <div>
                <h5 className="mb-1">{title}</h5>
                <h3 className="mb-0">{value}</h3>
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
                <Row className="g-4">
                    <Col md={6} lg={4}>
                        <SummaryCard
                            title="Total Receivables"
                            value={`$${parseFloat(summary.total_receivables).toFixed(2)}`}
                            icon={<FaDollarSign size={50} />}
                            color="primary"
                        />
                    </Col>
                    <Col md={6} lg={4}>
                        <SummaryCard
                            title="Total Customers"
                            value={summary.customer_count}
                            icon={<FaUsers size={50} />}
                            color="success"
                        />
                    </Col>
                    <Col md={6} lg={4}>
                        <SummaryCard
                            title="Stock Value"
                            value={`$${parseFloat(summary.stock_value).toFixed(2)}`}
                            icon={<FaBoxOpen size={50} />}
                            color="info"
                        />
                    </Col>
                    <Col md={6} lg={4}>
                        <SummaryCard
                            title="Total Expenses"
                            value={`$${parseFloat(summary.expenses).toFixed(2)}`}
                            icon={<FaCreditCard size={50} />}
                            color="danger"
                        />
                    </Col>
                </Row>
            )}
            {/* We can add charts or recent activity lists here in the future */}
        </div>
    );
}

export default DashboardPage;
