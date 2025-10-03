// frontend/src/pages/SaleDetailPage.js

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Card, Button, Spinner, Alert, Row, Col, Table } from 'react-bootstrap';
import AddPaymentModal from '../components/AddPaymentModal';
import { getBaseCurrency, loadBaseCurrency } from '../config/currency';
import '../styles/datatable.css';
import { getBaseApiUrl, getImageInitial, resolveImageUrl } from '../utils/image';

const extractFilenameFromDisposition = disposition => {
    if (!disposition) {
        return null;
    }

    const filenameMatch = /filename="?([^";]+)"?/i.exec(disposition);
    return filenameMatch ? decodeURIComponent(filenameMatch[1]) : null;
};

const BASE_API_URL = getBaseApiUrl();

function SaleDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [sale, setSale] = useState(null);
    const [payments, setPayments] = useState([]); // <-- State for payments
    const [customerCurrency, setCustomerCurrency] = useState('USD');
    const [baseCurrency, setBaseCurrency] = useState(getBaseCurrency());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);

    // Function to fetch all data for the page
    const fetchSaleData = async () => {
        setLoading(true);
        try {
            
const saleRes = await axiosInstance.get(`/sales/${id}/`);
const [paymentsRes, customerRes] = await Promise.all([
    axiosInstance.get(`/sales/${id}/payments/`), // <-- Fetch payments for this sale
    axiosInstance.get(`/customers/${saleRes.data.customer}/`)
]);
setSale(saleRes.data);
const paymentsData = paymentsRes.data.map(p => ({
    ...p,
    converted_amount: p.converted_amount ?? p.amount,
}));
setPayments(paymentsData);
setCustomerCurrency(customerRes.data.currency || 'USD');
            setError('');
        } catch (error) {
            console.error('Failed to fetch sale data:', error);
            setError('Could not load sale details or payments.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSaleData();
        loadBaseCurrency().then(bc => setBaseCurrency(bc));
    },[id]);

    // --- 1. ADD THIS DELETE HANDLER ---
    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to delete this sale? This action will also restore product stock and cannot be undone.')) {
            try {
                // The destroy method in the backend handles all the logic
                await axiosInstance.delete(`/sales/${id}/`);
                alert('Sale deleted successfully.');
                navigate('/sales'); // Navigate back to the sales list
            } catch (err) {
                console.error('Failed to delete sale:', err);
                setError('Could not delete the sale. Please try again.');
            }
        }
    };

    const handlePrint = async () => {
        if (!sale) {
            return;
        }
        setIsPrinting(true);
        setError('');
        try {
            const response = await axiosInstance.get(`/sales/${id}/invoice_pdf/`, {
                responseType: 'blob', // Important for handling binary data
            });

            const fallbackFilename = `invoice_${sale.invoice_number || sale.id}.pdf`;
            const filename = extractFilenameFromDisposition(response.headers['content-disposition']) || fallbackFilename;
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const blobUrl = window.URL.createObjectURL(blob);

            // Try to render the PDF in a new tab for printing.
            const pdfWindow = window.open('', '_blank');
            if (pdfWindow && !pdfWindow.closed) {
                pdfWindow.document.title = filename;
                pdfWindow.document.write(`
                    <html>
                        <head><title>${filename}</title></head>
                        <body style="margin:0">
                            <embed src="${blobUrl}" type="application/pdf" width="100%" height="100%" />
                        </body>
                    </html>
                `);
                pdfWindow.document.close();
            } else {
                // Popup blocked? Fallback to downloading the file instead.
                const link = document.createElement('a');
                link.href = blobUrl;
                link.setAttribute('download', filename);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

            // Revoke the object URL once the browser has had a chance to use it.
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60 * 1000);

        } catch (err) {
            console.error('Failed to generate or open PDF:', err);
            setError('Could not generate the invoice PDF. Please try again.');
        } finally {
            setIsPrinting(false);
        }
    };

    
const formatCurrency = (amount, currency) => {
    const value = isNaN(Number(amount)) ? 0 : Number(amount);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
};

