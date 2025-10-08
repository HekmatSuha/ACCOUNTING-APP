// frontend/src/pages/BankAccountListPage.js

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner } from 'react-bootstrap';
import {
    FaCoins,
    FaDollarSign,
    FaEdit,
    FaEuroSign,
    FaPiggyBank,
    FaPlusCircle,
    FaTrash,
    FaWallet,
    FaLiraSign,
} from 'react-icons/fa';
import axiosInstance from '../utils/axiosInstance';
import { ACCOUNT_CATEGORY_MAP, ACCOUNT_CATEGORY_OPTIONS, getCategoryConfig } from '../utils/bankAccountCategories';
import ActionMenu from '../components/ActionMenu';

const AVAILABLE_CURRENCIES = ['USD', 'EUR', 'KZT', 'TRY'];

const currencyIconMap = {
    USD: <FaDollarSign />,
    EUR: <FaEuroSign />,
    KZT: <FaCoins />,
    TRY: <FaLiraSign />,
};

const CATEGORY_ACCENT_COLORS = {
    primary: '#3b82f6',
    success: '#22c55e',
    info: '#0ea5e9',
    warning: '#f59e0b',
    danger: '#ef4444',
    secondary: '#64748b',
    dark: '#0f172a',
};

const hexToRgba = (hex, alpha) => {
    if (!hex) {
        return `rgba(99, 102, 241, ${alpha})`;
    }
    let sanitized = hex.replace('#', '');
    if (sanitized.length === 3) {
        sanitized = sanitized
            .split('')
            .map((char) => char + char)
            .join('');
    }
    const bigint = parseInt(sanitized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

function BankAccountListPage() {
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentAccount, setCurrentAccount] = useState(null);
    const [formData, setFormData] = useState({ name: '', currency: 'USD', category: 'other' });
    const [error, setError] = useState('');

    const fetchAccounts = async (showSpinner = false) => {
        if (showSpinner) {
            setLoading(true);
        }
        try {
            const res = await axiosInstance.get('/accounts/');
            setAccounts(res.data);
            setError('');
        } catch (err) {
            console.error('Failed to fetch accounts:', err);
            setError('Could not fetch accounts.');
        } finally {
            if (showSpinner) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchAccounts(true);
    }, []);

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleShowModal = (account = null) => {
        if (account) {
            setIsEditing(true);
            setCurrentAccount(account);
            setFormData({
                name: account.name,
                currency: account.currency,
                category: account.category || 'other',
            });
        } else {
            setIsEditing(false);
            setCurrentAccount(null);
            setFormData({ name: '', currency: 'USD', category: 'other' });
        }
        setError('');
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const url = isEditing ? `/accounts/${currentAccount.id}/` : '/accounts/';
        const method = isEditing ? 'put' : 'post';
        try {
            await axiosInstance[method](url, formData);
            await fetchAccounts();
            handleCloseModal();
        } catch (err) {
            console.error('Failed to save account:', err.response?.data || err);
            setError('Failed to save account.');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this account?')) {
            return;
        }
        try {
            await axiosInstance.delete(`/accounts/${id}/`);
            await fetchAccounts();
        } catch (err) {
            console.error('Failed to delete account:', err);
            setError('Failed to delete account.');
        }
    };

    const totalsByCurrency = useMemo(() => {
        return accounts.reduce((acc, account) => {
            const currency = account.currency;
            const amount = Number(account.balance) || 0;
            acc[currency] = (acc[currency] || 0) + amount;
            return acc;
        }, {});
    }, [accounts]);

    const groupedAccounts = useMemo(() => {
        return accounts.reduce((acc, account) => {
            const category = account.category || 'other';
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push(account);
            return acc;
        }, {});
    }, [accounts]);

    const categoriesWithAccounts = ACCOUNT_CATEGORY_OPTIONS
        .map((option) => ({ ...option, accounts: groupedAccounts[option.value] || [] }))
        .filter((option) => option.accounts.length > 0);

    return (
        <>
            <div className="bank-accounts-hero gradient-card shadow-sm mb-4 p-4">
                <div className="d-flex flex-column flex-md-row gap-4 align-items-start align-items-md-center">
                    <div className="hero-icon rounded-circle d-flex align-items-center justify-content-center">
                        <FaPiggyBank />
                    </div>
                    <div className="flex-grow-1 w-100">
                        <div className="d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3">
                            <div>
                                <h1 className="hero-title mb-2">Bank Accounts</h1>
                                <p className="hero-subtitle mb-0">
                                    Monitor balances across cash, bank, and card accounts in one shimmering overview.
                                </p>
                            </div>
                            <Button
                                variant="success"
                                className="btn-glow"
                                onClick={() => handleShowModal()}
                            >
                                <FaPlusCircle className="me-2" /> New Account
                            </Button>
                        </div>
                        {!loading && (
                            <div className="hero-metrics mt-3 d-flex flex-wrap gap-3">
                                <span className="metric-pill">
                                    <FaWallet className="me-2" /> {accounts.length} total account
                                    {accounts.length === 1 ? '' : 's'}
                                </span>
                                {accounts.length > 0 && (
                                    <span className="metric-pill">
                                        <FaCoins className="me-2" /> {Object.keys(totalsByCurrency).length} active
                                        {' '}
                                        {Object.keys(totalsByCurrency).length === 1 ? 'currency' : 'currencies'}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {error && !showModal && <Alert variant="danger">{error}</Alert>}

            {loading ? (
                <div className="text-center py-5">
                    <Spinner animation="border" />
                </div>
            ) : accounts.length === 0 ? (
                <Card className="shadow-sm">
                    <Card.Body className="text-center py-5">
                        <h5 className="mb-2">Create your first bank account</h5>
                        <p className="text-muted mb-4">
                            Add cash tills, bank accounts, or credit cards to start tracking balances.
                        </p>
                        <Button variant="success" className="btn-glow" onClick={() => handleShowModal()}>
                            Add Account
                        </Button>
                    </Card.Body>
                </Card>
            ) : (
                <>
                    <Row className="g-3 mb-4">
                        {Object.entries(totalsByCurrency).map(([currency, total]) => {
                            const accountsInCurrency = accounts.filter(
                                (account) => account.currency === currency,
                            ).length;
                            return (
                                <Col md={6} lg={4} key={currency}>
                                    <Card className="shadow-sm h-100 border-0 summary-card">
                                        <Card.Body className="d-flex flex-column">
                                            <div className="summary-icon">
                                                {currencyIconMap[currency] || <FaCoins />}
                                            </div>
                                            <div className="summary-content mt-3">
                                                <p className="summary-label mb-1">Total Balance</p>
                                                <h2 className="summary-amount mb-0">{formatAmount(total)}</h2>
                                            </div>
                                            <div className="summary-footer mt-auto d-flex justify-content-between align-items-center">
                                                <Badge bg="light" text="dark" className="currency-badge">
                                                    {currency}
                                                </Badge>
                                                <span className="text-muted small">
                                                    {accountsInCurrency} account
                                                    {accountsInCurrency === 1 ? '' : 's'}
                                                </span>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            );
                        })}
                    </Row>

                    {categoriesWithAccounts.map((categoryInfo) => {
                        const categoryAccent =
                            CATEGORY_ACCENT_COLORS[categoryInfo.badge] || CATEGORY_ACCENT_COLORS.primary;
                        const categoryAccentSoft = hexToRgba(categoryAccent, 0.18);
                        return (
                            <Card
                                className="mb-4 shadow-sm category-card"
                                key={categoryInfo.value}
                                style={{ '--category-accent': categoryAccent, '--category-accent-soft': categoryAccentSoft }}
                            >
                                <Card.Header className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h5 className="mb-1">{categoryInfo.label}</h5>
                                        <small className="text-muted">
                                            {categoryInfo.accounts.length} account{categoryInfo.accounts.length > 1 ? 's' : ''}
                                        </small>
                                    </div>
                                    <Badge bg={categoryInfo.badge}>{categoryInfo.label}</Badge>
                                </Card.Header>
                                <Card.Body>
                                    <Row className="g-3">
                                        {categoryInfo.accounts.map((account) => {
                                            const categoryConfig = getCategoryConfig(account.category);
                                            const accentColor =
                                                CATEGORY_ACCENT_COLORS[categoryConfig.badge] || CATEGORY_ACCENT_COLORS.primary;
                                            const accentSoft = hexToRgba(accentColor, 0.18);
                                            return (
                                                <Col md={6} lg={4} key={account.id}>
                                                    <Card
                                                        className="h-100 border-0 shadow-sm account-card"
                                                        onClick={() => navigate(`/accounts/${account.id}`)}
                                                        style={{ '--account-accent': accentColor, '--account-accent-soft': accentSoft }}
                                                    >
                                                        <Card.Body>
                                                            <div className="d-flex justify-content-between align-items-start">
                                                                <div>
                                                                    <h6 className="text-muted mb-1">{account.name}</h6>
                                                                <h4 className="mb-0 account-balance">
                                                                    {formatAmount(account.balance)}{' '}
                                                                    <small className="text-muted">{account.currency}</small>
                                                                </h4>
                                                            </div>
                                                            <Badge bg={categoryConfig.badge} className="category-badge">
                                                                {account.category_label || ACCOUNT_CATEGORY_MAP[account.category]?.label}
                                                            </Badge>
                                                        </div>
                                                        <div className="d-flex justify-content-end mt-3">
                                                            <ActionMenu
                                                                toggleAriaLabel={`Account actions for ${account.name}`}
                                                                actions={[
                                                                    {
                                                                        label: 'Edit Account',
                                                                        icon: <FaEdit />,
                                                                        onClick: () => handleShowModal(account),
                                                                    },
                                                                    {
                                                                        label: 'Delete Account',
                                                                        icon: <FaTrash />,
                                                                        variant: 'text-danger',
                                                                        onClick: () => handleDelete(account.id),
                                                                    },
                                                                ]}
                                                            />
                                                        </div>
                                                        <div className="text-muted small mt-3 subtle-note">Tap to view account activity</div>
                                                    </Card.Body>
                                                </Card>
                                            </Col>
                                        );
                                    })}
                                </Row>
                            </Card.Body>
                        </Card>
                        );
                    })}
                </>
            )}

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
                                placeholder="e.g. Main Cash Register"
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Currency</Form.Label>
                            <Form.Select name="currency" value={formData.currency} onChange={handleInputChange}>
                                {AVAILABLE_CURRENCIES.map((currency) => (
                                    <option key={currency} value={currency}>
                                        {currency}
                                    </option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-1">
                            <Form.Label>Category</Form.Label>
                            <Form.Select name="category" value={formData.category} onChange={handleInputChange}>
                                {ACCOUNT_CATEGORY_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                        <Form.Text className="text-muted">
                            Choose how this account should be grouped on the overview cards.
                        </Form.Text>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSubmit}>
                        Save
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
}

export default BankAccountListPage;
