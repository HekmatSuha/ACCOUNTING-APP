import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';
import { getBaseCurrency, loadBaseCurrency } from '../config/currency';
import '../styles/payment-page.css';

const getTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const formatCurrency = (value, currency) => {
    const amount = Number(value) || 0;
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD',
        }).format(amount);
    } catch (error) {
        return `${amount.toFixed(2)} ${currency || ''}`.trim();
    }
};

const buildErrorMessage = (error) => {
    if (!error) return 'Unable to save the payment. Please try again.';
    if (typeof error === 'string') return error;
    if (Array.isArray(error)) {
        return error.map(buildErrorMessage).join(' ');
    }
    if (typeof error === 'object') {
        if (error.detail) return buildErrorMessage(error.detail);
        return Object.entries(error)
            .map(([field, messages]) => `${field}: ${buildErrorMessage(messages)}`)
            .join(' ');
    }
    return 'Unable to save the payment. Please try again.';
};

const describeSupplierBalance = (value) => {
    const numeric = Number(value) || 0;
    if (numeric > 0) return 'Tedarikçiye borçlusunuz.';
    if (numeric < 0) return 'Tedarikçi size borçlu.';
    return 'Hesap kapandı.';
};

function SupplierPaymentPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [supplierData, setSupplierData] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [baseCurrency, setBaseCurrency] = useState(getBaseCurrency());

    const [transactionType, setTransactionType] = useState('payment');
    const [paymentDate, setPaymentDate] = useState(getTodayDate());
    const [method, setMethod] = useState('Cash');
    const [notes, setNotes] = useState('');
    const [account, setAccount] = useState('');
    const [amount, setAmount] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const supplierCurrency = supplierData?.supplier?.currency || baseCurrency || 'USD';
    const supplierName = supplierData?.supplier?.name || '';
    const summary = supplierData?.summary || null;

    const fetchInitialData = async () => {
        setLoading(true);
        setError('');
        try {
            const [detailsRes, accountsRes] = await Promise.all([
                axiosInstance.get(`suppliers/${id}/details/`),
                axiosInstance.get('/accounts/'),
            ]);
            const loadedBaseCurrency = await loadBaseCurrency().catch(() => getBaseCurrency());
            setSupplierData(detailsRes.data);
            setAccounts(accountsRes.data || []);
            setBaseCurrency(loadedBaseCurrency || getBaseCurrency());
            setTransactionType('payment');
            setPaymentDate(getTodayDate());
            setAmount('');
            setNotes('');
            setAccount('');
            setMethod('Cash');
        } catch (err) {
            console.error('Failed to load supplier payment data:', err);
            setError('Failed to load supplier information for payment.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, [id]);

    const refreshSupplierSummary = async () => {
        try {
            const detailsRes = await axiosInstance.get(`suppliers/${id}/details/`);
            setSupplierData(detailsRes.data);
        } catch (err) {
            console.error('Failed to refresh supplier summary:', err);
        }
    };

    const handleAccountChange = (event) => {
        const selectedValue = event.target.value;
        setAccount(selectedValue);
    };

    const convertedAmountValue = useMemo(() => {
        const numeric = parseFloat(amount) || 0;
        const sign = transactionType === 'payment' ? -1 : 1;
        return numeric * sign;
    }, [amount, transactionType]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!supplierData) return;

        setError('');
        setSuccess('');

        const numericAmount = parseFloat(amount);
        if (!numericAmount || numericAmount <= 0) {
            setError('Please enter a valid amount greater than zero.');
            return;
        }

        const finalAmount = transactionType === 'payment' ? numericAmount : -numericAmount;

        const descriptionParts = [
            transactionType === 'payment' ? 'Tedarikçiye ödeme' : 'Tedarikçiden tahsilat',
        ];
        if (method) {
            descriptionParts.push(`Yöntem: ${method}`);
        }
        if (notes) {
            descriptionParts.push(notes);
        }

        const payload = {
            amount: finalAmount,
            expense_date: paymentDate,
            description: descriptionParts.join(' - '),
            account: account ? Number(account) : null,
        };

        try {
            setSaving(true);
            await axiosInstance.post(`suppliers/${id}/payments/`, payload);
            setSuccess('Payment saved successfully.');
            setAmount('');
            setNotes('');
            setAccount('');
            setMethod('Cash');
            setTransactionType('payment');
            await refreshSupplierSummary();
        } catch (err) {
            console.error('Failed to save supplier payment:', err);
            const message = buildErrorMessage(err?.response?.data) || 'Unable to save the payment. Please try again.';
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Container fluid className="payment-page">
            <div className="payment-page__header">
                <Button
                    type="submit"
                    form="supplier-payment-form"
                    className="payment-page__save-btn"
                    disabled={loading || saving}
                >
                    {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </Button>
                <Button
                    type="button"
                    className="payment-page__back-btn"
                    onClick={() => navigate(`/suppliers/${id}`)}
                >
                    Tedarikçi Sayfası
                </Button>
            </div>

            {error && <Alert variant="danger" className="payment-page__alert">{error}</Alert>}
            {success && <Alert variant="success" className="payment-page__alert">{success}</Alert>}

            {loading ? (
                <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                </div>
            ) : (
                <Row className="g-4">
                    <Col lg={8}>
                        <Card className="payment-form-card">
                            <div className="payment-form-card__header">
                                <div className="payment-form-card__title">GİRİŞ</div>
                                <h5 className="payment-form-card__subtitle">Tedarikçiye Ödeme Kaydı</h5>
                            </div>
                            <Card.Body>
                                <Form id="supplier-payment-form" onSubmit={handleSubmit}>
                                    <Row className="g-3">
                                        <Col md={6}>
                                            <Form.Group controlId="transactionType">
                                                <Form.Label>İşlem</Form.Label>
                                                <Form.Select
                                                    value={transactionType}
                                                    onChange={(event) => setTransactionType(event.target.value)}
                                                    disabled={saving}
                                                >
                                                    <option value="payment">Tedarikçiye Ödeme</option>
                                                    <option value="collection">Tedarikçiden Tahsilat</option>
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group controlId="paymentDate">
                                                <Form.Label>Tarih</Form.Label>
                                                <Form.Control
                                                    type="date"
                                                    value={paymentDate}
                                                    onChange={(event) => setPaymentDate(event.target.value)}
                                                    disabled={saving}
                                                    required
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group controlId="method">
                                                <Form.Label>Ödeme Yöntemi</Form.Label>
                                                <Form.Select
                                                    value={method}
                                                    onChange={(event) => setMethod(event.target.value)}
                                                    disabled={saving}
                                                >
                                                    <option value="Cash">Nakit</option>
                                                    <option value="Bank">Banka Transferi</option>
                                                    <option value="Card">Kart</option>
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group controlId="account">
                                                <Form.Label>Kasa / Hesap</Form.Label>
                                                <Form.Select
                                                    value={account}
                                                    onChange={handleAccountChange}
                                                    disabled={saving}
                                                >
                                                    <option value="">Hesap seçin</option>
                                                    {accounts.map((acc) => (
                                                        <option key={acc.id} value={acc.id}>
                                                            {acc.name} ({acc.currency})
                                                        </option>
                                                    ))}
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group controlId="amount">
                                                <Form.Label>Tutar ({supplierCurrency})</Form.Label>
                                                <Form.Control
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={amount}
                                                    onChange={(event) => setAmount(event.target.value)}
                                                    placeholder="Ödeme tutarını girin"
                                                    disabled={saving}
                                                    required
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <div className="payment-form-card__converted">
                                                <div className="small text-uppercase text-muted">Tedarikçi bakiyesine yansıyan</div>
                                                <div>{formatCurrency(convertedAmountValue, supplierCurrency)}</div>
                                            </div>
                                        </Col>
                                        <Col xs={12}>
                                            <Form.Group controlId="notes">
                                                <Form.Label>Açıklama</Form.Label>
                                                <Form.Control
                                                    as="textarea"
                                                    rows={3}
                                                    value={notes}
                                                    onChange={(event) => setNotes(event.target.value)}
                                                    placeholder="İsteğe bağlı açıklama ekleyin"
                                                    disabled={saving}
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                    <div className="payment-form-card__note mt-3">
                                        {transactionType === 'payment'
                                            ? 'Bu kayıt tedarikçiye yapılan ödeme olarak işlenecek.'
                                            : 'Bu kayıt tedarikçiden tahsilat olarak işlenecek.'}
                                    </div>
                                </Form>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col lg={4}>
                        <Card className="payment-side-card">
                            <div className="payment-side-card__header">
                                <div className="payment-side-card__name">{supplierName || 'Tedarikçi'}</div>
                                <div className="payment-side-card__meta">
                                    {supplierData?.supplier?.email || 'E-posta bilgisi yok'}
                                </div>
                                <div className="payment-side-card__meta">
                                    {supplierData?.supplier?.phone || 'Telefon bilgisi yok'}
                                </div>
                            </div>
                            <div className="payment-summary">
                                <div className="payment-summary__item">
                                    <div className="payment-summary__label">Açık Hesap Bakiyesi</div>
                                    <div className="payment-summary__value">
                                        {formatCurrency(summary?.open_balance || 0, supplierCurrency)}
                                    </div>
                                    <div className="payment-summary__hint">{describeSupplierBalance(summary?.open_balance)}</div>
                                </div>
                                <div className="payment-summary__item">
                                    <div className="payment-summary__label">Çek / Senet Bakiyesi</div>
                                    <div className="payment-summary__value">
                                        {formatCurrency(summary?.check_balance || 0, supplierCurrency)}
                                    </div>
                                    <div className="payment-summary__hint">Kayıtlı çek / senet bakiyesi</div>
                                </div>
                                <div className="payment-summary__item">
                                    <div className="payment-summary__label">Adres Bilgileri</div>
                                    <div className="payment-summary__value">
                                        {supplierData?.supplier?.address ? supplierData.supplier.address : 'Kayıtlı değil'}
                                    </div>
                                    <div className="payment-summary__hint">Adres ve banka bilgilerini tedarikçi profiline ekleyin.</div>
                                </div>
                            </div>
                        </Card>
                    </Col>
                </Row>
            )}
        </Container>
    );
}

export default SupplierPaymentPage;
