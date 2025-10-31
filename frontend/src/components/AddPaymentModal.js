// frontend/src/components/AddPaymentModal.js

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';
import { getCurrencyOptions, loadCurrencyOptions, loadCurrencyRates } from '../config/currency';
import { formatCurrency } from '../utils/format';
import '../styles/paymentModal.css';

// Helper function to get today's date in YYYY-MM-DD format
const getTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
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

function AddPaymentModal({ show, handleClose, saleId, onPaymentAdded }) {
    const [paymentDate, setPaymentDate] = useState(getTodayDate());
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('Cash');
    const [notes, setNotes] = useState('');
    const [accounts, setAccounts] = useState([]);
    const [account, setAccount] = useState('');
    const [customerCurrency, setCustomerCurrency] = useState('USD');
    const [accountCurrency, setAccountCurrency] = useState('USD');
    const [paymentCurrency, setPaymentCurrency] = useState('USD');
    const [exchangeRate, setExchangeRate] = useState('1');
    const [exchangeRateEdited, setExchangeRateEdited] = useState(false);
    const [convertedAmount, setConvertedAmount] = useState('');
    const [currencyOptions, setCurrencyOptions] = useState([]);
    const [currencyRates, setCurrencyRates] = useState({});
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const resetForm = useMemo(
        () => () => {
            setPaymentDate(getTodayDate());
            setAmount('');
            setMethod('Cash');
            setNotes('');
            setAccount('');
            setExchangeRate('1');
            setExchangeRateEdited(false);
            setConvertedAmount('');
            setError('');
        },
        [],
    );

    useEffect(() => {
        if (!show) {
            return;
        }

        let ignore = false;

        const fetchInitialData = async () => {
            setLoading(true);
            setError('');

            try {
                const [accountsRes, saleRes] = await Promise.all([
                    axiosInstance.get('/accounts/'),
                    axiosInstance.get(`/sales/${saleId}/`),
                ]);

                if (ignore) {
                    return;
                }

                setAccounts(accountsRes.data || []);

                let detectedCurrency = saleRes.data?.original_currency || 'USD';

                if (saleRes.data?.customer) {
                    try {
                        const customerRes = await axiosInstance.get(`/customers/${saleRes.data.customer}/`);
                        if (!ignore) {
                            detectedCurrency = customerRes.data?.currency || detectedCurrency;
                        }
                    } catch (customerErr) {
                        console.warn('Failed to load customer currency for sale payment.', customerErr);
                    }
                }

                if (!ignore) {
                    setCustomerCurrency(detectedCurrency);
                    setPaymentCurrency(detectedCurrency);
                    setAccountCurrency(detectedCurrency);
                }

                const options = getCurrencyOptions();
                if (options.length === 0) {
                    const loadedOptions = await loadCurrencyOptions();
                    if (!ignore) {
                        setCurrencyOptions(loadedOptions);
                    }
                } else if (!ignore) {
                    setCurrencyOptions(options);
                }

                try {
                    const rates = await loadCurrencyRates();
                    if (!ignore) {
                        setCurrencyRates(rates || {});
                    }
                } catch (currencyErr) {
                    console.warn('Failed to load currency rates for sale payment modal.', currencyErr);
                }

                if (!ignore) {
                    resetForm();
                }
            } catch (err) {
                if (!ignore) {
                    console.error('Failed to fetch sale payment data:', err);
                    setError('Failed to load information for recording a payment.');
                }
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
        };

        fetchInitialData();

        return () => {
            ignore = true;
        };
    }, [show, saleId, resetForm]);

    useEffect(() => {
        if (!show) {
            return;
        }

        const selectedAccount = accounts.find((a) => a.id === Number(account));
        if (selectedAccount) {
            setAccountCurrency(selectedAccount.currency || customerCurrency);
        } else {
            setAccountCurrency(customerCurrency);
        }
        setExchangeRateEdited(false);
    }, [account, accounts, customerCurrency, show]);

    useEffect(() => {
        const amt = parseFloat(amount) || 0;

        if (paymentCurrency !== accountCurrency) {
            const rate = parseFloat(exchangeRate) || 0;
            if (rate > 0) {
                setConvertedAmount((amt * rate).toFixed(2));
            } else {
                setConvertedAmount('');
            }
        } else {
            if (exchangeRate !== '1') {
                setExchangeRate('1');
            }
            setConvertedAmount(amount);
            if (exchangeRateEdited) {
                setExchangeRateEdited(false);
            }
        }
    }, [amount, exchangeRate, paymentCurrency, accountCurrency, exchangeRateEdited]);

    useEffect(() => {
        if (!show) {
            return;
        }
        if (paymentCurrency === accountCurrency) {
            return;
        }
        if (exchangeRateEdited) {
            return;
        }

        const fromRate = currencyRates[paymentCurrency];
        const toRate = currencyRates[accountCurrency];
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
    }, [show, paymentCurrency, accountCurrency, currencyRates, exchangeRate, exchangeRateEdited]);

    const showExchangeFields = paymentCurrency !== accountCurrency;

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        const numericAmount = parseFloat(amount);
        if (!numericAmount || numericAmount <= 0) {
            setError('Please enter a valid amount.');
            return;
        }

        const numericRate = parseFloat(exchangeRate);
        if (showExchangeFields && (!numericRate || numericRate <= 0)) {
            setError('Please provide a valid exchange rate.');
            return;
        }

        const paymentData = {
            payment_date: paymentDate,
            original_amount: numericAmount,
            method,
            notes,
            original_currency: paymentCurrency,
            account: account || null,
        };

        if (account && showExchangeFields) {
            paymentData.account_exchange_rate = numericRate;
            paymentData.account_converted_amount = parseFloat(convertedAmount || '0');
        }

        if (paymentCurrency !== customerCurrency) {
            paymentData.exchange_rate = numericRate;
        }

        try {
            await axiosInstance.post(`/sales/${saleId}/payments/`, paymentData);
            if (onPaymentAdded) {
                onPaymentAdded();
            }
            handleClose();
            resetForm();
        } catch (err) {
            console.error('Failed to add payment:', err);
            const message = buildErrorMessage(err?.response?.data);
            setError(message);
        }
    };

    const resolvedPaymentCurrency = paymentCurrency || customerCurrency || 'USD';
    const resolvedAccountCurrency = accountCurrency || customerCurrency || resolvedPaymentCurrency;
    const amountNumber = Number(amount) || 0;
    const paymentAmountLabel = formatCurrency(amountNumber, resolvedPaymentCurrency);
    const convertedAmountLabel = showExchangeFields
        ? convertedAmount
            ? formatCurrency(convertedAmount, resolvedAccountCurrency)
            : '—'
        : formatCurrency(amountNumber, resolvedAccountCurrency);

    return (
        <Modal show={show} onHide={handleClose} centered className="payment-modal">
            <Form onSubmit={handleSubmit}>
                <Modal.Header closeButton>
                    <div>
                        <div className="payment-modal__title">Record Payment</div>
                        <div className="payment-modal__subtitle">Capture when and how this sale was paid.</div>
                    </div>
                </Modal.Header>
                <Modal.Body>
                    {error && <Alert variant="danger" className="payment-modal__alert">{error}</Alert>}
                    {loading ? (
                        <div className="text-center py-4">
                            <Spinner animation="border" />
                        </div>
                    ) : (
                        <div className="payment-modal__grid">
                            <Form.Group controlId="paymentDate" className="payment-modal__field">
                                <Form.Label>Payment Date</Form.Label>
                                <Form.Control
                                    type="date"
                                    value={paymentDate}
                                    onChange={(event) => setPaymentDate(event.target.value)}
                                    required
                                />
                            </Form.Group>
                            <Form.Group controlId="paymentAmount" className="payment-modal__field">
                                <Form.Label>Amount</Form.Label>
                                <Form.Control
                                    type="number"
                                    step="0.01"
                                    placeholder="Enter amount paid"
                                    value={amount}
                                    onChange={(event) => setAmount(event.target.value)}
                                    required
                                />
                            </Form.Group>
                            <Form.Group controlId="paymentMethod" className="payment-modal__field">
                                <Form.Label>Payment Method</Form.Label>
                                <Form.Select
                                    value={method}
                                    onChange={(event) => setMethod(event.target.value)}
                                >
                                    <option value="Cash">Cash</option>
                                    <option value="Bank">Bank Transfer</option>
                                    <option value="Card">Credit/Debit Card</option>
                                </Form.Select>
                            </Form.Group>
                            <Form.Group controlId="paymentAccount" className="payment-modal__field">
                                <Form.Label>Account</Form.Label>
                                <Form.Select
                                    value={account}
                                    onChange={(event) => {
                                        setAccount(event.target.value);
                                        setExchangeRateEdited(false);
                                    }}
                                >
                                    <option value="">No Account</option>
                                    {accounts.map((acc) => {
                                        const formattedBalance = formatCurrency(
                                            acc.balance ?? 0,
                                            acc.currency || resolvedAccountCurrency || 'USD',
                                        );
                                        return (
                                            <option key={acc.id} value={acc.id}>
                                                {acc.name} ({formattedBalance})
                                            </option>
                                        );
                                    })}
                                </Form.Select>
                            </Form.Group>
                            <Form.Group controlId="paymentCurrency" className="payment-modal__field">
                                <Form.Label>Currency</Form.Label>
                                <Form.Select
                                    value={paymentCurrency}
                                    onChange={(event) => {
                                        setPaymentCurrency(event.target.value);
                                        setExchangeRateEdited(false);
                                    }}
                                >
                                    {currencyOptions.map((c) => (
                                        <option key={c[0]} value={c[0]}>{c[1]}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>

                            {showExchangeFields && (
                                <>
                                    <Form.Group controlId="exchangeRate" className="payment-modal__field">
                                        <Form.Label>Exchange Rate ({paymentCurrency} to {accountCurrency})</Form.Label>
                                        <Form.Control
                                            type="number"
                                            step="0.0001"
                                            value={exchangeRate}
                                            onChange={(event) => {
                                                setExchangeRate(event.target.value);
                                                setExchangeRateEdited(true);
                                            }}
                                            required
                                        />
                                    </Form.Group>
                                    <Form.Group controlId="convertedAmount" className="payment-modal__field">
                                        <Form.Label>Converted Amount ({accountCurrency})</Form.Label>
                                        <Form.Control type="text" value={convertedAmount} readOnly />
                                    </Form.Group>
                                </>
                            )}
                            <Form.Group
                                controlId="paymentNotes"
                                className="payment-modal__field payment-modal__field--wide"
                            >
                                <Form.Label>Notes (Optional)</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={3}
                                    value={notes}
                                    onChange={(event) => setNotes(event.target.value)}
                                    placeholder="Add any context for this payment"
                                />
                            </Form.Group>
                        </div>
                    )}

                    {!loading && (
                        <div className="payment-modal__summary">
                            <div className="payment-modal__summary-row">
                                <span className="payment-modal__summary-label">Amount</span>
                                <span className="payment-modal__summary-value">{paymentAmountLabel}</span>
                            </div>
                            <div className="payment-modal__summary-row">
                                <span className="payment-modal__summary-label">Recorded to account</span>
                                <span className="payment-modal__summary-value">{convertedAmountLabel}</span>
                            </div>
                            {showExchangeFields ? (
                                <div className="payment-modal__summary-note">
                                    Exchange rate will be saved so the account reflects the converted amount.
                                </div>
                            ) : (
                                <div className="payment-modal__summary-note">
                                    Funds will be recorded in {resolvedAccountCurrency}.
                                </div>
                            )}
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer className="payment-modal__footer">
                    <Button variant="outline-secondary" type="button" onClick={handleClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit" disabled={loading}>
                        Save Payment
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
}

export default AddPaymentModal;
