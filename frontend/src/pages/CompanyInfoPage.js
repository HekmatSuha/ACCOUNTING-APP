// frontend/src/pages/CompanyInfoPage.js

import React, { useEffect, useState } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { Alert, Button, Card, Col, Form, Row, Spinner, Table } from 'react-bootstrap';
import { clearCachedCurrencies, loadBaseCurrency, loadCurrencyOptions } from '../config/currency';

const DEFAULT_COMPANY_INFO = {
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    logo: null,
};

function CompanyInfoPage() {
    const [companyInfo, setCompanyInfo] = useState(DEFAULT_COMPANY_INFO);
    const [logoPreview, setLogoPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [baseCurrency, setBaseCurrency] = useState('USD');

    const [currencies, setCurrencies] = useState([]);
    const [currencyForm, setCurrencyForm] = useState({ code: '', name: '', exchange_rate: '1' });
    const [editingCurrencyId, setEditingCurrencyId] = useState(null);
    const [editCurrencyForm, setEditCurrencyForm] = useState({ name: '', exchange_rate: '' });
    const [currencyMessage, setCurrencyMessage] = useState('');
    const [currencyError, setCurrencyError] = useState('');
    const [currencySaving, setCurrencySaving] = useState(false);

    const parseError = (err, fallbackMessage) => {
        if (err?.response?.data) {
            const data = err.response.data;
            if (typeof data === 'string') {
                return data;
            }
            if (data.detail) {
                return data.detail;
            }
            const firstKey = Object.keys(data)[0];
            if (firstKey) {
                const value = data[firstKey];
                if (Array.isArray(value) && value.length) {
                    return value[0];
                }
                if (typeof value === 'string') {
                    return value;
                }
            }
        }
        return fallbackMessage;
    };

    const fetchCurrencies = async () => {
        try {
            const res = await axiosInstance.get('/currencies/');
            if (Array.isArray(res.data)) {
                setCurrencies(res.data);
            }
            setCurrencyError('');
        } catch (err) {
            console.error('Failed to load currencies.', err);
            setCurrencyError('Failed to load currency list. Configure currencies below.');
        }
    };

    const refreshCurrencies = async () => {
        await fetchCurrencies();
        clearCachedCurrencies();
        await loadCurrencyOptions();
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [infoRes, settingsRes] = await Promise.all([
                    axiosInstance.get('/company-info/'),
                    axiosInstance.get('/settings/'),
                ]);

                if (infoRes.data) {
                    setCompanyInfo(infoRes.data);
                    if (infoRes.data.logo) {
                        setLogoPreview(infoRes.data.logo);
                    }
                }

                if (settingsRes.data?.base_currency) {
                    setBaseCurrency(settingsRes.data.base_currency.toUpperCase());
                }
            } catch (err) {
                setError('Failed to load company information. Please try again later.');
                console.error(err);
            }

            await fetchCurrencies();
            setLoading(false);
        };

        fetchData();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCompanyInfo((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setCompanyInfo((prev) => ({ ...prev, logo: file }));
        if (file) {
            setLogoPreview(URL.createObjectURL(file));
        } else {
            setLogoPreview(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setCurrencyError('');
        setCurrencyMessage('');
        setSaving(true);

        const formData = new FormData();
        formData.append('name', companyInfo.name);
        formData.append('address', companyInfo.address || '');
        formData.append('phone', companyInfo.phone || '');
        formData.append('email', companyInfo.email || '');
        formData.append('website', companyInfo.website || '');

        if (companyInfo.logo && typeof companyInfo.logo !== 'string') {
            formData.append('logo', companyInfo.logo);
        }

        try {
            const res = await axiosInstance.post('/company-info/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            await axiosInstance.post('/settings/', { base_currency: baseCurrency });

            setCompanyInfo(res.data);
            if (res.data.logo) {
                setLogoPreview(res.data.logo);
            }
            setSuccess('Company information updated successfully!');
            setTimeout(() => setSuccess(''), 3000);

            await refreshCurrencies();
            await loadBaseCurrency();
        } catch (err) {
            const message = parseError(err, 'Failed to update company information.');
            setError(message);
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleCurrencyFormChange = (e) => {
        const { name, value } = e.target;
        setCurrencyForm((prev) => ({
            ...prev,
            [name]: name === 'code' ? value.toUpperCase() : value,
        }));
    };

    const handleAddCurrency = async (e) => {
        e.preventDefault();
        setCurrencyError('');
        setCurrencyMessage('');
        setCurrencySaving(true);

        const code = (currencyForm.code || '').trim().toUpperCase();
        const name = (currencyForm.name || '').trim();
        const rateValue = currencyForm.exchange_rate;

        if (code.length !== 3 || !/^[A-Z]{3}$/.test(code)) {
            setCurrencyError('Currency code must contain exactly three letters.');
            setCurrencySaving(false);
            return;
        }
        if (!rateValue || Number(rateValue) <= 0) {
            setCurrencyError('Exchange rate must be greater than zero.');
            setCurrencySaving(false);
            return;
        }

        try {
            await axiosInstance.post('/currencies/', {
                code,
                name,
                exchange_rate: rateValue,
            });
            setCurrencyForm({ code: '', name: '', exchange_rate: '1' });
            setCurrencyMessage('Currency added successfully.');
            setTimeout(() => setCurrencyMessage(''), 3000);
            await refreshCurrencies();
        } catch (err) {
            setCurrencyError(parseError(err, 'Failed to add currency.'));
            console.error(err);
        } finally {
            setCurrencySaving(false);
        }
    };

    const startEditingCurrency = (currency) => {
        setCurrencyError('');
        setCurrencyMessage('');
        setEditingCurrencyId(currency.id);
        setEditCurrencyForm({
            name: currency.name || currency.code,
            exchange_rate: currency.is_base_currency ? '1' : String(currency.exchange_rate ?? '1'),
        });
    };

    const handleEditCurrencyChange = (e) => {
        const { name, value } = e.target;
        setEditCurrencyForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleCancelEdit = () => {
        setEditingCurrencyId(null);
        setEditCurrencyForm({ name: '', exchange_rate: '' });
    };

    const handleSaveCurrency = async () => {
        if (!editingCurrencyId) {
            return;
        }
        const currency = currencies.find((item) => item.id === editingCurrencyId);
        if (!currency) {
            setCurrencyError('Unable to locate the selected currency.');
            return;
        }

        setCurrencyError('');
        setCurrencyMessage('');
        setCurrencySaving(true);

        const payload = {
            name: (editCurrencyForm.name || '').trim() || currency.code,
        };

        if (!currency.is_base_currency) {
            if (!editCurrencyForm.exchange_rate || Number(editCurrencyForm.exchange_rate) <= 0) {
                setCurrencyError('Exchange rate must be greater than zero.');
                setCurrencySaving(false);
                return;
            }
            payload.exchange_rate = editCurrencyForm.exchange_rate;
        }

        try {
            await axiosInstance.patch(`/currencies/${editingCurrencyId}/`, payload);
            setCurrencyMessage('Currency updated successfully.');
            setTimeout(() => setCurrencyMessage(''), 3000);
            setEditingCurrencyId(null);
            setEditCurrencyForm({ name: '', exchange_rate: '' });
            await refreshCurrencies();
        } catch (err) {
            setCurrencyError(parseError(err, 'Failed to update currency.'));
            console.error(err);
        } finally {
            setCurrencySaving(false);
        }
    };

    const handleDeleteCurrency = async (currency) => {
        if (!window.confirm(`Remove ${currency.name || currency.code}?`)) {
            return;
        }
        setCurrencyError('');
        setCurrencyMessage('');
        try {
            await axiosInstance.delete(`/currencies/${currency.id}/`);
            setCurrencyMessage('Currency removed successfully.');
            setTimeout(() => setCurrencyMessage(''), 3000);
            await refreshCurrencies();
        } catch (err) {
            setCurrencyError(parseError(err, 'Failed to delete currency.'));
            console.error(err);
        }
    };

    if (loading) {
        return <div className="text-center"><Spinner animation="border" /></div>;
    }

    const baseCurrencyOptions = currencies.length
        ? currencies
        : [{ code: baseCurrency || 'USD', name: baseCurrency || 'USD', id: 'base', exchange_rate: '1', is_base_currency: true }];

    const renderExchangeRate = (currency) => {
        if (currency.is_base_currency) {
            return '1.000000';
        }
        const numeric = Number(currency.exchange_rate);
        return Number.isNaN(numeric) ? currency.exchange_rate : numeric.toFixed(6);
    };

    return (
        <div className="d-flex flex-column gap-4">
            <Card>
                <Card.Header><h4>Company Information</h4></Card.Header>
                <Card.Body>
                    {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}
                    {success && <Alert variant="success">{success}</Alert>}
                    <Form onSubmit={handleSubmit}>
                        <Row>
                            <Col md={8}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Company Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="name"
                                        value={companyInfo.name}
                                        onChange={handleChange}
                                        required
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Address</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={3}
                                        name="address"
                                        value={companyInfo.address || ''}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                                <Row>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Phone</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="phone"
                                                value={companyInfo.phone || ''}
                                                onChange={handleChange}
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Email</Form.Label>
                                            <Form.Control
                                                type="email"
                                                name="email"
                                                value={companyInfo.email || ''}
                                                onChange={handleChange}
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Form.Group className="mb-3">
                                    <Form.Label>Base Currency</Form.Label>
                                    <Form.Select value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)}>
                                        {baseCurrencyOptions.map((currency) => (
                                            <option key={currency.code} value={currency.code}>
                                                {currency.name ? `${currency.name} (${currency.code})` : currency.code}
                                            </option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3">
                                    <Form.Label>Website</Form.Label>
                                    <Form.Control
                                        type="url"
                                        name="website"
                                        value={companyInfo.website || ''}
                                        onChange={handleChange}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Company Logo</Form.Label>
                                    {logoPreview && (
                                        <div className="mb-2 text-center">
                                            <img src={logoPreview} alt="Logo Preview" className="img-thumbnail" style={{ maxWidth: '200px', maxHeight: '200px' }} />
                                        </div>
                                    )}
                                    <Form.Control
                                        type="file"
                                        name="logo"
                                        onChange={handleFileChange}
                                        accept="image/png, image/jpeg"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                        <hr />
                        <Button variant="primary" type="submit" disabled={saving}>
                            {saving ? <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Saving...</> : 'Save Changes'}
                        </Button>
                    </Form>
                </Card.Body>
            </Card>

            <Card>
                <Card.Header><h4>Currency Settings</h4></Card.Header>
                <Card.Body>
                    {currencyError && <Alert variant="danger" onClose={() => setCurrencyError('')} dismissible>{currencyError}</Alert>}
                    {currencyMessage && <Alert variant="success" onClose={() => setCurrencyMessage('')} dismissible>{currencyMessage}</Alert>}

                    <div className="table-responsive">
                        <Table bordered hover size="sm" className="align-middle">
                            <thead>
                                <tr>
                                    <th style={{ width: '10%' }}>Code</th>
                                    <th style={{ width: '30%' }}>Name</th>
                                    <th style={{ width: '20%' }}>Exchange Rate</th>
                                    <th style={{ width: '10%' }}>Type</th>
                                    <th style={{ width: '30%' }} className="text-end">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currencies.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center text-muted">No currencies configured yet.</td>
                                    </tr>
                                )}
                                {currencies.map((currency) => {
                                    const isEditing = editingCurrencyId === currency.id;
                                    return (
                                        <tr key={currency.id}>
                                            <td className="text-uppercase fw-semibold">{currency.code}</td>
                                            <td>
                                                {isEditing ? (
                                                    <Form.Control
                                                        name="name"
                                                        value={editCurrencyForm.name}
                                                        onChange={handleEditCurrencyChange}
                                                    />
                                                ) : (
                                                    currency.name || currency.code
                                                )}
                                            </td>
                                            <td>
                                                {currency.is_base_currency ? (
                                                    <span className="text-muted">1.000000</span>
                                                ) : isEditing ? (
                                                    <Form.Control
                                                        type="number"
                                                        step="0.000001"
                                                        name="exchange_rate"
                                                        value={editCurrencyForm.exchange_rate}
                                                        onChange={handleEditCurrencyChange}
                                                    />
                                                ) : (
                                                    renderExchangeRate(currency)
                                                )}
                                            </td>
                                            <td>
                                                {currency.is_base_currency ? <span className="badge bg-primary">Base</span> : <span className="badge bg-secondary">Additional</span>}
                                            </td>
                                            <td className="text-end">
                                                {isEditing ? (
                                                    <>
                                                        <Button
                                                            variant="success"
                                                            size="sm"
                                                            className="me-2"
                                                            onClick={handleSaveCurrency}
                                                            disabled={currencySaving}
                                                        >
                                                            Save
                                                        </Button>
                                                        <Button
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={handleCancelEdit}
                                                            disabled={currencySaving}
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            variant="outline-primary"
                                                            size="sm"
                                                            className="me-2"
                                                            onClick={() => startEditingCurrency(currency)}
                                                        >
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            variant="outline-danger"
                                                            size="sm"
                                                            onClick={() => handleDeleteCurrency(currency)}
                                                            disabled={currency.is_base_currency}
                                                        >
                                                            Delete
                                                        </Button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                    </div>

                    <Form onSubmit={handleAddCurrency} className="mt-4">
                        <Row className="g-3 align-items-end">
                            <Col md={3}>
                                <Form.Label>Code</Form.Label>
                                <Form.Control
                                    name="code"
                                    value={currencyForm.code}
                                    onChange={handleCurrencyFormChange}
                                    placeholder="e.g. USD"
                                    maxLength={3}
                                    required
                                />
                            </Col>
                            <Col md={4}>
                                <Form.Label>Name</Form.Label>
                                <Form.Control
                                    name="name"
                                    value={currencyForm.name}
                                    onChange={handleCurrencyFormChange}
                                    placeholder="Currency name"
                                    required
                                />
                            </Col>
                            <Col md={3}>
                                <Form.Label>Exchange Rate</Form.Label>
                                <Form.Control
                                    type="number"
                                    step="0.000001"
                                    name="exchange_rate"
                                    value={currencyForm.exchange_rate}
                                    onChange={handleCurrencyFormChange}
                                    required
                                />
                                <Form.Text className="text-muted">Relative to the base currency.</Form.Text>
                            </Col>
                            <Col md={2}>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    className="w-100"
                                    disabled={currencySaving}
                                >
                                    {currencySaving ? 'Saving...' : 'Add Currency'}
                                </Button>
                            </Col>
                        </Row>
                    </Form>
                </Card.Body>
            </Card>
        </div>
    );
}

export default CompanyInfoPage;
