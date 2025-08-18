// frontend/src/pages/PurchaseDetailPage.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Card, Button, Spinner, Alert, Row, Col, Table } from 'react-bootstrap';

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
                        </Row>
                        <h5>Items Purchased</h5>
                        <Table striped bordered>
                            <thead><tr><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Line Total</th></tr></thead>
                            <tbody>
                                {purchase.items.map(item => (
                                    <tr key={item.id}>
                                        <td>{item.product_name}</td>
                                        <td>{item.quantity}</td>
                                        <td>${parseFloat(item.unit_price).toFixed(2)}</td>
                                        <td>${parseFloat(item.line_total).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                        <h4 className="text-end mt-3">Total: ${parseFloat(purchase.total_amount).toFixed(2)}</h4>
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