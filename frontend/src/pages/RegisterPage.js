import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Container, Form, Button, Card, Alert } from 'react-bootstrap';
import { useTranslation, Trans } from 'react-i18next';

// 1. Centralize the API URL
const API_URL = 'http://127.0.0.1:8000/api';

function RegisterPage() {
    const { t } = useTranslation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [hasError, setHasError] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setHasError(false);
        try {
            // 2. Use the API_URL constant for the request
            await axios.post(`${API_URL}/register/`, { username, password });
            navigate('/login');
        } catch (err) {
            setHasError(true);
            console.error('Registration failed:', err);
        }
    };

    return (
        <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
            <Card style={{ width: '100%', maxWidth: '400px' }}>
                <Card.Body>
                    <h2 className="text-center mb-4">{t('register.title')}</h2>
                    {hasError && <Alert variant="danger">{t('register.error')}</Alert>}
                    <Form onSubmit={handleSubmit}>
                        <Form.Group id="username" className="mb-3">
                            <Form.Label>{t('register.fields.username')}</Form.Label>
                            <Form.Control type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
                        </Form.Group>
                        <Form.Group id="password" className="mb-3">
                            <Form.Label>{t('register.fields.password')}</Form.Label>
                            <Form.Control type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                        </Form.Group>
                        <Button className="w-100" type="submit">{t('register.submit')}</Button>
                    </Form>
                </Card.Body>
                <Card.Footer className="text-muted text-center">
                    <Trans i18nKey="register.footer" components={{ loginLink: <Link to="/login" /> }} />
                </Card.Footer>
            </Card>
        </Container>
    );
}

export default RegisterPage;
