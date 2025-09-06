// frontend/src/components/AddPaymentModal.js

import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';
import { fetchExchangeRate, currencyOptions } from '../config/currency';

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

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const res = await axiosInstance.get('/accounts/');
                setAccounts(res.data);
            } catch (err) {
                console.error('Failed to fetch accounts:', err);
            }
        };
        const fetchCurrency = async () => {
            try {
                const saleRes = await axiosInstance.get(`/sales/${saleId}/`);
                const custRes = await axiosInstance.get(`/customers/${saleRes.data.customer}/`);
                setCustomerCurrency(custRes.data.currency);
                setPaymentCurrency(custRes.data.currency);
            } catch (err) {
                console.error('Failed to fetch currency info', err);
            }
        };
        fetchAccounts();
        fetchCurrency();
    }, [saleId]);

    useEffect(() => {
        if (account) {
            const acc = accounts.find(a => a.id === parseInt(account));
            if (acc) {
                setPaymentCurrency(acc.currency);
            }
        } else {
            setPaymentCurrency(customerCurrency);
        }
    }, [account, accounts, customerCurrency]);

    useEffect(() => {
        const convert = async () => {
            const amt = parseFloat(amount) || 0;
            if (paymentCurrency !== customerCurrency) {
                const rate = await fetchExchangeRate(paymentCurrency, customerCurrency);
                setExchangeRate(rate);
                setConvertedAmount((amt * rate).toFixed(2));
            } else {
                setExchangeRate(1);
                setConvertedAmount(amount);
            }
        };
        convert();
    }, [amount, paymentCurrency, customerCurrency]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!amount || parseFloat(amount) <= 0) {
            setError('Please enter a valid amount.');
            return;
        }

        const paymentData = {
            payment_date: paymentDate,
            amount: parseFloat(amount),
            method,
            notes,
            currency: paymentCurrency,
        };

        if (account) {
            paymentData.account = account;
        }
        if (paymentCurrency !== customerCurrency) {
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
                    {paymentCurrency !== customerCurrency && (
                        <Form.Group className="mb-3" controlId="convertedAmount">
                            <Form.Label>Converted Amount ({customerCurrency})</Form.Label>
                            <Form.Control type="number" value={convertedAmount} readOnly />
                        </Form.Group>
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