// Calculate total payments and balance due
const totalPaidCustomer = payments.reduce((sum, p) => sum + parseFloat(p.converted_amount ?? p.amount), 0);
const totalPaidBase = sale ? totalPaidCustomer * parseFloat(sale.exchange_rate || 1) : totalPaidCustomer;
const balanceDueCustomer = sale ? parseFloat(sale.original_amount) - totalPaidCustomer : 0;
const balanceDueBase = sale ? parseFloat(sale.converted_amount || sale.total_amount) - totalPaidBase : 0;

    if (loading) {
        return <div className="text-center"><Spinner animation="border" /></div>;
    }

    if (error) {
        return <Alert variant="danger">{error}</Alert>;
    }

    return (
        <div>
            <Button variant="secondary" onClick={() => navigate('/sales')} className="mb-3">
                &larr; Back to Sales List
            </Button>
            {sale && (
                <Card>
                    {/* ... Card.Header and top customer details section ... */}
                    <Card.Header>
                        <h4>Sale Invoice #{sale.invoice_number || sale.id}</h4>
                    </Card.Header>
                    <Card.Body>
                        <Row className="mb-4">
                            <Col md={6}>
                                <h5>Customer Details:</h5>
                                <p><strong>Name:</strong> {sale.customer_name}</p>
                            </Col>
                            <Col md={6} className="text-md-end">
                                <h5>Sale Information:</h5>
                                <p><strong>Sale Date:</strong> {new Date(sale.sale_date).toLocaleDateString()}</p>
                            </Col>
                        </Row>

                        {/* ... Items Sold Table (no changes here) ... */}
                        <h5>Items Sold</h5>
                        <div className="data-table-container">
                            <Table responsive className="data-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Product</th>
                                        <th>Quantity</th>
                                        <th>Warehouse</th>
                                        <th>Unit Price</th>
                                        <th>Line Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sale.items.map((item, index) => {
                                        const productImage = resolveImageUrl(
                                            item.product_image || item.product?.image,
                                            BASE_API_URL
                                        );
                                        const imageInitial = getImageInitial(item.product_name);

                                        return (
                                            <tr key={item.id}>
                                                <td>{index + 1}</td>
                                                <td>
                                                    <div className="product-name-cell">
                                                        <div className="product-name-cell__image">
                                                            {productImage ? (
                                                                <img src={productImage} alt={item.product_name} />
                                                            ) : (
                                                                <span>{imageInitial}</span>
                                                            )}
                                                        </div>
                                                        <div className="product-name-cell__info">
                                                            <div className="product-name-cell__name">{item.product_name}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>{item.quantity}</td>
                                                <td>{item.warehouse_name || '—'}</td>
                                                <td>{formatCurrency(item.unit_price, sale.original_currency)}</td>
                                                <td>{formatCurrency(item.quantity * item.unit_price, sale.original_currency)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </Table>
                        </div>

                        <hr />

                        {/* --- NEW PAYMENT HISTORY SECTION --- */}
                        <Row className="mt-4">
                            <Col md={8}>
                                <h5>Payment History</h5>
                                <div className="data-table-container">
                                    <Table size="sm" responsive className="data-table data-table--compact">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Amount</th>
                                                <th>Method</th>
                                                <th>Notes</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {payments.length > 0 ? (
                                                payments.map((p) => (
                                                    <tr key={p.id}>
                                                        <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                                                        <td>
                                                            {formatCurrency(p.original_amount, p.original_currency)}
                                                            {p.original_currency !== baseCurrency && (
                                                                <div className="text-muted">
                                                                    {formatCurrency((p.converted_amount ?? p.amount) * parseFloat(sale.exchange_rate || 1), baseCurrency)}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td>{p.method}</td>
                                                        <td>{p.notes || 'N/A'}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="4" className="data-table-empty">No payments recorded.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </Table>
                                </div>
                                <Button
                                    variant="success"
                                    size="sm"
                                    onClick={() => setShowPaymentModal(true)}
                                    className="d-print-none"
                                >
                                    + Add Payment
                                </Button>
                            </Col>

                            {/* --- NEW FINANCIAL SUMMARY SECTION --- */}
                            <Col md={4} className="text-end">
                                <p className="mb-1">
                                    <strong>Subtotal:</strong>
                                    <span className="float-end">
                                        {formatCurrency(sale.original_amount, sale.original_currency)}
                                        {sale.original_currency !== baseCurrency && (
                                            <> ({formatCurrency(sale.converted_amount || sale.total_amount, baseCurrency)})</>
                                        )}
                                    </span>
                                </p>
                                <p className="mb-1">
                                    <strong>Total Paid:</strong>
                                    <span className="float-end text-success">{formatCurrency(totalPaidBase, baseCurrency)}</span>
                                </p>
                                <hr />
                                <h4 className="mb-0">
                                    <strong>Balance Due:</strong>
                                    <span className="float-end text-danger">{formatCurrency(balanceDueBase, baseCurrency)}</span>
                                </h4>
                                {sale.original_currency !== baseCurrency && (
                                    <div className="text-muted">
                                        {formatCurrency(balanceDueCustomer, sale.original_currency)}
                                    </div>
                                )}
                            </Col>
                        </Row>
                    </Card.Body>
                    <Card.Footer className="text-end d-print-none">
                        <Button variant="primary" className="me-2" onClick={handlePrint} disabled={isPrinting}>
                            {isPrinting ? <><Spinner as="span" animation="border" size="sm" /> Printing...</> : 'Print Invoice'}
                        </Button>
                        {/* --- 2. UPDATE THE BUTTONS --- */}
                        <Button as={Link} to={`/sales/${id}/edit`} variant="warning" className="me-2">
                            Edit Sale
                        </Button>
                        <Button variant="danger" onClick={handleDelete}>
                            Delete Sale
                        </Button>
                    </Card.Footer>
                </Card>
            )}
            {/* 4. RENDER THE MODAL COMPONENT */}
            <AddPaymentModal
                show={showPaymentModal}
                handleClose={() => setShowPaymentModal(false)}
                saleId={id}
                onPaymentAdded={fetchSaleData} // This tells the modal to re-run fetchSaleData after a successful payment
            />
            
        </div>
    );
}

export default SaleDetailPage;