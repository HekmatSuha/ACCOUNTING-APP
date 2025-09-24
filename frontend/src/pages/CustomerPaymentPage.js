import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';
import { getCurrencyOptions, loadCurrencyOptions } from '../config/currency';
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
    if (!error) return 'Could not save the payment. Please try again.';
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
    return 'Could not save the payment. Please try again.';
};

const describeOpenBalance = (value) => {
    const numeric = Number(value) || 0;
    if (numeric > 0) return 'Müşteri size borçlu.';
    if (numeric < 0) return 'Müşteriye borçlusunuz.';
    return 'Hesap kapandı.';
};

function CustomerPaymentPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [customerData, setCustomerData] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [currencyOptions, setCurrencyOptions] = useState([]);

    const [transactionType, setTransactionType] = useState('collection');
    const [paymentDate, setPaymentDate] = useState(getTodayDate());
    const [method, setMethod] = useState('Cash');
    const [notes, setNotes] = useState('');
    const [account, setAccount] = useState('');
    const [amount, setAmount] = useState('');
    const [paymentCurrency, setPaymentCurrency] = useState('');
    const [exchangeRate, setExchangeRate] = useState(1);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const customerCurrency = customerData?.customer?.currency || 'USD';
    const customerName = customerData?.customer?.name || '';
    const summary = customerData?.summary || null;

    useEffect(() => {
        const ensureCurrencyOptions = async () => {
            const options = getCurrencyOptions();
            if (options.length === 0) {
                const loadedOptions = await loadCurrencyOptions();
                setCurrencyOptions(loadedOptions);
            } else {
                setCurrencyOptions(options);
            }
        };
        ensureCurrencyOptions();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        setError('');
        try {
            const [detailsRes, accountsRes] = await Promise.all([
                axiosInstance.get(`/customers/${id}/details/`),
                axiosInstance.get('/accounts/'),
            ]);
            setCustomerData(detailsRes.data);
            setAccounts(accountsRes.data || []);
            const defaultCurrency = detailsRes.data?.customer?.currency || 'USD';
            setPaymentCurrency(defaultCurrency);
            setTransactionType('collection');
            setPaymentDate(getTodayDate());
            setAmount('');
            setNotes('');
            setAccount('');
            setMethod('Cash');
            setExchangeRate(1);
        } catch (err) {
            console.error('Failed to load customer payment data:', err);
            setError('Failed to load customer information for payment.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, [id]);

    const refreshCustomerSummary = async () => {
        try {
            const detailsRes = await axiosInstance.get(`/customers/${id}/details/`);
            setCustomerData(detailsRes.data);
        } catch (err) {
            console.error('Failed to refresh customer summary:', err);
        }
    };

    const handleAccountChange = (event) => {
        const selectedValue = event.target.value;
        setAccount(selectedValue);
        const selectedAccount = accounts.find((acc) => acc.id === Number(selectedValue));
        if (selectedAccount) {
            setPaymentCurrency(selectedAccount.currency);
            setExchangeRate(1);
        } else {
            setPaymentCurrency(customerCurrency);
        }
    };

    const requiresExchangeRate = useMemo(
        () => !account && paymentCurrency && paymentCurrency !== customerCurrency,
        [account, paymentCurrency, customerCurrency],
    );

    const convertedAmountValue = useMemo(() => {
        const numericAmount = parseFloat(amount) || 0;
        const rate = parseFloat(exchangeRate) || 1;
        const sign = transactionType === 'collection' ? 1 : -1;
        return numericAmount * rate * sign;
    }, [amount, exchangeRate, transactionType]);

    const handleCurrencyChange = (newCurrency) => {
        setPaymentCurrency(newCurrency);
        if (newCurrency === customerCurrency) {
            setExchangeRate(1);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!customerData) return;

        setError('');
        setSuccess('');

        const numericAmount = parseFloat(amount);
        if (!numericAmount || numericAmount <= 0) {
            setError('Please enter a valid amount greater than zero.');
            return;
        }

        const selectedAccount = accounts.find((acc) => acc.id === Number(account));
        if (!selectedAccount && requiresExchangeRate) {
            const rate = parseFloat(exchangeRate);
            if (!rate || rate <= 0) {
                setError('Please provide a valid exchange rate.');
                return;
            }
        }

        const finalAmount = transactionType === 'collection' ? numericAmount : -numericAmount;

        const payload = {
            payment_date: paymentDate,
            original_amount: finalAmount,
            method,
            notes,
        };

        if (selectedAccount) {
            payload.account = selectedAccount.id;
        } else {
            payload.original_currency = paymentCurrency || customerCurrency;
            if (requiresExchangeRate) {
                payload.exchange_rate = parseFloat(exchangeRate);
            }
        }

        try {
            setSaving(true);
            await axiosInstance.post(`/customers/${id}/payments/`, payload);
            setSuccess('Payment recorded successfully.');
            setAmount('');
            setNotes('');
            setAccount('');
            setMethod('Cash');
            setTransactionType('collection');
            setPaymentCurrency(customerCurrency);
            setExchangeRate(1);
            await refreshCustomerSummary();
        } catch (err) {
            console.error('Failed to save payment:', err);
            const message = buildErrorMessage(err?.response?.data) || 'Could not save the payment. Please try again.';
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
                    form="customer-payment-form"
                    className="payment-page__save-btn"
                    disabled={loading || saving}
                >
                    {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </Button>
                <Button
                    type="button"
                    className="payment-page__back-btn"
                    onClick={() => navigate(`/customers/${id}`)}
                >
                    Müşteri Sayfası
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
                                <h5 className="payment-form-card__subtitle">Müşteri Tahsilatı Kaydı</h5>
                            </div>
                            <Card.Body>
                                <Form id="customer-payment-form" onSubmit={handleSubmit}>
                                    <Row className="g-3">
                                        <Col md={6}>
                                            <Form.Group controlId="transactionType">
                                                <Form.Label>İşlem</Form.Label>
                                                <Form.Select
                                                    value={transactionType}
                                                    onChange={(event) => setTransactionType(event.target.value)}
                                                    disabled={saving}
                                                >
                                                    <option value="collection">Müşteriden Tahsilat</option>
                                                    <option value="refund">Müşteriye Ödeme</option>
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
                                                <Form.Label>Tutar ({paymentCurrency || customerCurrency})</Form.Label>
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
                                            <Form.Group controlId="paymentCurrency">
                                                <Form.Label>Para Birimi</Form.Label>
                                                <Form.Select
                                                    value={paymentCurrency}
                                                    onChange={(event) => handleCurrencyChange(event.target.value)}
                                                    disabled={saving || Boolean(account)}
                                                >
                                                    {(currencyOptions.length ? currencyOptions : [[customerCurrency, customerCurrency]]).map(([code, label]) => (
                                                        <option key={code} value={code}>
                                                            {label}
                                                        </option>
                                                    ))}
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>

                                        {requiresExchangeRate && (
                                            <>
                                                <Col md={6}>
                                                    <Form.Group controlId="exchangeRate">
                                                        <Form.Label>Kur ({paymentCurrency} ➜ {customerCurrency})</Form.Label>
                                                        <Form.Control
                                                            type="number"
                                                            step="0.0001"
                                                            min="0"
                                                            value={exchangeRate}
                                                            onChange={(event) => setExchangeRate(event.target.value)}
                                                            disabled={saving}
                                                            required
                                                        />
                                                    </Form.Group>
                                                </Col>
                                                <Col md={6}>
                                                    <div className="payment-form-card__converted">
                                                        <div className="small text-uppercase text-muted">Müşteri bakiyesine yansıyan</div>
                                                        <div>{formatCurrency(convertedAmountValue, customerCurrency)}</div>
                                                    </div>
                                                </Col>
                                            </>
                                        )}
                                        {!requiresExchangeRate && (
                                            <Col md={6}>
                                                <div className="payment-form-card__converted">
                                                    <div className="small text-uppercase text-muted">Müşteri bakiyesine yansıyan</div>
                                                    <div>{formatCurrency(convertedAmountValue, customerCurrency)}</div>
                                                </div>
                                            </Col>
                                        )}
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
                                        {transactionType === 'collection'
                                            ? 'Bu kayıt müşteriden tahsilat olarak işlenecek.'
                                            : 'Bu kayıt müşteriye ödeme olarak işlenecek.'}
                                    </div>
                                </Form>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col lg={4}>
                        <Card className="payment-side-card">
                            <div className="payment-side-card__header">
                                <div className="payment-side-card__name">{customerName || 'Müşteri'}</div>
                                <div className="payment-side-card__meta">
                                    {customerData?.customer?.email || 'E-posta bilgisi yok'}
                                </div>
                                <div className="payment-side-card__meta">
                                    {customerData?.customer?.phone || 'Telefon bilgisi yok'}
                                </div>
                            </div>
                            <div className="payment-summary">
                                <div className="payment-summary__item">
                                    <div className="payment-summary__label">Açık Hesap Bakiyesi</div>
                                    <div className="payment-summary__value">
                                        {formatCurrency(summary?.open_balance || 0, customerCurrency)}
                                    </div>
                                    <div className="payment-summary__hint">{describeOpenBalance(summary?.open_balance)}</div>
                                </div>
                                <div className="payment-summary__item">
                                    <div className="payment-summary__label">Çek / Senet Bakiyesi</div>
                                    <div className="payment-summary__value">
                                        {formatCurrency(summary?.check_balance || 0, customerCurrency)}
                                    </div>
                                    <div className="payment-summary__hint">Kayıtlı çek / senet bakiyesi</div>
                                </div>
                                <div className="payment-summary__item">
                                    <div className="payment-summary__label">Banka Bilgileri</div>
                                    <div className="payment-summary__value">
                                        {customerData?.customer?.address ? customerData.customer.address : 'Kayıtlı değil'}
                                    </div>
                                    <div className="payment-summary__hint">Banka detaylarını müşteri profiline ekleyebilirsiniz.</div>
                                </div>
                            </div>
                        </Card>
                    </Col>
                </Row>
            )}
        </Container>
    );
}

export default CustomerPaymentPage;
