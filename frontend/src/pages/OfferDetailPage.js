import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Card, Button, Spinner, Alert, Row, Col, Table } from 'react-bootstrap';

function OfferDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [offer, setOffer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchOfferData = async () => {
        setLoading(true);
        try {
            const response = await axiosInstance.get(`/offers/${id}/`);
            setOffer(response.data);
            setError('');
        } catch (error) {
            console.error('Failed to fetch offer data:', error);
            setError('Could not load offer details.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOfferData();
    },[id]);

    const handleConvertToSale = async () => {
        if (window.confirm('Are you sure you want to convert this offer to a sale? This action cannot be undone.')) {
            try {
                const response = await axiosInstance.post(`/offers/${id}/convert_to_sale/`);
                alert('Offer converted to sale successfully.');
                navigate(`/sales/${response.data.sale_id}`);
            } catch (err) {
                console.error('Failed to convert offer to sale:', err);
                setError('Could not convert the offer. Please try again.');
            }
        }
    };

    if (loading) {
        return <div className="text-center"><Spinner animation="border" /></div>;
    }

    if (error) {
        return <Alert variant="danger">{error}</Alert>;
    }

    return (
        <div>
            <Button variant="secondary" onClick={() => navigate('/offers')} className="mb-3">
                &larr; Back to Offers List
            </Button>
            {offer && (
                <Card>
                    <Card.Header>
                        <h4>Offer #{offer.id}</h4>
                    </Card.Header>
                    <Card.Body>
                        <Row className="mb-4">
                            <Col md={6}>
                                <h5>Customer Details:</h5>
                                <p><strong>Name:</strong> {offer.customer_name}</p>
                            </Col>
                            <Col md={6} className="text-md-end">
                                <h5>Offer Information:</h5>
                                <p><strong>Offer Date:</strong> {new Date(offer.offer_date).toLocaleDateString()}</p>
                                <p><strong>Status:</strong> {offer.status}</p>
                            </Col>
                        </Row>

                        <h5>Items</h5>
                        <Table striped bordered hover responsive>
                            <thead>
                                <tr>
                                    <th>#</th><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Line Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {offer.items.map((item, index) => (
                                    <tr key={item.id}>
                                        <td>{index + 1}</td>
                                        <td>{item.product_name}</td>
                                        <td>{item.quantity}</td>
                                        <td>${parseFloat(item.unit_price).toFixed(2)}</td>
                                        <td>${(item.quantity * item.unit_price).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>

                        <hr />

                        <Row className="mt-4">
                            <Col md={12} className="text-end">
                                <h4 className="mb-0">
                                    <strong>Total:</strong>
                                    <span className="float-end">${parseFloat(offer.total_amount).toFixed(2)}</span>
                                </h4>
                            </Col>
                        </Row>
                    </Card.Body>
                    <Card.Footer className="text-end">
                        {offer.status === 'pending' && (
                            <Button variant="success" onClick={handleConvertToSale}>
                                Convert to Sale
                            </Button>
                        )}
                    </Card.Footer>
                </Card>
            )}
        </div>
    );
}

export default OfferDetailPage;
