// frontend/src/pages/CompanyInfoPage.js

import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { Form, Button, Card, Alert, Spinner, Col, Row } from 'react-bootstrap';

function CompanyInfoPage() {
    const [companyInfo, setCompanyInfo] = useState({
        name: '',
        address: '',
        phone: '',
        email: '',
        website: '',
        logo: null
    });
    const [logoPreview, setLogoPreview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [baseCurrency, setBaseCurrency] = useState('USD');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [infoRes, settingsRes] = await Promise.all([
                    axiosInstance.get('/company-info/'),
                    axiosInstance.get('/settings/')
                ]);

                if (infoRes.data) {
                    setCompanyInfo(infoRes.data);
                    if (infoRes.data.logo) {
                        setLogoPreview(infoRes.data.logo);
                    }
                }

                if (settingsRes.data) {
                    setBaseCurrency(settingsRes.data.base_currency);
                }
            } catch (err) {
                setError('Failed to load company information. Please try again later.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCompanyInfo({ ...companyInfo, [name]: value });
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        // When a new file is selected, update the state
        // The actual file object will be sent, not just the name
        setCompanyInfo({ ...companyInfo, logo: file });

        // Update the preview
        if (file) {
            setLogoPreview(URL.createObjectURL(file));
        } else {
            // If the file is cleared, what should happen?
            // Maybe we keep the old logo preview if there was one.
            // For simplicity, we'll clear it. If they want to keep the old one, they can just not select a file.
            setLogoPreview(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setSaving(true);

        const formData = new FormData();

        // Append all fields to formData
        formData.append('name', companyInfo.name);
        formData.append('address', companyInfo.address || '');
        formData.append('phone', companyInfo.phone || '');
        formData.append('email', companyInfo.email || '');
        formData.append('website', companyInfo.website || '');

        // Handle the logo. Only append if it's a new file (i.e., a File object).
        // If `companyInfo.logo` is a string, it's the URL of the existing logo, so we don't upload it again.
        if (companyInfo.logo && typeof companyInfo.logo !== 'string') {
            formData.append('logo', companyInfo.logo);
        }

        try {
            const res = await axiosInstance.post('/company-info/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            await axiosInstance.post('/settings/', { base_currency: baseCurrency });

            setCompanyInfo(res.data);
            if (res.data.logo) {
                setLogoPreview(res.data.logo);
            }
            setSuccess('Company information updated successfully!');
            // Clear success message after 3 seconds
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            const errorMsg = err.response?.data?.detail || 'Failed to update company information.';
            setError(errorMsg);
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="text-center"><Spinner animation="border" /></div>;
    }

    return (
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
                                    <option value="USD">United States Dollar (USD)</option>
                                    <option value="EUR">Euro (EUR)</option>
                                    <option value="KZT">Kazakhstani Tenge (KZT)</option>
                                    <option value="TRY">Turkish Lira (TRY)</option>
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
    );
}

export default CompanyInfoPage;
