// frontend/src/pages/BankAccountListPage.js

import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { Table, Button, Card, Modal, Form, Alert } from 'react-bootstrap';

function BankAccountListPage() {
    const [accounts, setAccounts] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentAccount, setCurrentAccount] = useState(null);
    const [formData, setFormData] = useState({ name: '' });
    const [error, setError] = useState('');

    const fetchAccounts = async () => {
        try {
            const res = await axiosInstance.get('/accounts/');
            setAccounts(res.data);
        } catch (err) {
            console.error('Failed to fetch accounts:', err);
            setError('Could not fetch accounts.');
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleShowModal = (account = null) => {
        if (account) {
            setIsEditing(true);
            setCurrentAccount(account);
            setFormData({ name: account.name });
        } else {
            setIsEditing(false);
            setCurrentAccount(null);
            setFormData({ name: '' });
        }
        setError('');
        setShowModal(true);
    };

    const handleCloseModal = () => setShowModal(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const url = isEditing ? `/accounts/${currentAccount.id}/` : '/accounts/';
        const method = isEditing ? 'put' : 'post';
        try {
            await axiosInstance[method](url, formData);
            fetchAccounts();
            handleCloseModal();
        } catch (err) {
            console.error('Failed to save account:', err.response?.data);
            setError('Failed to save account.');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this account?')) {
            try {
                await axiosInstance.delete(`/accounts/${id}/`);
                fetchAccounts();
            } catch (err) {
                console.error('Failed to delete account:', err);
                setError('Failed to delete account.');
            }
        }
    };

    return (
        <>
            <Card>
                <Card.Header className="d-flex justify-content-between align-items-center">
                    <h4>Bank Accounts</h4>
                    <Button variant="primary" onClick={() => handleShowModal()}>+ New Account</Button>
                </Card.Header>
                <Card.Body>
                    {error && !showModal && <Alert variant="danger">{error}</Alert>}
                    <Table striped bordered hover responsive>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Balance</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {accounts.map((acc) => (
                                <tr key={acc.id}>
                                    <td>{acc.name}</td>
                                    <td>${parseFloat(acc.balance).toFixed(2)}</td>
                                    <td>
                                        <Button variant="warning" size="sm" className="me-2" onClick={() => handleShowModal(acc)}>Edit</Button>
                                        <Button variant="danger" size="sm" onClick={() => handleDelete(acc.id)}>Delete</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Card.Body>
            </Card>

            <Modal show={showModal} onHide={handleCloseModal} centered>
                <Modal.Header closeButton>
                    <Modal.Title>{isEditing ? 'Edit Account' : 'Add New Account'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3">
                            <Form.Label>Account Name</Form.Label>
                            <Form.Control
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                required
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>Close</Button>
                    <Button variant="primary" onClick={handleSubmit}>Save</Button>
                </Modal.Footer>
            </Modal>
        </>
    );
}

export default BankAccountListPage;

