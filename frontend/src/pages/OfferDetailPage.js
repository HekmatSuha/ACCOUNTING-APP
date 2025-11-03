import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Card, Button, Spinner, Alert, Row, Col, Table } from 'react-bootstrap';
import { formatCurrency } from '../utils/format';
import '../styles/datatable.css';
import { getBaseApiUrl, getImageInitial, resolveImageUrl } from '../utils/image';
import { useTranslation } from 'react-i18next';

const BASE_API_URL = getBaseApiUrl();

function OfferDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [offer, setOffer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchOfferData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axiosInstance.get(`/offers/${id}/`);
            setOffer(response.data);
            setError('');
        } catch (error) {
            console.error('Failed to fetch offer data:', error);
            setError(t('offers.loadError'));
        } finally {
            setLoading(false);
        }
    }, [id, t]);

    useEffect(() => {
        fetchOfferData();
    }, [fetchOfferData]);

    const handleConvertToSale = async () => {
        if (window.confirm(t('offers.convertConfirm'))) {
            try {
                const response = await axiosInstance.post(`/offers/${id}/convert_to_sale/`);
                alert(t('offers.convertSuccess'));
                navigate(`/sales/${response.data.sale_id}`);
            } catch (err) {
                console.error('Failed to convert offer to sale:', err);
                setError(t('offers.convertError'));
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
                {t('offers.backToList')}
            </Button>
            {offer && (
                <Card>
                    <Card.Header>
                        <h4>{t('offers.offerNumber', { id: offer.id })}</h4>
                    </Card.Header>
                    <Card.Body>
                        <Row className="mb-4">
                            <Col md={6}>
                                <h5>{t('offers.customerDetails')}</h5>
                                <p><strong>{t('offers.customerName')}:</strong> {offer.customer_name}</p>
                            </Col>
                            <Col md={6} className="text-md-end">
                                <h5>{t('offers.offerInformation')}</h5>
                                <p><strong>{t('offers.offerDate')}:</strong> {new Date(offer.offer_date).toLocaleDateString()}</p>
                                <p><strong>{t('offers.status')}:</strong> {offer.status}</p>
                            </Col>
                        </Row>

                        <h5>{t('offers.itemsHeading')}</h5>
                        <div className="data-table-container">
                            <Table responsive className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('offers.table.index')}</th>
                                        <th>{t('offers.table.product')}</th>
                                        <th>{t('offers.table.quantity')}</th>
                                        <th>{t('offers.table.unitPrice')}</th>
                                        <th>{t('offers.table.lineTotal')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {offer.items.map((item, index) => {
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
                                                                <img
                                                                    src={productImage}
                                                                    alt={t('offers.imageAlt', { name: item.product_name })}
                                                                />
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
                                                <td>{formatCurrency(item.unit_price)}</td>
                                                <td>{formatCurrency(item.quantity * item.unit_price)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </Table>
                        </div>

                        <hr />

                        <Row className="mt-4">
                            <Col md={12} className="text-end">
                                <h4 className="mb-0">
                                    <strong>{t('offers.total')}</strong>
                                    <span className="float-end">{formatCurrency(offer.total_amount)}</span>
                                </h4>
                            </Col>
                        </Row>
                    </Card.Body>
                    <Card.Footer className="text-end">
                        {offer.status === 'pending' && (
                            <Button variant="success" onClick={handleConvertToSale}>
                                {t('offers.convertToSale')}
                            </Button>
                        )}
                    </Card.Footer>
                </Card>
            )}
        </div>
    );
}

export default OfferDetailPage;
