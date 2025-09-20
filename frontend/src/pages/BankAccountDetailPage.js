// frontend/src/pages/BankAccountDetailPage.js

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';
import { ACCOUNT_CATEGORY_MAP, getCategoryConfig } from '../utils/bankAccountCategories';
import '../styles/datatable.css';

const TRANSACTION_TYPE_META = {
    deposit: { label: 'Deposit', variant: 'success' },
    withdrawal: { label: 'Withdrawal', variant: 'danger' },
    transfer_in: { label: 'Transfer In', variant: 'info' },
    transfer_out: { label: 'Transfer Out', variant: 'warning' },
};

const ACTION_LABELS = {
    deposit: 'Deposit Funds',
    withdraw: 'Withdraw Funds',
    transfer: 'Transfer Between Accounts',
};

const ACTION_VARIANTS = {
    deposit: 'success',
    withdraw: 'danger',
    transfer: 'primary',
};

const formatAmount = (value) => {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
        return '0.00';
    }
    return numericValue.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const formatDateTime = (value) => {
    if (!value) {
        return '—';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }
    return parsed.toLocaleString();
};

const formatDate = (value) => {
    if (!value) {
        return '—';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }
    return parsed.toLocaleDateString();
};

function BankAccountDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [account, setAccount] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [allAccounts, setAllAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const [actionType, setActionType] = useState('');
    const [actionForm, setActionForm] = useState({ amount: '', description: '', target_account: '' });
    const [actionError, setActionError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const loadAccountDetails = async () => {
            setLoading(true);
            try {
                const [accountRes, transactionsRes, accountsRes] = await Promise.all([
                    axiosInstance.get(`/accounts/${id}/`),
                    axiosInstance.get(`/accounts/${id}/transactions/`),
                    axiosInstance.get('/accounts/'),
                ]);
                setAccount(accountRes.data);
                setTransactions(transactionsRes.data);
                setAllAccounts(accountsRes.data);
                setError('');
            } catch (err) {
                console.error('Failed to load account details:', err);
                const message = err.response?.status === 404 ? 'Account not found.' : 'Could not load account details.';
                setError(message);
            } finally {
                setLoading(false);
            }
        };

        loadAccountDetails();
    }, [id]);

    const availableTransferAccounts = useMemo(() => {
        if (!account) {
            return [];
        }
        return allAccounts.filter((item) => item.id !== account.id && item.currency === account.currency);
    }, [account, allAccounts]);

    const handleOpenAction = (type) => {
        setActionType(type);
        setActionForm({ amount: '', description: '', target_account: '' });
        setActionError('');
    };

    const handleCloseAction = () => {
        setActionType('');
        setActionError('');
        setSubmitting(false);
    };

    const handleActionInputChange = (event) => {
        const { name, value } = event.target;
        setActionForm((prev) => ({ ...prev, [name]: value }));
    };

    const prependTransaction = (newTransaction) => {
        setTransactions((prev) => [newTransaction, ...prev]);
    };

    const updateAccountCache = (updatedAccount) => {
        setAccount(updatedAccount);
        setAllAccounts((prev) =>
            prev.map((item) => (item.id === updatedAccount.id ? { ...item, ...updatedAccount } : item))
        );
    };

    const handleSubmitAction = async () => {
        if (!account || !actionType) {
            return;
        }

        setSubmitting(true);
        setActionError('');

        const payload = {
            amount: actionForm.amount,
            description: actionForm.description,
        };

        let url = '';
        if (actionType === 'deposit') {
            url = `/accounts/${account.id}/deposit/`;
        } else if (actionType === 'withdraw') {
            url = `/accounts/${account.id}/withdraw/`;
        } else if (actionType === 'transfer') {
            url = `/accounts/${account.id}/transfer/`;
            payload.target_account = actionForm.target_account;
        }

        try {
            const response = await axiosInstance.post(url, payload);

            if (actionType === 'transfer') {
                const { source_account, target_account, transactions: txn } = response.data;
                updateAccountCache(source_account);
                setAllAccounts((prev) =>
                    prev.map((item) => {
                        if (item.id === target_account.id) {
                            return { ...item, ...target_account };
                        }
                        if (item.id === source_account.id) {
                            return { ...item, ...source_account };
                        }
                        return item;
                    })
                );
                if (txn?.source) {
                    prependTransaction(txn.source);
                }
                setSuccessMessage('Transfer completed successfully.');
            } else {
                const { account: updatedAccount, transaction } = response.data;
                updateAccountCache(updatedAccount);
                if (transaction) {
                    prependTransaction(transaction);
                }
                setSuccessMessage(actionType === 'deposit' ? 'Deposit recorded successfully.' : 'Withdrawal recorded successfully.');
            }

            handleCloseAction();
        } catch (err) {
            console.error('Failed to perform account action:', err);
            const message = err.response?.data?.detail || 'Unable to complete the request.';
            setActionError(message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="text-center py-5">
                <Spinner animation="border" />
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <Button variant="link" className="mb-3 ps-0" onClick={() => navigate('/accounts')}>
                    ← Back to accounts
                </Button>
                <Alert variant="danger">{error}</Alert>
            </div>
        );
    }

    if (!account) {
        return null;
    }

    const categoryConfig = getCategoryConfig(account.category);

    return (
        <div>
            <Button variant="link" className="mb-3 ps-0" onClick={() => navigate('/accounts')}>
                ← Back to accounts
            </Button>

            {successMessage && (
                <Alert variant="success" onClose={() => setSuccessMessage('')} dismissible>
                    {successMessage}
                </Alert>
            )}

            <Card className="mb-4 shadow-sm">
                <Card.Header className="d-flex justify-content-between align-items-start flex-column flex-md-row">
                    <div>
                        <h3 className="mb-1">{account.name}</h3>
                        <div className="d-flex align-items-center gap-2 text-muted">
                            <Badge bg={categoryConfig.badge}>{account.category_label || ACCOUNT_CATEGORY_MAP[account.category]?.label}</Badge>
                            <span>Opened on {formatDate(account.created_at)}</span>
                        </div>
                    </div>
                    <div className="mt-3 mt-md-0">
                        <Badge bg="primary" pill>
                            {account.currency}
                        </Badge>
                    </div>
                </Card.Header>
                <Card.Body>
                    <Row className="gy-4 align-items-center">
                        <Col md={6}>
                            <div className="text-muted text-uppercase small">Current Balance</div>
                            <h2 className="mb-0">
                                {formatAmount(account.balance)}{' '}
                                <small className="text-muted">{account.currency}</small>
                            </h2>
                        </Col>
                        <Col md={6} className="d-flex flex-wrap gap-2 justify-content-md-end">
                            <Button variant="success" onClick={() => handleOpenAction('deposit')}>
                                Deposit
                            </Button>
                            <Button variant="outline-danger" onClick={() => handleOpenAction('withdraw')}>
                                Withdraw
                            </Button>
                            <Button variant="primary" onClick={() => handleOpenAction('transfer')}>
                                Transfer
                            </Button>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            <Card className="shadow-sm">
                <Card.Header>
                    <h5 className="mb-0">Manual Transactions</h5>
                </Card.Header>
                <Card.Body className="p-0">
                    <div className="data-table-container">
                        <Table responsive className="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Description</th>
                                <th className="text-end">Incoming</th>
                                <th className="text-end">Outgoing</th>
                                <th>Related Account</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="data-table-empty">
                                        No manual transactions recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((txn) => {
                                    const meta = TRANSACTION_TYPE_META[txn.transaction_type] || {
                                        label: txn.transaction_type,
                                        variant: 'secondary',
                                    };
                                    const incoming = Number(txn.amount_in);
                                    const outgoing = Number(txn.amount_out);
                                    return (
                                        <tr key={txn.id}>
                                            <td>{formatDateTime(txn.created_at)}</td>
                                            <td>
                                                <Badge bg={meta.variant}>{meta.label}</Badge>
                                            </td>
                                            <td>{txn.description || '—'}</td>
                                            <td className="text-end">{incoming > 0 ? formatAmount(incoming) : '—'}</td>
                                            <td className="text-end">{outgoing > 0 ? formatAmount(outgoing) : '—'}</td>
                                            <td>{txn.related_account_name || '—'}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        </Table>
                    </div>
                </Card.Body>
            </Card>

            <Modal show={!!actionType} onHide={handleCloseAction} centered>
                <Modal.Header closeButton>
                    <Modal.Title>{ACTION_LABELS[actionType]}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {actionError && <Alert variant="danger">{actionError}</Alert>}
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>
                                Amount ({account.currency})
                            </Form.Label>
                            <Form.Control
                                type="number"
                                name="amount"
                                min="0"
                                step="0.01"
                                value={actionForm.amount}
                                onChange={handleActionInputChange}
                                placeholder="Enter amount"
                            />
                        </Form.Group>
                        {actionType === 'transfer' && (
                            <Form.Group className="mb-3">
                                <Form.Label>Destination Account</Form.Label>
                                <Form.Select
                                    name="target_account"
                                    value={actionForm.target_account}
                                    onChange={handleActionInputChange}
                                    disabled={availableTransferAccounts.length === 0}
                                >
                                    <option value="">Select account</option>
                                    {availableTransferAccounts.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </Form.Select>
                                {availableTransferAccounts.length === 0 && (
                                    <Form.Text className="text-muted">
                                        Create another account with the same currency to enable transfers.
                                    </Form.Text>
                                )}
                            </Form.Group>
                        )}
                        <Form.Group className="mb-0">
                            <Form.Label>Notes</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                name="description"
                                value={actionForm.description}
                                onChange={handleActionInputChange}
                                placeholder="Optional description"
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseAction} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button
                        variant={ACTION_VARIANTS[actionType]}
                        onClick={handleSubmitAction}
                        disabled={
                            submitting ||
                            !actionForm.amount ||
                            Number(actionForm.amount) <= 0 ||
                            (actionType === 'transfer' && !actionForm.target_account)
                        }
                    >
                        {submitting ? 'Processing…' : 'Confirm'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

export default BankAccountDetailPage;
