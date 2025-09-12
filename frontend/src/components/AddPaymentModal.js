// frontend/src/components/AddPaymentModal.js

import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';
import { getCurrencyOptions, loadCurrencyOptions } from '../config/currency';

// Helper function to get today's date in YYYY-MM-DD format
const getTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

function AddPaymentModal({ show, handleClose, saleId, onPaymentAdded }) {
    const [paymentDate, setPaymentDate] = useState(getTodayDate());
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('Cash');
    const [notes, setNotes] = useState('');
    const [accounts, setAccounts] = useState([]);
    const [account, setAccount] = useState('');
    const [paymentCurrency, setPaymentCurrency] = useState('USD');
    const [customerCurrency, setCustomerCurrency] = useState('USD');
    const [exchangeRate, setExchangeRate] = useState(1);
    const [convertedAmount, setConvertedAmount] = useState('');
    const [error, setError] = useState('');
    const [currencyOptions, setCurrencyOptions] = useState([]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const accountsRes = await axiosInstance.get('/accounts/');
                setAccounts(accountsRes.data);

                const saleRes = await axiosInstance.get(`/sales/${saleId}/`);
                const custRes = await axiosInstance.get(`/customers/${saleRes.data.customer}/`);
                setCustomerCurrency(custRes.data.currency);
                setPaymentCurrency(custRes.data.currency);

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
        fetchInitialData();
    }, [saleId]);

    const selectedAccount = account ? accounts.find(a => a.id === parseInt(account)) : null;
    const accountCurrency = selectedAccount ? selectedAccount.currency : customerCurrency;

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
            setError('Please enter a valid amount.');
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
            original_currency: paymentCurrency,
        };

        if (account) {
            paymentData.account = account;
        }
        if (paymentCurrency !== accountCurrency) {
            paymentData.exchange_rate = exchangeRate;
        }

        try {
            await axiosInstance.post(`/sales/${saleId}/payments/`, paymentData);
            onPaymentAdded();
            handleClose();
            // Clear form for next time
            setAmount('');
            setNotes('');
            setAccount('');
            setPaymentDate(getTodayDate()); // Reset date to today
        } catch (err) {
            console.error('Failed to add payment:', err);
            setError('Could not save the payment. Please try again.');
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered>
            <Modal.Header closeButton>
                <Modal.Title>Add New Payment</Modal.Title>
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
                            onChange={(e) => setAccount(e.target.value)}
                        >
                            <option value="">No Account</option>
                            {accounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="paymentCurrency">
                        <Form.Label>Currency</Form.Label>
                        <Form.Select value={paymentCurrency} onChange={(e) => setPaymentCurrency(e.target.value)}>
                            {currencyOptions.map((c) => (
                                <option key={c} value={c}>{c}</option>
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
                                <Form.Control type="number" value={convertedAmount} readOnly />
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
                    Save Payment
                </Button>
            </Modal.Footer>
        </Modal>
    );
}

export default AddPaymentModal;
