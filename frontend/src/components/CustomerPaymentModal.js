import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';

// Helper function to get today's date in YYYY-MM-DD format
const getTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

function CustomerPaymentModal({ show, handleClose, customerId, onPaymentAdded, payment }) {
    const [paymentDate, setPaymentDate] = useState(getTodayDate());
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('Cash');
    const [notes, setNotes] = useState('');
    const [accounts, setAccounts] = useState([]);
    const [account, setAccount] = useState('');
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
        if (show) {
            fetchAccounts();
        }
    }, [show]);

    useEffect(() => {
        if (show && payment) {
            setPaymentDate(payment.payment_date);
            setAmount(payment.amount);
            setMethod(payment.method);
            setNotes(payment.notes || '');
            setAccount(payment.account || '');
        } else if (show && !payment) {
            // Reset form when adding a new payment
            setPaymentDate(getTodayDate());
            setAmount('');
            setMethod('Cash');
            setNotes('');
            setAccount('');
        }
    }, [payment, show]);

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
        };

        if (account) {
            paymentData.account = account;
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
            console.error('Failed to save payment:', err);
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
                            onChange={(e) => setAccount(e.target.value)}
                        >
                            <option value="">No Account</option>
                            {accounts.map((acc) => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>
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
