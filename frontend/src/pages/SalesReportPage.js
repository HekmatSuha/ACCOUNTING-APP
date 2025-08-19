import React, { useState } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { Card, Button, Form, Row, Col, Spinner, Alert, Table, Collapse } from 'react-bootstrap';

// Helper to get the first day of the current month
const getFirstDayOfMonth = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}-01`;
};

// Helper to get today's date
const getTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

function SalesReportPage() {
    const [reportData, setReportData] = useState([]);
    const [startDate, setStartDate] = useState(getFirstDayOfMonth());
    const [endDate, setEndDate] = useState(getTodayDate());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [openRows, setOpenRows] = useState({});

    const generateReport = async () => {
        setLoading(true);
        setError('');
        setReportData([]);
        try {
            const params = {
                start_date: startDate,
                end_date: endDate,
            };
            const response = await axiosInstance.get('/reports/sales/', { params });
            setReportData(response.data);
        } catch (err) {
            console.error("Failed to generate report:", err);
            setError('Could not generate the report. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return `$${parseFloat(amount).toFixed(2)}`;
    };

    const toggleRow = (id) => {
        setOpenRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <Card>
            <Card.Header>
                <h4>Sales Report</h4>
            </Card.Header>
            <Card.Body>
                <Form>
                    <Row className="align-items-end">
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>Start Date</Form.Label>
                                <Form.Control
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>End Date</Form.Label>
                                <Form.Control
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Button onClick={generateReport} disabled={loading} className="w-100">
                                {loading ? <Spinner as="span" animation="border" size="sm" /> : 'Generate Report'}
                            </Button>
                        </Col>
                    </Row>
                </Form>

                {error && <Alert variant="danger" className="mt-4">{error}</Alert>}

                {reportData.length > 0 && (
                    <div className="mt-4">
                        <Table striped bordered hover responsive>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Date</th>
                                    <th>Invoice #</th>
                                    <th>Customer</th>
                                    <th className="text-end">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.map((sale) => (
                                    <React.Fragment key={sale.id}>
                                        <tr onClick={() => toggleRow(sale.id)} style={{ cursor: 'pointer' }}>
                                            <td><Button variant="link" size="sm">{openRows[sale.id] ? '-' : '+'}</Button></td>
                                            <td>{sale.sale_date}</td>
                                            <td>{sale.invoice_number}</td>
                                            <td>{sale.customer_name}</td>
                                            <td className="text-end">{formatCurrency(sale.total_amount)}</td>
                                        </tr>
                                        <Collapse in={openRows[sale.id]}>
                                            <tr>
                                                <td colSpan="5">
                                                    <Card className="m-2">
                                                        <Card.Body>
                                                            <h5>Sale Items</h5>
                                                            <Table size="sm">
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
                                                                            <td>{formatCurrency(item.unit_price)}</td>
                                                                            <td className="text-end">{formatCurrency(item.line_total)}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </Table>
                                                        </Card.Body>
                                                    </Card>
                                                </td>
                                            </tr>
                                        </Collapse>
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                )}
            </Card.Body>
        </Card>
    );
}

export default SalesReportPage;
