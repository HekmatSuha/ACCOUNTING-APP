import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { Container, Form, Button, Card, Alert, Spinner } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';

const API_URL = 'http://127.0.0.1:8000/api';

function InviteAcceptPage() {
    const { token } = useParams();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [invite, setInvite] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        let isMounted = true;
        async function fetchInvitation() {
            try {
                const response = await axios.get(`${API_URL}/auth/invitations/${token}/`);
                if (!isMounted) return;
                setInvite(response.data);
                if (response.data?.email) {
                    setUsername(response.data.email.split('@')[0]);
                }
            } catch (err) {
                if (!isMounted) return;
                setError(t('invite.errors.invalid', { defaultValue: 'This invitation is invalid or has expired.' }));
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }
        fetchInvitation();
        return () => {
            isMounted = false;
        };
    }, [token, t]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        try {
            await axios.post(`${API_URL}/auth/invitations/${token}/accept/`, {
                username,
                password,
                confirm_password: confirmPassword,
            });
            setSuccess(true);
            setTimeout(() => navigate('/login'), 1200);
        } catch (err) {
            const message = err?.response?.data;
            const detail = typeof message === 'string' ? message : message?.detail;
            setError(
                detail ||
                    t('invite.errors.failed', {
                        defaultValue: 'We could not complete your invitation. Please check your details and try again.',
                    })
            );
        }
    };

    const title = t('invite.title', { defaultValue: 'Accept your invitation' });
    const submitLabel = t('invite.submit', { defaultValue: 'Activate account' });

    return (
        <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
            <Card style={{ width: '100%', maxWidth: '420px' }}>
                <Card.Body>
                    <h2 className="text-center mb-3">{title}</h2>
                    {loading && (
                        <div className="text-center py-4">
                            <Spinner animation="border" role="status" />
                        </div>
                    )}
                    {!loading && invite && (
                        <>
                            <p className="text-muted text-center">
                                {t('invite.subtitle', {
                                    defaultValue: 'You have been invited to join {{account}} as {{role}}',
                                    account: invite.account?.name || t('invite.accountFallback', { defaultValue: 'an account' }),
                                    role: invite.is_admin
                                        ? t('invite.roles.admin', { defaultValue: 'an administrator' })
                                        : invite.is_billing_manager
                                        ? t('invite.roles.billing', { defaultValue: 'a billing manager' })
                                        : t('invite.roles.member', { defaultValue: 'a team member' }),
                                })}
                            </p>
                            {error && <Alert variant="danger">{error}</Alert>}
                            {success && (
                                <Alert variant="success">
                                    {t('invite.success', { defaultValue: 'Your account is ready! Redirecting to the login screen…' })}
                                </Alert>
                            )}
                            <Form onSubmit={handleSubmit}>
                                <Form.Group controlId="username" className="mb-3">
                                    <Form.Label>{t('invite.fields.username', { defaultValue: 'Username' })}</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={username}
                                        onChange={(event) => setUsername(event.target.value)}
                                        required
                                    />
                                </Form.Group>
                                <Form.Group controlId="password" className="mb-3">
                                    <Form.Label>{t('invite.fields.password', { defaultValue: 'Password' })}</Form.Label>
                                    <Form.Control
                                        type="password"
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        required
                                    />
                                </Form.Group>
                                <Form.Group controlId="confirmPassword" className="mb-4">
                                    <Form.Label>{t('invite.fields.confirmPassword', { defaultValue: 'Confirm password' })}</Form.Label>
                                    <Form.Control
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                        required
                                    />
                                </Form.Group>
                                <Button className="w-100" type="submit" disabled={success}>
                                    {submitLabel}
                                </Button>
                            </Form>
                        </>
                    )}
                    {!loading && !invite && !success && (
                        <Alert variant="danger" className="mt-3">
                            {error || t('invite.errors.invalid', { defaultValue: 'This invitation is invalid or has expired.' })}
                        </Alert>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
}

export default InviteAcceptPage;
