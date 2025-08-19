import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Card, Button, Table, Alert, Spinner } from 'react-bootstrap';

function OfferListPage() {
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchOffers = async () => {
            try {
                setLoading(true);
                const response = await axiosInstance.get('/offers/');
                setOffers(response.data);
                setError('');
            } catch (err) {
                console.error("Failed to fetch offers:", err);
                setError('Could not retrieve offers data.');
            } finally {
                setLoading(false);
            }
        };

        fetchOffers();
    }, []);

    if (loading) {
        return <Spinner animation="border" />;
    }

    return (
        <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
                <h4>Offers</h4>
                <Button as={Link} to="/sales/new" variant="primary">
                    + New Offer
                </Button>
            </Card.Header>
            <Card.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Offer No.</th>
                            <th>Customer</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Total Amount</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {offers.length > 0 ? (
                            offers.map((offer, index) => (
                                <tr key={offer.id}>
                                    <td>{index + 1}</td>
                                    <td>{`OFFER-${offer.id}`}</td>
                                    <td>{offer.customer_name}</td>
                                    <td>{new Date(offer.offer_date).toLocaleDateString()}</td>
                                    <td>{offer.status}</td>
                                    <td>${parseFloat(offer.total_amount).toFixed(2)}</td>
                                    <td>
                                        <Button as={Link} to={`/offers/${offer.id}`} variant="info" size="sm">
                                        View
                                    </Button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="7" className="text-center">No offers found.</td>
                            </tr>
                        )}
                    </tbody>
                </Table>
            </Card.Body>
        </Card>
    );
}

export default OfferListPage;
