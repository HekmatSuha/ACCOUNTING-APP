import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';
import { getBaseCurrency, loadBaseCurrency } from '../config/currency';
import { formatCurrency } from '../utils/format';
import '../styles/payment-page.css';

const getTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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

const extractMethodFromPayment = (payment) => {
    if (!payment) {
        return 'Cash';
    }
    if (payment.method) {
        return payment.method;
    }
    const description = payment.description || '';
    const methodPart = description
        .split(' - ')
        .map((part) => part.trim())
        .find((part) => part.toLowerCase().startsWith('yöntem:'));
    if (!methodPart) {
        return 'Cash';
    }
    const [, methodValue] = methodPart.split(':');
    return methodValue ? methodValue.trim() : 'Cash';
};

const extractNotesFromPayment = (payment) => {
    if (!payment) {
        return '';
    }
    if (payment.notes) {
        return payment.notes;
    }
    const description = payment.description || '';
    if (!description) {
        return '';
    }
    const parts = description
        .split(' - ')
        .map((part) => part.trim())
        .filter(Boolean);
    const filtered = parts.filter((part) => {
        const lower = part.toLowerCase();
        if (lower === 'tedarikçiye ödeme' || lower === 'tedarikçiden tahsilat') {
            return false;
        }
        if (lower.startsWith('yöntem:')) {
            return false;
        }
        return true;
    });
    return filtered.join(' - ');
};

function SupplierPaymentPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const editingPaymentId = searchParams.get('paymentId');
    const paymentFromState = location.state?.paymentToEdit || null;

    const [editingPayment, setEditingPayment] = useState(paymentFromState);
    const [hasHydratedEdit, setHasHydratedEdit] = useState(false);
    const [editingLoading, setEditingLoading] = useState(false);

    const isEditing = Boolean(editingPaymentId);

    const [supplierData, setSupplierData] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [baseCurrency, setBaseCurrency] = useState(getBaseCurrency());

    const [transactionType, setTransactionType] = useState('payment');
    const [paymentDate, setPaymentDate] = useState(getTodayDate());
    const [method, setMethod] = useState('Cash');
    const [notes, setNotes] = useState('');
    const [account, setAccount] = useState('');
    const [amount, setAmount] = useState('');
    const [accountExchangeRate, setAccountExchangeRate] = useState('1');
    const [accountRateEdited, setAccountRateEdited] = useState(false);
    const [currencyRates, setCurrencyRates] = useState({});

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const supplierCurrency = supplierData?.supplier?.currency || baseCurrency || 'USD';
    const supplierName = supplierData?.supplier?.name || '';
    const summary = supplierData?.summary || null;

    const selectedAccount = useMemo(
        () => accounts.find((acc) => acc.id === Number(account)) || null,
        [accounts, account],
    );
    const accountCurrency = selectedAccount?.currency || supplierCurrency;
    const requiresAccountConversion = Boolean(selectedAccount && accountCurrency !== supplierCurrency);

    const fetchInitialData = async () => {
        setLoading(true);
        setError('');
        setSuccess('');
        try {
            const [detailsRes, accountsRes] = await Promise.all([
                axiosInstance.get(`suppliers/${id}/details/`),
                axiosInstance.get('/accounts/'),
            ]);

            let currencyMap = {};
            try {
                const currenciesRes = await axiosInstance.get('/currencies/');
                if (Array.isArray(currenciesRes.data)) {
                    currencyMap = currenciesRes.data.reduce((accumulator, currency) => {
                        if (currency?.code) {
                            accumulator[currency.code] = Number(currency.exchange_rate) || 0;
                        }
                        return accumulator;
                    }, {});
                }
            } catch (currencyErr) {
                console.warn('Failed to load currency rates for supplier payments.', currencyErr);
            }

            const loadedBaseCurrency = await loadBaseCurrency().catch(() => getBaseCurrency());
            setSupplierData(detailsRes.data);
            setAccounts(accountsRes.data || []);
            setCurrencyRates(currencyMap);
            setBaseCurrency(loadedBaseCurrency || getBaseCurrency());
            setTransactionType('payment');
            setPaymentDate(getTodayDate());
            setAmount('');
            setNotes('');
            setAccount('');
            setMethod('Cash');
            setAccountExchangeRate('1');
            setAccountRateEdited(false);
            setHasHydratedEdit(false);
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

    useEffect(() => {
        if (!isEditing) {
            setEditingPayment(null);
            setHasHydratedEdit(false);
            setEditingLoading(false);
        }
    }, [isEditing]);

    useEffect(() => {
        if (paymentFromState && isEditing) {
            setEditingPayment(paymentFromState);
            setHasHydratedEdit(false);
            setEditingLoading(false);
        }
    }, [paymentFromState, isEditing]);

    useEffect(() => {
        if (!isEditing) {
            return;
        }
        if (paymentFromState) {
            return;
        }
        if (!editingPaymentId) {
            return;
        }

        let ignore = false;

        const loadPayment = async () => {
            try {
                setEditingLoading(true);
                const response = await axiosInstance.get(`suppliers/${id}/payments/${editingPaymentId}/`);
                if (!ignore) {
                    setEditingPayment(response.data);
                    setHasHydratedEdit(false);
                    setError('');
                }
            } catch (err) {
                console.error('Failed to load supplier payment for editing:', err);
                if (!ignore) {
                    setError('Failed to load payment details for editing.');
                }
            } finally {
                if (!ignore) {
                    setEditingLoading(false);
                }
            }
        };

        loadPayment();

        return () => {
            ignore = true;
        };
    }, [isEditing, paymentFromState, editingPaymentId, id]);

    useEffect(() => {
        if (!isEditing) {
            return;
        }
        if (!editingPayment) {
            return;
        }
        if (hasHydratedEdit) {
            return;
        }

        const rawAmount = Number(editingPayment.original_amount ?? editingPayment.amount ?? 0);
        const absoluteAmount = Math.abs(rawAmount);
        setTransactionType(rawAmount < 0 ? 'collection' : 'payment');
        setPaymentDate(editingPayment.expense_date || getTodayDate());
        setMethod(extractMethodFromPayment(editingPayment));
        setNotes(extractNotesFromPayment(editingPayment));
        const accountId = editingPayment.account ?? editingPayment.account_id ?? null;
        setAccount(accountId ? String(accountId) : '');
        setAmount(absoluteAmount ? absoluteAmount.toString() : '');
        const existingRate = editingPayment.account_exchange_rate
            ? String(editingPayment.account_exchange_rate)
            : editingPayment.exchange_rate
                ? String(editingPayment.exchange_rate)
                : '1';
        setAccountExchangeRate(existingRate || '1');
        setAccountRateEdited(Boolean(editingPayment.account_exchange_rate));
        setSuccess('');
        setError('');
        setHasHydratedEdit(true);
    }, [isEditing, editingPayment, hasHydratedEdit]);

    useEffect(() => {
        if (!selectedAccount) {
            setAccountExchangeRate('1');
            setAccountRateEdited(false);
            return;
        }

        if (!selectedAccount.currency || selectedAccount.currency === supplierCurrency) {
            setAccountExchangeRate('1');
            setAccountRateEdited(false);
            return;
        }

        if (accountRateEdited) {
            return;
        }

        const fromRate = currencyRates[supplierCurrency];
        const toRate = currencyRates[selectedAccount.currency];

        if (fromRate && toRate) {
            const computedRate = fromRate / toRate;
            if (Number.isFinite(computedRate) && computedRate > 0) {
                setAccountExchangeRate(computedRate.toFixed(6));
                return;
            }
        }

        setAccountExchangeRate('1');
    }, [selectedAccount, supplierCurrency, currencyRates, accountRateEdited]);

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
        setAccountExchangeRate('1');
        setAccountRateEdited(false);
    };

    const supplierImpactValue = useMemo(() => {
        const numeric = parseFloat(amount) || 0;
        return transactionType === 'payment' ? -numeric : numeric;
    }, [amount, transactionType]);

    const accountImpactValue = useMemo(() => {
        const numeric = parseFloat(amount) || 0;
        const baseFinal = transactionType === 'payment' ? numeric : -numeric;
        if (!selectedAccount) {
            return baseFinal;
        }
        const rate = parseFloat(accountExchangeRate);
        if (!rate || rate <= 0) {
            return baseFinal;
        }
        return baseFinal * rate;
    }, [amount, transactionType, selectedAccount, accountExchangeRate]);

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

        if (requiresAccountConversion) {
            const rateValue = parseFloat(accountExchangeRate);
            if (!rateValue || rateValue <= 0) {
                setError('Please provide a valid exchange rate.');
                return;
            }
        }

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
            expense_date: paymentDate,
            description: descriptionParts.join(' - '),
            original_amount: Number(finalAmount.toFixed(2)),
            original_currency: (supplierCurrency || baseCurrency || 'USD').toUpperCase(),
        };

        let accountAmount = finalAmount;

        if (selectedAccount) {
            payload.account = selectedAccount.id;
            const rateValue = parseFloat(accountExchangeRate);
            if (selectedAccount.currency && selectedAccount.currency !== supplierCurrency) {
                payload.account_exchange_rate = rateValue;
                accountAmount = finalAmount * rateValue;
            } else {
                payload.account_exchange_rate = 1;
            }
        } else if (account) {
            payload.account = Number(account);
        }

        payload.amount = Number(accountAmount.toFixed(2));
        payload.exchange_rate = 1;

        try {
            setSaving(true);
            if (isEditing && editingPaymentId) {
                await axiosInstance.put(`suppliers/${id}/payments/${editingPaymentId}/`, payload);
                await refreshSupplierSummary();
                navigate(`/suppliers/${id}`, { replace: true });
            } else {
                await axiosInstance.post(`suppliers/${id}/payments/`, payload);
                setSuccess('Payment saved successfully.');
                setAmount('');
                setNotes('');
                setAccount('');
                setMethod('Cash');
                setTransactionType('payment');
                setAccountExchangeRate('1');
                setAccountRateEdited(false);
                await refreshSupplierSummary();
            }
        } catch (err) {
            console.error('Failed to save supplier payment:', err);
            const message = buildErrorMessage(err?.response?.data) || 'Unable to save the payment. Please try again.';
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    const isFormReady = !isEditing || (hasHydratedEdit && !editingLoading);
    const isPageLoading = loading || (isEditing && !isFormReady);
    const fieldDisabled = saving || !isFormReady;
    const isSaveDisabled = saving || !isFormReady;
    const saveButtonLabel = saving
        ? isEditing
            ? 'Güncelleniyor…'
            : 'Kaydediliyor…'
        : isEditing
            ? 'Güncelle'
            : 'Kaydet';
    const formSubtitle = isEditing ? 'Tedarikçi Ödemesini Düzenle' : 'Tedarikçiye Ödeme Kaydı';

    return (
        <Container fluid className="payment-page">
            <div className="payment-page__header">
                <Button
                    type="submit"
                    form="supplier-payment-form"
                    className="payment-page__save-btn"
                    disabled={isSaveDisabled}
                >
                    {saveButtonLabel}
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

            {isPageLoading ? (
                <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                </div>
            ) : (
                <Row className="g-4">
                    <Col lg={8}>
                        <Card className="payment-form-card">
                            <div className="payment-form-card__header">
                                <div className="payment-form-card__title">GİRİŞ</div>
                                <h5 className="payment-form-card__subtitle">{formSubtitle}</h5>
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
                                                    disabled={fieldDisabled}
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
                                                    disabled={fieldDisabled}
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
                                                    disabled={fieldDisabled}
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
                                                    disabled={fieldDisabled}
                                                >
                                                    <option value="">Hesap seçin</option>
                                                    {accounts.map((acc) => {
                                                        const formattedBalance = formatCurrency(
                                                            acc.balance ?? 0,
                                                            acc.currency || baseCurrency || 'USD',
                                                        );
                                                        return (
                                                            <option key={acc.id} value={acc.id}>
                                                                {acc.name} ({formattedBalance})
                                                            </option>
                                                        );
                                                    })}
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
                                                    disabled={fieldDisabled}
                                                    required
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <div className="payment-form-card__converted">
                                                <div className="small text-uppercase text-muted">Tedarikçi bakiyesine yansıyan</div>
                                                <div>{formatCurrency(supplierImpactValue, supplierCurrency)}</div>
                                            </div>
                                        </Col>
                                        {selectedAccount && requiresAccountConversion && (
                                            <>
                                                <Col md={6}>
                                                    <Form.Group controlId="accountExchangeRate">
                                                        <Form.Label>
                                                            Kur ({supplierCurrency} ➜ {accountCurrency})
                                                        </Form.Label>
                                                        <Form.Control
                                                            type="number"
                                                            step="0.0001"
                                                            min="0"
                                                            value={accountExchangeRate}
                                                            onChange={(event) => {
                                                                setAccountRateEdited(true);
                                                                setAccountExchangeRate(event.target.value);
                                                            }}
                                                            disabled={fieldDisabled}
                                                            required
                                                        />
                                                    </Form.Group>
                                                </Col>
                                                <Col md={6}>
                                                    <div className="payment-form-card__converted">
                                                        <div className="small text-uppercase text-muted">
                                                            {(selectedAccount?.name || 'Hesap') + ' hareketi'} ({accountCurrency})
                                                        </div>
                                                        <div>{formatCurrency(accountImpactValue, accountCurrency)}</div>
                                                    </div>
                                                </Col>
                                            </>
                                        )}
                                        {selectedAccount && !requiresAccountConversion && (
                                            <Col md={6}>
                                                <div className="payment-form-card__converted">
                                                    <div className="small text-uppercase text-muted">
                                                        {(selectedAccount?.name || 'Hesap') + ' hareketi'} ({accountCurrency})
                                                    </div>
                                                    <div>{formatCurrency(accountImpactValue, accountCurrency)}</div>
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
                                                    disabled={fieldDisabled}
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
