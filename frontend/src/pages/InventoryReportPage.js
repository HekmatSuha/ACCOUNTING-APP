import React, { useEffect, useMemo, useState } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { Card, Spinner, Alert, Table, Button, Row, Col } from 'react-bootstrap';
import { formatCurrency, formatNumber } from '../utils/format';
import { downloadBlobResponse } from '../utils/download';
import '../styles/datatable.css';

const normaliseDecimal = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
};

function InventoryReportPage() {
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [downloadError, setDownloadError] = useState('');
    const [exportingFormat, setExportingFormat] = useState(null);

    const loadReport = async () => {
        setLoading(true);
        setError('');
        setDownloadError('');
        try {
            const response = await axiosInstance.get('/reports/inventory/');
            const data = Array.isArray(response.data) ? response.data : [];
            setReportData(data);
        } catch (err) {
            console.error('Failed to load inventory report:', err);
            setError('Could not load the inventory report. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const downloadReport = async (format) => {
        setDownloadError('');
        setExportingFormat(format);
        try {
            const response = await axiosInstance.get('/reports/inventory/', {
                params: { export_format: format },
                responseType: 'blob',
            });
            const extension = format === 'pdf' ? 'pdf' : 'xlsx';
            const fallbackName = `inventory-report.${extension}`;
            downloadBlobResponse(response, fallbackName);
        } catch (err) {
            console.error('Failed to download inventory report:', err);
            setDownloadError('Could not download the report. Please try again.');
        } finally {
            setExportingFormat(null);
        }
    };

    useEffect(() => {
        loadReport();
    }, []);

    const summary = useMemo(() => {
        return reportData.reduce(
            (acc, product) => {
                const quantity = normaliseDecimal(product.stock_quantity);
                const buyingPrice = normaliseDecimal(product.purchase_price);
                const sellingPrice = normaliseDecimal(product.sale_price);

                acc.totalItems += 1;
                acc.totalQuantity += quantity;
                acc.totalCost += quantity * buyingPrice;
                acc.totalRevenue += quantity * sellingPrice;
                return acc;
            },
            { totalItems: 0, totalQuantity: 0, totalCost: 0, totalRevenue: 0 }
        );
    }, [reportData]);

    return (
        <Card>
            <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <h4 className="mb-0">Inventory Report</h4>
                <div className="d-flex flex-wrap gap-2">
                    <Button
                        variant="outline-secondary"
                        onClick={() => downloadReport('xlsx')}
                        disabled={loading || exportingFormat !== null}
                    >
                        {exportingFormat === 'xlsx' ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" role="status" className="me-2" />
                                Preparing...
                            </>
                        ) : (
                            'Download Excel'
                        )}
                    </Button>
                    <Button
                        variant="outline-secondary"
                        onClick={() => downloadReport('pdf')}
                        disabled={loading || exportingFormat !== null}
                    >
                        {exportingFormat === 'pdf' ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" role="status" className="me-2" />
                                Preparing...
                            </>
                        ) : (
                            'Download PDF'
                        )}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={loadReport}
                        disabled={loading || exportingFormat !== null}
                    >
                        {loading ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" role="status" className="me-2" />
                                Refreshing
                            </>
                        ) : (
                            'Refresh'
                        )}
                    </Button>
                </div>
            </Card.Header>
            <Card.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                {downloadError && <Alert variant="danger">{downloadError}</Alert>}

                {loading && reportData.length === 0 ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" role="status" />
                    </div>
                ) : (
                    <>
                        <Row className="mb-4 g-3">
                            <Col md={3} sm={6}>
                                <Card bg="primary" text="white" className="h-100">
                                    <Card.Body>
                                        <Card.Title className="text-uppercase fs-6">Total Items</Card.Title>
                                        <div className="display-6">{summary.totalItems}</div>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col md={3} sm={6}>
                                <Card bg="info" text="white" className="h-100">
                                    <Card.Body>
                                        <Card.Title className="text-uppercase fs-6">Total Quantity</Card.Title>
                                        <div className="display-6">{formatNumber(summary.totalQuantity)}</div>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col md={3} sm={6}>
                                <Card bg="secondary" text="white" className="h-100">
                                    <Card.Body>
                                        <Card.Title className="text-uppercase fs-6">Inventory Cost</Card.Title>
                                        <div className="display-6">{formatCurrency(summary.totalCost)}</div>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col md={3} sm={6}>
                                <Card bg="success" text="white" className="h-100">
                                    <Card.Body>
                                        <Card.Title className="text-uppercase fs-6">Potential Revenue</Card.Title>
                                        <div className="display-6">{formatCurrency(summary.totalRevenue)}</div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>

                        <div className="data-table-container">
                            <Table responsive className="data-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Item Name</th>
                                        <th>Description</th>
                                        <th>Item Code</th>
                                        <th className="text-end">Quantity</th>
                                        <th className="text-end">Buying Price</th>
                                        <th className="text-end">Selling Price</th>
                                        <th className="text-end">Total Cost</th>
                                        <th className="text-end">Potential Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.length === 0 ? (
                                        <tr>
                                            <td colSpan="9" className="text-center py-4 text-muted">
                                                No inventory data available.
                                            </td>
                                        </tr>
                                    ) : (
                                        reportData.map((product, index) => {
                                            const quantity = normaliseDecimal(product.stock_quantity);
                                            const buyingPrice = normaliseDecimal(product.purchase_price);
                                            const sellingPrice = normaliseDecimal(product.sale_price);
                                            const totalCost = quantity * buyingPrice;
                                            const totalRevenue = quantity * sellingPrice;

                                            return (
                                                <tr key={product.id || index}>
                                                    <td>{index + 1}</td>
                                                    <td>{product.name}</td>
                                                    <td>{product.description || <span className="text-muted">No description</span>}</td>
                                                    <td>{product.sku || <span className="text-muted">—</span>}</td>
                                                    <td className="text-end">{formatNumber(quantity)}</td>
                                                    <td className="text-end">{formatCurrency(buyingPrice)}</td>
                                                    <td className="text-end">{formatCurrency(sellingPrice)}</td>
                                                    <td className="text-end">{formatCurrency(totalCost)}</td>
                                                    <td className="text-end">{formatCurrency(totalRevenue)}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    </>
                )}
            </Card.Body>
        </Card>
    );
}

export default InventoryReportPage;
