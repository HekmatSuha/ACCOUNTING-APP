// frontend/src/pages/SaleListPage.js

import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Container, Card, Button, Alert, Spinner, Accordion, Table } from 'react-bootstrap';
import { ReceiptCutoff, PencilSquare, Trash } from 'react-bootstrap-icons';
import ActionMenu from '../components/ActionMenu';
import { formatCurrency } from '../utils/format';
import '../styles/datatable.css';
import '../styles/transaction-history.css';
import { getBaseApiUrl, getImageInitial, resolveImageUrl } from '../utils/image';

const BASE_API_URL = getBaseApiUrl();

function SaleListPage() {
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchSales = async () => {
            try {
                setLoading(true);
                // The backend uses SaleReadSerializer for list views
                const response = await axiosInstance.get('/sales/');
                setSales(response.data);
                setError('');
            } catch (err) {
                console.error("Failed to fetch sales:", err);
                setError('Could not retrieve sales data.');
            } finally {
                setLoading(false);
            }
        };

        fetchSales();
    }, []);

    const handleDeleteSale = async saleId => {
        if (!window.confirm('Are you sure you want to delete this sale?')) {
            return;
        }

        try {
            await axiosInstance.delete(`/sales/${saleId}/`);
            setSales(currentSales => currentSales.filter(sale => sale.id !== saleId));
        } catch (err) {
            setError('Failed to delete sale.');
        }
    };

    if (loading) {
        return (
            <div className="text-center">
                <Spinner animation="border" />
            </div>
        );
    }

    return (
        <Container fluid>
            <Card className="mb-3" style={{ background: '#f5f5f5' }}>
                <Card.Body className="d-flex justify-content-between align-items-center">
                    <div>
                        <h2 className="mb-0">Sales</h2>
                        <p className="mb-0 text-muted">Review every sale recorded across your business.</p>
                    </div>
                    <Button as={Link} to="/sales/new" variant="primary">
                        + New Sale
                    </Button>
                </Card.Body>
            </Card>

            {error && <Alert variant="danger">{error}</Alert>}

            <Card className="transaction-history-card transaction-history-card--sales">
                <Card.Header className="transaction-history-card__header">
                    <div>
                        <span className="transaction-history-card__eyebrow">History</span>
                        <h5 className="transaction-history-card__title mb-1">All Sales</h5>
                        <p className="transaction-history-card__subtitle mb-0">Click a sale to see invoice details and actions.</p>
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
                                const saleTags = [];

                                if (sale.invoice_number) {
                                    saleTags.push(sale.invoice_number);
                                }

                                if (sale.customer_name) {
                                    saleTags.push(sale.customer_name);
                                }

                                if (saleItems.length > 0) {
                                    saleTags.push(`${saleItems.length} item${saleItems.length !== 1 ? 's' : ''}`);
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
                                                    {formatCurrency(sale.total_amount, sale.original_currency || 'USD')}
                                                </div>
                                            </div>
                                        </Accordion.Header>
                                        <Accordion.Body>
                                            <div className="transaction-accordion__actions">
                                                <ActionMenu
                                                    toggleAriaLabel={`Sale actions for ${saleDate}`}
                                                    actions={[
                                                        {
                                                            label: 'View Sale',
                                                            icon: <ReceiptCutoff />,
                                                            onClick: () => navigate(`/sales/${sale.id}`),
                                                        },
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

                                            {saleItems.length > 0 ? (
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
                                                        {saleItems.map(item => {
                                                            const productImage = resolveImageUrl(
                                                                item.product_image || item.product?.image,
                                                                BASE_API_URL
                                                            );
                                                            const imageInitial = getImageInitial(item.product_name);

                                                            return (
                                                                <tr key={item.id || `${sale.id}-${item.product_name}`}>
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
                                                                    <td>{formatCurrency(item.unit_price, sale.original_currency || 'USD')}</td>
                                                                    <td className="text-end">
                                                                        {formatCurrency(item.line_total, sale.original_currency || 'USD')}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </Table>
                                            ) : (
                                                <div className="transaction-meta-grid">
                                                    <div className="transaction-meta-item transaction-meta-item--full">
                                                        <span className="transaction-meta-label">Customer</span>
                                                        <span className="transaction-meta-value">{sale.customer_name || 'N/A'}</span>
                                                    </div>
                                                    <div className="transaction-meta-item transaction-meta-item--full">
                                                        <span className="transaction-meta-label">Invoice Number</span>
                                                        <span className="transaction-meta-value">{sale.invoice_number || `SALE-${sale.id}`}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </Accordion.Body>
                                    </Accordion.Item>
                                );
                            })}
                        </Accordion>
                    ) : (
                        <div className="transaction-empty-state">
                            <p className="fw-semibold mb-1">No sales recorded yet</p>
                            <p className="mb-0">Create a sale to populate this history.</p>
                        </div>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
}

export default SaleListPage;