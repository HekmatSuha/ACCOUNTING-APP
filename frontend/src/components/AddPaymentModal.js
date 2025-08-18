// frontend/src/components/AddPaymentModal.js

import React, { useState } from 'react';
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

function AddPaymentModal({ show, handleClose, saleId, onPaymentAdded }) {
    // --- 1. ADD STATE FOR THE DATE, DEFAULTING TO TODAY ---
    const [paymentDate, setPaymentDate] = useState(getTodayDate());
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('Cash');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!amount || parseFloat(amount) <= 0) {
            setError('Please enter a valid amount.');
            return;
        }

        const paymentData = {
            // --- 2. ADD payment_date TO THE DATA SENT TO THE BACKEND ---
            payment_date: paymentDate,
            amount: parseFloat(amount),
            method,
            notes,
        };

        try {
            await axiosInstance.post(`/sales/${saleId}/payments/`, paymentData);
            onPaymentAdded();
            handleClose();
            // Clear form for next time
            setAmount('');
            setNotes('');
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