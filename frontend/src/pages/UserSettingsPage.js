// frontend/src/pages/UserSettingsPage.js

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Stack } from 'react-bootstrap';
import { CheckCircleFill, ExclamationTriangleFill } from 'react-bootstrap-icons';
import axiosInstance from '../utils/axiosInstance';
import '../styles/UserSettingsPage.css';

const DEFAULT_PROFILE = {
    username: '',
    first_name: '',
    last_name: '',
    email: '',
};

const DEFAULT_PREFERENCES = {
    theme: 'light',
    emailNotifications: true,
    smsNotifications: false,
    dashboardDensity: 'comfortable',
};

function UserSettingsPage() {
    const [profileForm, setProfileForm] = useState(DEFAULT_PROFILE);
    const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
    const [passwordForm, setPasswordForm] = useState({
        current_password: '',
        new_password: '',
        confirm_password: '',
    });

    const [loading, setLoading] = useState(true);
    const [profileSaving, setProfileSaving] = useState(false);
    const [passwordSaving, setPasswordSaving] = useState(false);

    const [profileMessage, setProfileMessage] = useState(null);
    const [profileError, setProfileError] = useState(null);
    const [passwordMessage, setPasswordMessage] = useState(null);
    const [passwordError, setPasswordError] = useState(null);
    const [preferenceMessage, setPreferenceMessage] = useState(null);

    const preferenceStorageKey = useMemo(() => {
        const username = localStorage.getItem('username') || 'default';
        return `user-preferences:${username}`;
    }, []);

    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                const response = await axiosInstance.get('/user/profile/');
                if (isMounted) {
                    setProfileForm((prev) => ({ ...prev, ...response.data }));
                }
            } catch (error) {
                if (isMounted) {
                    setProfileError('Unable to load your profile right now.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        const loadPreferences = () => {
            try {
                const stored = localStorage.getItem(preferenceStorageKey);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    setPreferences((prev) => ({ ...prev, ...parsed }));
                }
            } catch (error) {
                console.error('Failed to parse stored preferences', error);
            }
        };

        fetchData();
        loadPreferences();

        return () => {
            isMounted = false;
        };
    }, [preferenceStorageKey]);

    useEffect(() => {
        localStorage.setItem(preferenceStorageKey, JSON.stringify(preferences));
    }, [preferences, preferenceStorageKey]);

    useEffect(() => {
        if (!preferenceMessage) {
            return undefined;
        }
        const timeout = setTimeout(() => setPreferenceMessage(null), 2500);
        return () => clearTimeout(timeout);
    }, [preferenceMessage]);

    useEffect(() => {
        if (!profileMessage) {
            return undefined;
        }
        const timeout = setTimeout(() => setProfileMessage(null), 2500);
        return () => clearTimeout(timeout);
    }, [profileMessage]);

    useEffect(() => {
        if (!passwordMessage) {
            return undefined;
        }
        const timeout = setTimeout(() => setPasswordMessage(null), 2500);
        return () => clearTimeout(timeout);
    }, [passwordMessage]);

    const handleProfileChange = (event) => {
        const { name, value } = event.target;
        setProfileForm((prev) => ({ ...prev, [name]: value }));
    };

    const handlePasswordChange = (event) => {
        const { name, value } = event.target;
        setPasswordForm((prev) => ({ ...prev, [name]: value }));
    };

    const handlePreferenceChange = (name, value) => {
        setPreferences((prev) => ({ ...prev, [name]: value }));
        setPreferenceMessage('Preferences saved.');
    };

    const parseError = useCallback((err, fallback) => {
        if (err?.response?.data) {
            const data = err.response.data;
            if (typeof data === 'string') {
                return data;
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
        return fallback;
    }, []);

    const handleProfileSubmit = async (event) => {
        event.preventDefault();
        setProfileError(null);
        setProfileMessage(null);
        setProfileSaving(true);

        try {
            const payload = {
                first_name: profileForm.first_name,
                last_name: profileForm.last_name,
                email: profileForm.email,
            };
            const response = await axiosInstance.patch('/user/profile/', payload);
            setProfileForm((prev) => ({ ...prev, ...response.data }));
            setProfileMessage('Profile updated successfully.');
        } catch (error) {
            setProfileError(parseError(error, 'Failed to update your profile.'));
        } finally {
            setProfileSaving(false);
        }
    };

    const handlePasswordSubmit = async (event) => {
        event.preventDefault();
        setPasswordError(null);
        setPasswordMessage(null);
        setPasswordSaving(true);

        if (passwordForm.new_password !== passwordForm.confirm_password) {
            setPasswordError('New password and confirmation must match.');
            setPasswordSaving(false);
            return;
        }

        try {
            await axiosInstance.post('/user/change-password/', passwordForm);
            setPasswordMessage('Password updated successfully.');
            setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
        } catch (error) {
            setPasswordError(parseError(error, 'Unable to update your password.'));
        } finally {
            setPasswordSaving(false);
        }
    };

    const passwordStrength = useMemo(() => {
        const password = passwordForm.new_password || '';
        let score = 0;
        if (password.length >= 8) score += 1;
        if (/[A-Z]/.test(password)) score += 1;
        if (/[a-z]/.test(password)) score += 1;
        if (/\d/.test(password)) score += 1;
        if (/[^A-Za-z0-9]/.test(password)) score += 1;

        if (!password) {
            return { label: 'Enter a password', variant: 'secondary' };
        }
        if (score <= 2) {
            return { label: 'Weak', variant: 'danger' };
        }
        if (score === 3 || score === 4) {
            return { label: 'Good', variant: 'warning' };
        }
        return { label: 'Strong', variant: 'success' };
    }, [passwordForm.new_password]);

    if (loading) {
        return (
            <div className="user-settings-page d-flex justify-content-center align-items-center">
                <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading...</span>
                </Spinner>
            </div>
        );
    }

    return (
        <div className="user-settings-page">
            <div className="page-header">
                <div>
                    <h2 className="page-title">User Settings</h2>
                    <p className="text-muted mb-0">Manage your profile, security and application preferences.</p>
                </div>
                <Badge bg="primary" pill>
                    {profileForm.username ? `Signed in as ${profileForm.username}` : 'Signed in'}
                </Badge>
            </div>

            <Row className="g-4">
                <Col lg={6}>
                    <Card className="settings-card h-100">
                        <Card.Header>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h5 className="mb-1">Profile information</h5>
                                    <small className="text-muted">Keep your contact details up to date.</small>
                                </div>
                                <CheckCircleFill className="text-success d-none d-lg-block" />
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {profileError && (
                                <Alert variant="danger" onClose={() => setProfileError(null)} dismissible>
                                    {profileError}
                                </Alert>
                            )}
                            {profileMessage && (
                                <Alert variant="success" onClose={() => setProfileMessage(null)} dismissible>
                                    {profileMessage}
                                </Alert>
                            )}
                            <Form onSubmit={handleProfileSubmit} className="settings-form">
                                <Row className="g-3">
                                    <Col md={6}>
                                        <Form.Group controlId="profileFirstName">
                                            <Form.Label>First name</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="first_name"
                                                value={profileForm.first_name || ''}
                                                onChange={handleProfileChange}
                                                placeholder="Jane"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group controlId="profileLastName">
                                            <Form.Label>Last name</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="last_name"
                                                value={profileForm.last_name || ''}
                                                onChange={handleProfileChange}
                                                placeholder="Doe"
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Row className="g-3">
                                    <Col md={6}>
                                        <Form.Group controlId="profileEmail">
                                            <Form.Label>Email address</Form.Label>
                                            <Form.Control
                                                type="email"
                                                name="email"
                                                value={profileForm.email || ''}
                                                onChange={handleProfileChange}
                                                placeholder="you@example.com"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group controlId="profileUsername">
                                            <Form.Label>Username</Form.Label>
                                            <Form.Control type="text" value={profileForm.username || ''} disabled readOnly />
                                            <Form.Text className="text-muted">
                                                Your username is used to sign in and cannot be changed.
                                            </Form.Text>
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <div className="d-flex justify-content-end mt-4">
                                    <Button type="submit" variant="primary" disabled={profileSaving}>
                                        {profileSaving ? (
                                            <>
                                                <Spinner size="sm" animation="border" className="me-2" />
                                                Saving
                                            </>
                                        ) : (
                                            'Save changes'
                                        )}
                                    </Button>
                                </div>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>
                <Col lg={6}>
                    <Card className="settings-card h-100">
                        <Card.Header>
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h5 className="mb-1">Password &amp; security</h5>
                                    <small className="text-muted">Choose a strong password to keep your account secure.</small>
                                </div>
                                <ExclamationTriangleFill className="text-warning d-none d-lg-block" />
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {passwordError && (
                                <Alert variant="danger" onClose={() => setPasswordError(null)} dismissible>
                                    {passwordError}
                                </Alert>
                            )}
                            {passwordMessage && (
                                <Alert variant="success" onClose={() => setPasswordMessage(null)} dismissible>
                                    {passwordMessage}
                                </Alert>
                            )}

                            <Form onSubmit={handlePasswordSubmit} className="settings-form">
                                <Form.Group controlId="currentPassword" className="mb-3">
                                    <Form.Label>Current password</Form.Label>
                                    <Form.Control
                                        type="password"
                                        name="current_password"
                                        value={passwordForm.current_password}
                                        onChange={handlePasswordChange}
                                        placeholder="••••••••"
                                        required
                                    />
                                </Form.Group>
                                <Form.Group controlId="newPassword" className="mb-3">
                                    <Form.Label>New password</Form.Label>
                                    <Form.Control
                                        type="password"
                                        name="new_password"
                                        value={passwordForm.new_password}
                                        onChange={handlePasswordChange}
                                        placeholder="At least 8 characters"
                                        required
                                    />
                                    <div className="password-strength mt-2">
                                        <Badge bg={passwordStrength.variant}>{passwordStrength.label}</Badge>
                                        <small className="text-muted ms-2">
                                            Use a mix of letters, numbers and symbols for a stronger password.
                                        </small>
                                    </div>
                                </Form.Group>
                                <Form.Group controlId="confirmPassword" className="mb-4">
                                    <Form.Label>Confirm new password</Form.Label>
                                    <Form.Control
                                        type="password"
                                        name="confirm_password"
                                        value={passwordForm.confirm_password}
                                        onChange={handlePasswordChange}
                                        placeholder="Repeat new password"
                                        required
                                    />
                                </Form.Group>
                                <div className="d-flex justify-content-end">
                                    <Button type="submit" variant="outline-primary" disabled={passwordSaving}>
                                        {passwordSaving ? (
                                            <>
                                                <Spinner size="sm" animation="border" className="me-2" />
                                                Updating
                                            </>
                                        ) : (
                                            'Update password'
                                        )}
                                    </Button>
                                </div>
                            </Form>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Card className="settings-card mt-4">
                <Card.Header>
                    <div className="d-flex justify-content-between align-items-center">
                        <div>
                            <h5 className="mb-1">Preferences</h5>
                            <small className="text-muted">Personalize how the application looks and notifies you.</small>
                        </div>
                        {preferenceMessage && <Badge bg="success">{preferenceMessage}</Badge>}
                    </div>
                </Card.Header>
                <Card.Body>
                    <Row className="g-4">
                        <Col md={4}>
                            <h6 className="text-uppercase text-muted">Theme</h6>
                            <Stack gap={2}>
                                <Form.Check
                                    type="radio"
                                    id="theme-light"
                                    name="theme"
                                    label="Light"
                                    checked={preferences.theme === 'light'}
                                    onChange={() => handlePreferenceChange('theme', 'light')}
                                />
                                <Form.Check
                                    type="radio"
                                    id="theme-dark"
                                    name="theme"
                                    label="Dark"
                                    checked={preferences.theme === 'dark'}
                                    onChange={() => handlePreferenceChange('theme', 'dark')}
                                />
                            </Stack>
                        </Col>
                        <Col md={4}>
                            <h6 className="text-uppercase text-muted">Notifications</h6>
                            <Stack gap={2}>
                                <Form.Check
                                    type="switch"
                                    id="email-notifications"
                                    label="Email notifications"
                                    checked={preferences.emailNotifications}
                                    onChange={(event) => handlePreferenceChange('emailNotifications', event.target.checked)}
                                />
                                <Form.Check
                                    type="switch"
                                    id="sms-notifications"
                                    label="SMS notifications"
                                    checked={preferences.smsNotifications}
                                    onChange={(event) => handlePreferenceChange('smsNotifications', event.target.checked)}
                                />
                            </Stack>
                        </Col>
                        <Col md={4}>
                            <h6 className="text-uppercase text-muted">Dashboard density</h6>
                            <Form.Select
                                value={preferences.dashboardDensity}
                                onChange={(event) => handlePreferenceChange('dashboardDensity', event.target.value)}
                            >
                                <option value="comfortable">Comfortable</option>
                                <option value="cozy">Cozy</option>
                                <option value="compact">Compact</option>
                            </Form.Select>
                            <Form.Text className="text-muted d-block mt-2">
                                Changes apply instantly and are stored in your browser.
                            </Form.Text>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>
        </div>
    );
}

export default UserSettingsPage;
