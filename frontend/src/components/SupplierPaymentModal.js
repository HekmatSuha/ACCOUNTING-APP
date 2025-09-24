import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';
import { getCurrencyOptions, loadCurrencyOptions, getBaseCurrency, loadBaseCurrency } from '../config/currency';

function SupplierPaymentModal({ show, handleClose, supplierId, onPaymentAdded, payment, supplierCurrency }) {
    const [amount, setAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
    const [method, setMethod] = useState('Cash');
    const [notes, setNotes] = useState('');
    const [account, setAccount] = useState('');
    const [accounts, setAccounts] = useState([]);
    const [accountCurrency, setAccountCurrency] = useState(getBaseCurrency());
    const [paymentCurrency, setPaymentCurrency] = useState('USD');
    const [baseCurrency, setBaseCurrency] = useState(getBaseCurrency());
    const [exchangeRate, setExchangeRate] = useState(1);
    const [convertedAmount, setConvertedAmount] = useState('');
    const [error, setError] = useState('');
    const [currencyOptions, setCurrencyOptions] = useState([]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const accountsRes = await axiosInstance.get('accounts/');
                setAccounts(accountsRes.data);

                const bc = await loadBaseCurrency();
                setBaseCurrency(bc);
                setAccountCurrency(supplierCurrency || bc);
                setPaymentCurrency(supplierCurrency || bc);

                const options = getCurrencyOptions();
                if (options.length === 0) {
                    const loadedOptions = await loadCurrencyOptions();
                    setCurrencyOptions(loadedOptions);
                } else {
                    setCurrencyOptions(options);
                }
            } catch (err) {
                console.error('Failed to fetch initial data:', err);
            }
        };

        if (show) {
            fetchInitialData();
        }

        if (payment) {
            setAmount(payment.original_amount);
            setPaymentDate(payment.payment_date);
            setMethod(payment.method);
            setNotes(payment.notes);
            setAccount(payment.account);
            setPaymentCurrency(payment.original_currency || supplierCurrency || getBaseCurrency());
            setExchangeRate(payment.account_exchange_rate ? Number(payment.account_exchange_rate) : 1);
            setConvertedAmount(payment.account_converted_amount ? String(payment.account_converted_amount) : '');
        } else {
            setAmount('');
            setPaymentDate(new Date().toISOString().slice(0, 10));
            setMethod('Cash');
            setNotes('');
            setAccount('');
            setPaymentCurrency(supplierCurrency || getBaseCurrency());
            setAccountCurrency(supplierCurrency || getBaseCurrency());
            setExchangeRate(1);
            setConvertedAmount('');
        }
    }, [payment, show, supplierCurrency]);


    useEffect(() => {
        if (account) {
            const acc = accounts.find(a => a.id === parseInt(account));
            if (acc) {
                setAccountCurrency(acc.currency);
            }
        } else {
            setAccountCurrency(supplierCurrency || baseCurrency);
        }
    }, [account, accounts, baseCurrency, supplierCurrency]);

    useEffect(() => {
        const amt = parseFloat(amount) || 0;
        if (paymentCurrency !== accountCurrency) {
            setConvertedAmount((amt * exchangeRate).toFixed(2));
        } else {
            setExchangeRate(1);
            setConvertedAmount(amount);
        }
    }, [amount, paymentCurrency, accountCurrency, exchangeRate]);


    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!amount || parseFloat(amount) <= 0) {
            setError('Please enter a valid positive amount.');
            return;
        }

        if (paymentCurrency !== accountCurrency && (!exchangeRate || exchangeRate <= 0)) {
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
            paymentData.account_exchange_rate = exchangeRate;
            paymentData.account_converted_amount = parseFloat(convertedAmount);
        }

        if (paymentCurrency !== supplierCurrency) {
            paymentData.exchange_rate = exchangeRate;
        }

        try {
            const url = payment
                ? `suppliers/${supplierId}/payments/${payment.id}/`
                : `suppliers/${supplierId}/payments/`;
            const httpMethod = payment ? 'put' : 'post';

            await axiosInstance[httpMethod](url, paymentData);

            onPaymentAdded();
            handleClose();
        } catch (err) {
            setError('Failed to process payment. Please try again.');
            console.error(err);
        }
    };

    return (
        <Modal show={show} onHide={handleClose}>
            <Modal.Header closeButton>
                <Modal.Title>{payment ? 'Edit Payment' : 'Add Payment'}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3" controlId="paymentAmount">
                        <Form.Label>Amount</Form.Label>
                        <Form.Control
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Enter amount"
                            required
                        />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="paymentDate">
                        <Form.Label>Payment Date</Form.Label>
                        <Form.Control
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            required
                        />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="paymentMethod">
                        <Form.Label>Payment Method</Form.Label>
                        <Form.Select value={method} onChange={(e) => setMethod(e.target.value)}>
                            <option value="Cash">Cash</option>
                            <option value="Bank">Bank Transfer</option>
                            <option value="Card">Credit/Debit Card</option>
                        </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="paymentAccount">
                        <Form.Label>Account</Form.Label>
                        <Form.Select value={account} onChange={(e) => setAccount(e.target.value)}>
                            <option value="">None (Pay from balance)</option>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="paymentCurrency">
                        <Form.Label>Currency</Form.Label>
                        <Form.Select value={paymentCurrency} onChange={(e) => setPaymentCurrency(e.target.value)}>
                            {currencyOptions.map(c => (
                                <option key={c[0]} value={c[0]}>{c[1]}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>

                    {paymentCurrency !== accountCurrency && (

                        <>
                            <Form.Group className="mb-3" controlId="exchangeRate">
                                <Form.Label>Exchange Rate ({paymentCurrency} to {accountCurrency})</Form.Label>
                                <Form.Control
                                    type="number"
                                    step="0.0001"
                                    value={exchangeRate}
                                    onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
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
                        <Form.Label>Notes</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional notes"
                        />
                    </Form.Group>
                    <Button variant="primary" type="submit">
                        {payment ? 'Update Payment' : 'Save Payment'}
                    </Button>
                </Form>
            </Modal.Body>
        </Modal>
    );
}

export default SupplierPaymentModal;
