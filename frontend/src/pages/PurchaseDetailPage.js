// frontend/src/pages/PurchaseDetailPage.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Card, Button, Spinner, Alert, Row, Col, Table } from 'react-bootstrap';
import { formatCurrency } from '../utils/format';
import '../styles/datatable.css';
import { getBaseApiUrl, getImageInitial, resolveImageUrl } from '../utils/image';

const BASE_API_URL = getBaseApiUrl();

function PurchaseDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [purchase, setPurchase] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchPurchaseDetails = async () => {
            try {
                const response = await axiosInstance.get(`/purchases/${id}/`);
                setPurchase(response.data);
            } catch (err) {
                setError('Could not load purchase details.');
            } finally {
                setLoading(false);
            }
        };
        fetchPurchaseDetails();
    }, [id]);

    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to delete this purchase? This will decrease product stock.')) {
            try {
                await axiosInstance.delete(`/purchases/${id}/`);
                navigate('/purchases');
            } catch (err) {
                setError('Could not delete the purchase.');
            }
        }
    };

    if (loading) return <div className="text-center"><Spinner animation="border" /></div>;
    if (error) return <Alert variant="danger">{error}</Alert>;

    return (
        <div>
            <Button variant="secondary" onClick={() => navigate('/purchases')} className="mb-3">
                &larr; Back to Purchases
            </Button>
            {purchase && (
                <Card>
                    <Card.Header><h4>Purchase from {purchase.supplier_name}</h4></Card.Header>
                    <Card.Body>
                        <Row className="mb-4">
                            <Col><strong>Supplier:</strong> {purchase.supplier_name}</Col>
                            <Col><strong>Date:</strong> {purchase.purchase_date}</Col>
                            <Col><strong>Bill #:</strong> {purchase.bill_number || 'N/A'}</Col>
                            <Col><strong>Account:</strong> {purchase.account_name || 'N/A'}</Col>
                        </Row>
                          <h5>Items Purchased</h5>
                          <div className="data-table-container">
                            <Table responsive className="data-table data-table--compact">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Quantity</th>
                                        <th>Warehouse</th>
                                        <th>Unit Price</th>
                                        <th>Line Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {purchase.items.map(item => {
                                        const productImage = resolveImageUrl(
                                            item.product_image || item.product?.image,
                                            BASE_API_URL
                                        );
                                        const imageInitial = getImageInitial(item.product_name);

                                        return (
                                            <tr key={item.id}>
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
                                                <td>{formatCurrency(item.unit_price, purchase.original_currency || 'USD')}</td>
                                                <td>{formatCurrency(item.line_total, purchase.original_currency || 'USD')}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </Table>
                          </div>
                        <h4 className="text-end mt-3">Total: {formatCurrency(purchase.total_amount, purchase.original_currency || 'USD')}</h4>
                    </Card.Body>
                    <Card.Footer className="text-end">
                        <Button as={Link} to={`/purchases/${purchase.id}/edit`} variant="warning" className="me-2">Edit</Button>
                        <Button variant="danger" onClick={handleDelete}>Delete</Button>
                    </Card.Footer>
                </Card>
            )}
        </div>
    );
}

export default PurchaseDetailPage;