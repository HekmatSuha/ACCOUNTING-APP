// frontend/src/pages/ProfitLossPage.js

import React, { useState } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { Card, Button, Form, Row, Col, Spinner, Alert, Table } from 'react-bootstrap';
import { formatCurrency } from '../utils/format';
import { downloadBlobResponse } from '../utils/download';

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


function ProfitLossPage() {
    const [reportData, setReportData] = useState(null);
    const [startDate, setStartDate] = useState(getFirstDayOfMonth());
    const [endDate, setEndDate] = useState(getTodayDate());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [downloadError, setDownloadError] = useState('');
    const [exportingFormat, setExportingFormat] = useState(null);

    const generateReport = async () => {
        setLoading(true);
        setError('');
        setReportData(null);
        setDownloadError('');
        try {
            const params = {
                start_date: startDate,
                end_date: endDate,
            };
            const response = await axiosInstance.get('/reports/profit-loss/', { params });
            setReportData(response.data);
        } catch (err) {
            console.error("Failed to generate report:", err);
            setError('Could not generate the report. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const downloadReport = async (format) => {
        setDownloadError('');
        setExportingFormat(format);
        try {
            const params = {
                start_date: startDate,
                end_date: endDate,
                export_format: format,
            };
            const response = await axiosInstance.get('/reports/profit-loss/', {
                params,
                responseType: 'blob',
            });
            const extension = format === 'pdf' ? 'pdf' : 'xlsx';
            const fallbackName = `profit-loss-report-${startDate}-to-${endDate}.${extension}`;
            downloadBlobResponse(response, fallbackName);
        } catch (err) {
            console.error('Failed to download profit and loss report:', err);
            setDownloadError('Could not download the report. Please try again.');
        } finally {
            setExportingFormat(null);
        }
    };
    return (
        <Card>
            <Card.Header>
                <h4>Profit & Loss Statement</h4>
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
                {downloadError && <Alert variant="danger" className="mt-4">{downloadError}</Alert>}

                {reportData && (
                    <>
                        <div className="d-flex justify-content-end gap-2 mt-4">
                            <Button
                                variant="outline-secondary"
                                onClick={() => downloadReport('xlsx')}
                                disabled={exportingFormat !== null || loading}
                            >
                                {exportingFormat === 'xlsx' ? (
                                    <>
                                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                                        Preparing...
                                    </>
                                ) : (
                                    'Download Excel'
                                )}
                            </Button>
                            <Button
                                variant="outline-secondary"
                                onClick={() => downloadReport('pdf')}
                                disabled={exportingFormat !== null || loading}
                            >
                                {exportingFormat === 'pdf' ? (
                                    <>
                                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                                        Preparing...
                                    </>
                                ) : (
                                    'Download PDF'
                                )}
                            </Button>
                        </div>
                        <div className="mt-4">
                            <h5 className="text-center">Report for {reportData.start_date} to {reportData.end_date}</h5>
                            <hr />

                            <Table striped bordered hover responsive>
                                <tbody>
                                    <tr className="table-success">
                                        <td><strong>Total Revenue (Sales)</strong></td>
                                        <td className="text-end"><strong>{formatCurrency(reportData.total_revenue)}</strong></td>
                                    </tr>
                                    <tr className="table-danger">
                                        <td><strong>Total Expenses</strong></td>
                                        <td className="text-end"><strong>{formatCurrency(reportData.total_expenses)}</strong></td>
                                    </tr>
                                    {reportData.expenses_breakdown.map((item, index) => (
                                        <tr key={index}>
                                            <td className="ps-4">- {item.category__name || 'Uncategorized'}</td>
                                            <td className="text-end">{formatCurrency(item.total)}</td>
                                        </tr>
                                    ))}
                                    <tr className="table-info">
                                        <td><h4>Net Profit / Loss</h4></td>
                                        <td className="text-end"><h4>{formatCurrency(reportData.net_profit)}</h4></td>
                                    </tr>
                                </tbody>
                            </Table>
                        </div>
                    </>
                )}
            </Card.Body>
        </Card>
    );
}

export default ProfitLossPage;