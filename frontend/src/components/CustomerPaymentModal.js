import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';
import { getCurrencyOptions, loadCurrencyOptions, loadCurrencyRates } from '../config/currency';

// Helper function to get today's date in YYYY-MM-DD format
const getTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

function CustomerPaymentModal({ show, handleClose, customerId, onPaymentAdded, payment, customerCurrency }) {
    const [paymentDate, setPaymentDate] = useState(getTodayDate());
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('Cash');
    const [notes, setNotes] = useState('');
    const [accounts, setAccounts] = useState([]);
    const [account, setAccount] = useState('');
    const [accountCurrency, setAccountCurrency] = useState(customerCurrency);
    const [paymentCurrency, setPaymentCurrency] = useState(customerCurrency);
    const [exchangeRate, setExchangeRate] = useState('1');
    const [exchangeRateEdited, setExchangeRateEdited] = useState(false);
    const [convertedAmount, setConvertedAmount] = useState('');
    const [error, setError] = useState('');
    const [currencyOptions, setCurrencyOptions] = useState([]);
    const [currencyRates, setCurrencyRates] = useState({});

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const accountsRes = await axiosInstance.get('/accounts/');
                setAccounts(accountsRes.data);

                const options = getCurrencyOptions();
                if (options.length === 0) {
                    const loadedOptions = await loadCurrencyOptions();
                    setCurrencyOptions(loadedOptions);
                } else {
                    setCurrencyOptions(options);
                }

                try {
                    const rates = await loadCurrencyRates();
                    setCurrencyRates(rates || {});
                } catch (currencyErr) {
                    console.warn('Failed to load currency rates for customer payments.', currencyErr);
                }
            } catch (err) {
                console.error('Failed to fetch initial data:', err);
            }
        };
        if (show) {
            fetchInitialData();
        }
    }, [show]);

    useEffect(() => {
        if (show && payment) {
            setPaymentDate(payment.payment_date);
            setAmount(payment.original_amount);
            setMethod(payment.method);
            setNotes(payment.notes || '');
            setAccount(payment.account || '');
            setPaymentCurrency(payment.original_currency || customerCurrency);
            const existingRate = payment.account_exchange_rate
                ? String(payment.account_exchange_rate)
                : payment.exchange_rate
                    ? String(payment.exchange_rate)
                    : '1';
            setExchangeRate(existingRate);
            setExchangeRateEdited(Boolean(payment.account_exchange_rate));
            setConvertedAmount(payment.account_converted_amount ? String(payment.account_converted_amount) : '');
        } else if (show && !payment) {
            // Reset form when adding a new payment
            setPaymentDate(getTodayDate());
            setAmount('');
            setMethod('Cash');
            setNotes('');
            setAccount('');
            setPaymentCurrency(customerCurrency);
            setAccountCurrency(customerCurrency);
            setExchangeRate('1');
            setExchangeRateEdited(false);
            setConvertedAmount('');
        }
    }, [payment, show, customerCurrency]);


    useEffect(() => {
        const selectedAccount = accounts.find(a => a.id === parseInt(account));
        if (selectedAccount) {
            setAccountCurrency(selectedAccount.currency);
        } else {
            setAccountCurrency(customerCurrency);
        }
        setExchangeRateEdited(false);
    }, [account, accounts, customerCurrency]);

    useEffect(() => {
        const amt = parseFloat(amount) || 0;
        if (paymentCurrency !== accountCurrency) {
            const rate = parseFloat(exchangeRate) || 1;
            setConvertedAmount((amt * rate).toFixed(2));
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!amount || parseFloat(amount) <= 0) {
            setError('Please enter a valid amount.');
            return;
        }

        const numericRate = parseFloat(exchangeRate);

        if (paymentCurrency !== accountCurrency && (!numericRate || numericRate <= 0)) {
            setError('Please provide a valid exchange rate.');
            return;
        }

        const paymentData = {
            payment_date: paymentDate,
            original_amount: parseFloat(amount),
            method,
            notes,
            account: account || null,
            original_currency: paymentCurrency,
        };

        if (account && paymentCurrency !== accountCurrency) {
            paymentData.account_exchange_rate = numericRate;
            paymentData.account_converted_amount = parseFloat(convertedAmount);
        }

        if (paymentCurrency !== customerCurrency) {
            paymentData.exchange_rate = numericRate;
        }


        try {
            if (payment) {
                await axiosInstance.put(`/customers/${customerId}/payments/${payment.id}/`, paymentData);
            } else {
                await axiosInstance.post(`/customers/${customerId}/payments/`, paymentData);
            }
            onPaymentAdded();
            handleClose();
        } catch (err) {
            console.error('Failed to save payment:', err.response.data);
            setError('Could not save the payment. Please try again.');
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered>
            <Modal.Header closeButton>
                <Modal.Title>{payment ? 'Edit Payment' : 'Add New Payment'}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3" controlId="paymentDate">
                        <Form.Label>Payment Date</Form.Label>
                        <Form.Control
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            required
                        />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="paymentAmount">
                        <Form.Label>Amount</Form.Label>
                        <Form.Control
                            type="number"
                            step="0.01"
                            placeholder="Enter amount paid"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="paymentMethod">
                        <Form.Label>Payment Method</Form.Label>
                        <Form.Select
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                        >
                            <option value="Cash">Cash</option>
                            <option value="Bank">Bank Transfer</option>
                            <option value="Card">Credit/Debit Card</option>
                        </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="paymentAccount">
                        <Form.Label>Account</Form.Label>
                        <Form.Select
                            value={account}
                            onChange={(e) => {
                                setAccount(e.target.value);
                                setExchangeRateEdited(false);
                            }}
                        >
                            <option value="">No Account</option>
                            {accounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="paymentCurrency">
                        <Form.Label>Currency</Form.Label>
                        <Form.Select
                            value={paymentCurrency}
                            onChange={(e) => {
                                setPaymentCurrency(e.target.value);
                                setExchangeRateEdited(false);
                            }}
                        >
                            {currencyOptions.map(c => (
                                <option key={c[0]} value={c[0]}>{c[1]}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>

                    {showExchangeFields && (
                        <>
                            <Form.Group className="mb-3" controlId="exchangeRate">
                                <Form.Label>Exchange Rate ({paymentCurrency} to {accountCurrency})</Form.Label>
                                <Form.Control
                                    type="number"
                                    step="0.0001"
                                    value={exchangeRate}
                                    onChange={(e) => {
                                        setExchangeRate(e.target.value);
                                        setExchangeRateEdited(true);
                                    }}
                                    required
                                />
                            </Form.Group>
                            <Form.Group className="mb-3" controlId="convertedAmount">
                                <Form.Label>Converted Amount ({accountCurrency})</Form.Label>
                                <Form.Control type="text" value={convertedAmount} readOnly />
                            </Form.Group>
                        </>
                    )}
                    <Form.Group className="mb-3" controlId="paymentNotes">
                        <Form.Label>Notes (Optional)</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </Form.Group>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>
                    Cancel
                </Button>
                <Button variant="primary" onClick={handleSubmit}>
                    {payment ? 'Update Payment' : 'Save Payment'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
}

export default CustomerPaymentModal;
