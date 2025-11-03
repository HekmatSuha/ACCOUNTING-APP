import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Container, Form, Row, Spinner } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';
import { getCurrencyOptions, loadCurrencyOptions, loadCurrencyRates } from '../config/currency';
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
    if (numeric > 0) return 'The customer owes you.';
    if (numeric < 0) return 'You owe the customer.';
    return 'Account settled.';
};

function CustomerPaymentPage() {
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
    const [exchangeRate, setExchangeRate] = useState('1');
    const [exchangeRateEdited, setExchangeRateEdited] = useState(false);
    const [currencyRates, setCurrencyRates] = useState({});

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
            setExchangeRate('1');
            setExchangeRateEdited(false);
            setHasHydratedEdit(false);

            try {
                const rates = await loadCurrencyRates();
                setCurrencyRates(rates || {});
            } catch (currencyErr) {
                console.warn('Failed to load currency rates for customer payments.', currencyErr);
            }
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
                const response = await axiosInstance.get(`/customers/${id}/payments/${editingPaymentId}/`);
                if (!ignore) {
                    setEditingPayment(response.data);
                    setHasHydratedEdit(false);
                    setError('');
                }
            } catch (err) {
                console.error('Failed to load payment for editing:', err);
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
        if (!customerData) {
            return;
        }
        if (hasHydratedEdit) {
            return;
        }

        const rawAmount = Number(editingPayment.original_amount ?? editingPayment.amount ?? 0);
        const absoluteAmount = Math.abs(rawAmount);
        setTransactionType(rawAmount < 0 ? 'refund' : 'collection');
        setPaymentDate(editingPayment.payment_date || getTodayDate());
        setMethod(editingPayment.method || 'Cash');
        setNotes(editingPayment.notes || '');
        const accountId = editingPayment.account ?? editingPayment.account_id ?? null;
        const accountValue = accountId ? String(accountId) : '';
        setAccount(accountValue);
        setPaymentCurrency(editingPayment.original_currency || customerCurrency);
        setAmount(absoluteAmount ? absoluteAmount.toString() : '');
        const existingRate = editingPayment.account_exchange_rate
            ? String(editingPayment.account_exchange_rate)
            : editingPayment.exchange_rate
                ? String(editingPayment.exchange_rate)
                : '1';
        setExchangeRate(existingRate);
        setExchangeRateEdited(Boolean(editingPayment.account_exchange_rate || editingPayment.exchange_rate));
        setSuccess('');
        setError('');
        setHasHydratedEdit(true);
    }, [isEditing, editingPayment, hasHydratedEdit, customerCurrency, customerData]);

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
        } else {
            setPaymentCurrency(customerCurrency);
        }
        setExchangeRate('1');
        setExchangeRateEdited(false);
    };

    const requiresExchangeRate = useMemo(
        () => Boolean(paymentCurrency && paymentCurrency !== customerCurrency),
        [paymentCurrency, customerCurrency],
    );

    const convertedAmountValue = useMemo(() => {
        const numericAmount = parseFloat(amount) || 0;
        const rate = parseFloat(exchangeRate) || 1;
        const sign = transactionType === 'collection' ? 1 : -1;
        return numericAmount * rate * sign;
    }, [amount, exchangeRate, transactionType]);

    const handleCurrencyChange = (newCurrency) => {
        setPaymentCurrency(newCurrency);
        setExchangeRateEdited(false);
        if (newCurrency === customerCurrency) {
            setExchangeRate('1');
        }
    };

    useEffect(() => {
        if (!requiresExchangeRate) {
            if (exchangeRate !== '1') {
                setExchangeRate('1');
            }
            if (exchangeRateEdited) {
                setExchangeRateEdited(false);
            }
            return;
        }

        if (exchangeRateEdited) {
            return;
        }

        const fromRate = currencyRates[paymentCurrency];
        const toRate = currencyRates[customerCurrency];

        if (!fromRate || !toRate) {
            return;
        }

        const computedRate = fromRate / toRate;
        if (!Number.isFinite(computedRate) || computedRate <= 0) {
            return;
        }

        const rateString = computedRate.toFixed(6);
        if (rateString !== exchangeRate) {
            setExchangeRate(rateString);
        }
    }, [requiresExchangeRate, paymentCurrency, customerCurrency, currencyRates, exchangeRate, exchangeRateEdited]);

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
        const chosenCurrency = paymentCurrency || customerCurrency;
        const numericRate = parseFloat(exchangeRate);
        const requiresCustomerRate = Boolean(chosenCurrency && chosenCurrency !== customerCurrency);
        const requiresAccountRate = Boolean(
            selectedAccount && chosenCurrency && selectedAccount.currency !== chosenCurrency,
        );

        if ((requiresCustomerRate || requiresAccountRate) && (!numericRate || numericRate <= 0)) {
            setError('Please provide a valid exchange rate.');
            return;
        }

        const finalAmount = transactionType === 'collection' ? numericAmount : -numericAmount;

        const payload = {
            payment_date: paymentDate,
            original_amount: finalAmount,
            method,
            notes,
            original_currency: chosenCurrency,
        };

        if (selectedAccount) {
            payload.account = selectedAccount.id;
            if (requiresAccountRate) {
                payload.account_exchange_rate = numericRate;
            }
        }

        if (requiresCustomerRate) {
            payload.exchange_rate = numericRate;
        }

        try {
            setSaving(true);
            if (isEditing && editingPaymentId) {
                await axiosInstance.put(`/customers/${id}/payments/${editingPaymentId}/`, payload);
                await refreshCustomerSummary();
                navigate(`/customers/${id}`, { replace: true });
            } else {
                await axiosInstance.post(`/customers/${id}/payments/`, payload);
                setSuccess('Payment recorded successfully.');
                setAmount('');
                setNotes('');
                setAccount('');
                setMethod('Cash');
                setTransactionType('collection');
                setPaymentCurrency(customerCurrency);
                setExchangeRate('1');
                await refreshCustomerSummary();
            }
        } catch (err) {
            console.error('Failed to save payment:', err);
            const message = buildErrorMessage(err?.response?.data) || 'Could not save the payment. Please try again.';
            setError(message);
        } finally {
            setSaving(false);
        }
    };

    const isPageLoading = loading || editingLoading;
    const isFormReady = !isEditing || (hasHydratedEdit && !editingLoading);
    const fieldDisabled = saving || !isFormReady;
    const isSaveDisabled = saving || !isFormReady || isPageLoading;
    const saveButtonLabel = saving
        ? isEditing
            ? 'Updating…'
            : 'Saving…'
        : isEditing
            ? 'Update'
            : 'Save';
    const formSubtitle = isEditing ? 'Edit Customer Collection' : 'Record Customer Collection';

    return (
        <Container fluid className="payment-page">
            <div className="payment-page__header">
                <Button
                    type="submit"
                    form="customer-payment-form"
                    className="payment-page__save-btn"
                    disabled={isSaveDisabled}
                >
                    {saveButtonLabel}
                </Button>
                <Button
                    type="button"
                    className="payment-page__back-btn"
                    onClick={() => navigate(`/customers/${id}`)}
                >
                    Customer Page
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
                                <div className="payment-form-card__title">ENTRY</div>
                                <h5 className="payment-form-card__subtitle">{formSubtitle}</h5>
                            </div>
                            <Card.Body>
                                <Form id="customer-payment-form" onSubmit={handleSubmit}>
                                    <Row className="g-3">
                                        <Col md={6}>
                                            <Form.Group controlId="transactionType">
                                                <Form.Label>Transaction</Form.Label>
                                                <Form.Select
                                                    value={transactionType}
                                                    onChange={(event) => setTransactionType(event.target.value)}
                                                    disabled={fieldDisabled}
                                                >
                                                    <option value="collection">Collection from Customer</option>
                                                    <option value="refund">Payment to Customer</option>
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group controlId="paymentDate">
                                                <Form.Label>Date</Form.Label>
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
                                                <Form.Label>Payment Method</Form.Label>
                                                <Form.Select
                                                    value={method}
                                                    onChange={(event) => setMethod(event.target.value)}
                                                    disabled={fieldDisabled}
                                                >
                                                    <option value="Cash">Cash</option>
                                                    <option value="Bank">Bank Transfer</option>
                                                    <option value="Card">Card</option>
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group controlId="account">
                                                <Form.Label>Cash / Account</Form.Label>
                                                <Form.Select
                                                    value={account}
                                                    onChange={handleAccountChange}
                                                    disabled={fieldDisabled}
                                                >
                                                    <option value="">Select an account</option>
                                                    {accounts.map((acc) => {
                                                        const formattedBalance = formatCurrency(
                                                            acc.balance ?? 0,
                                                            acc.currency || customerCurrency || 'USD',
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
                                                <Form.Label>Amount ({paymentCurrency || customerCurrency})</Form.Label>
                                                <Form.Control
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={amount}
                                                    onChange={(event) => setAmount(event.target.value)}
                                                    placeholder="Enter the payment amount"
                                                    disabled={fieldDisabled}
                                                    required
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group controlId="paymentCurrency">
                                                <Form.Label>Currency</Form.Label>
                                                <Form.Select
                                                    value={paymentCurrency}
                                                    onChange={(event) => handleCurrencyChange(event.target.value)}
                                                    disabled={fieldDisabled || Boolean(account)}
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
                                                        <Form.Label>
                                                            Exchange Rate ({paymentCurrency} ➜ {customerCurrency})
                                                        </Form.Label>
                                                        <Form.Control
                                                            type="number"
                                                            step="0.0001"
                                                            min="0"
                                                            value={exchangeRate}
                                                            onChange={(event) => {
                                                                setExchangeRate(event.target.value);
                                                                setExchangeRateEdited(true);
                                                            }}
                                                            disabled={fieldDisabled}
                                                            required
                                                        />
                                                    </Form.Group>
                                                </Col>
                                                <Col md={6}>
                                                    <div className="payment-form-card__converted">
                                                        <div className="small text-uppercase text-muted">Reflected in customer balance</div>
                                                        <div>{formatCurrency(convertedAmountValue, customerCurrency)}</div>
                                                    </div>
                                                </Col>
                                            </>
                                        )}
                                        {!requiresExchangeRate && (
                                            <Col md={6}>
                                                <div className="payment-form-card__converted">
                                                    <div className="small text-uppercase text-muted">Reflected in customer balance</div>
                                                    <div>{formatCurrency(convertedAmountValue, customerCurrency)}</div>
                                                </div>
                                            </Col>
                                        )}
                                        <Col xs={12}>
                                            <Form.Group controlId="notes">
                                                <Form.Label>Notes</Form.Label>
                                                <Form.Control
                                                    as="textarea"
                                                    rows={3}
                                                    value={notes}
                                                    onChange={(event) => setNotes(event.target.value)}
                                                    placeholder="Add an optional note"
                                                    disabled={fieldDisabled}
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                    <div className="payment-form-card__note mt-3">
                                        {transactionType === 'collection'
                                            ? 'This entry will be processed as a collection from the customer.'
                                            : 'This entry will be processed as a payment to the customer.'}
                                    </div>
                                </Form>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col lg={4}>
                        <Card className="payment-side-card">
                            <div className="payment-side-card__header">
                                <div className="payment-side-card__name">{customerName || 'Customer'}</div>
                                <div className="payment-side-card__meta">
                                    {customerData?.customer?.email || 'No email available'}
                                </div>
                                <div className="payment-side-card__meta">
                                    {customerData?.customer?.phone || 'No phone available'}
                                </div>
                            </div>
                            <div className="payment-summary">
                                <div className="payment-summary__item">
                                    <div className="payment-summary__label">Open Balance</div>
                                    <div className="payment-summary__value">
                                        {formatCurrency(summary?.open_balance || 0, customerCurrency)}
                                    </div>
                                    <div className="payment-summary__hint">{describeOpenBalance(summary?.open_balance)}</div>
                                </div>
                                <div className="payment-summary__item">
                                    <div className="payment-summary__label">Check / Promissory Note Balance</div>
                                    <div className="payment-summary__value">
                                        {formatCurrency(summary?.check_balance || 0, customerCurrency)}
                                    </div>
                                    <div className="payment-summary__hint">Registered check / promissory note balance</div>
                                </div>
                                <div className="payment-summary__item">
                                    <div className="payment-summary__label">Bank Details</div>
                                    <div className="payment-summary__value">
                                        {customerData?.customer?.address ? customerData.customer.address : 'Not provided'}
                                    </div>
                                    <div className="payment-summary__hint">You can add bank details in the customer profile.</div>
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
