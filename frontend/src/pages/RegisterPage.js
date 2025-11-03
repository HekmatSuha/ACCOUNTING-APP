import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Alert, Spinner } from 'react-bootstrap';
import { useTranslation, Trans } from 'react-i18next';
import './LoginPage.css';

const API_URL = 'http://127.0.0.1:8000/api';

function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError(
        t('register.errors.passwordMismatch', {
          defaultValue: 'Passwords do not match.',
        })
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post(`${API_URL}/auth/register/`, {
        company_name: companyName,
        email,
        password,
        confirm_password: confirmPassword,
        first_name: firstName,
        last_name: lastName,
      });

      const detail = response?.data?.detail;
      setSuccess(
        detail ||
          t('register.success', {
            defaultValue: 'Account created successfully. You can now sign in.',
          })
      );

      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      const data = err?.response?.data;
      let message = '';

      if (typeof data === 'string') {
        message = data;
      } else if (Array.isArray(data)) {
        message = data[0];
      } else if (data && typeof data === 'object') {
        const firstKey = Object.keys(data)[0];
        const value = data[firstKey];
        if (Array.isArray(value)) {
          message = value[0];
        } else if (typeof value === 'string') {
          message = value;
        }
      }

      setError(
        message ||
          t('register.error', {
            defaultValue: 'Registration failed. Please review your details and try again.',
          })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <aside className="auth-hero" aria-hidden="true">
          <div className="auth-hero-content">
            <span className="auth-hero-kicker">{t('register.hero.kicker')}</span>
            <h1>{t('register.hero.title')}</h1>
            <p className="auth-hero-text">{t('register.hero.text')}</p>
          </div>
        </aside>
        <div className="auth-form-side">
          <div className="auth-form-inner">
            <header className="auth-header">
              <h2 className="auth-title">{t('register.title')}</h2>
              <p className="text-muted mb-0">{t('register.subtitle')}</p>
            </header>
            {error && (
              <Alert variant="danger" className="auth-alert">
                {error}
              </Alert>
            )}
            {success && (
              <Alert variant="success" className="auth-alert">
                {success}
              </Alert>
            )}
            <Form onSubmit={handleSubmit} className="auth-form">
              <Form.Group controlId="companyName" className="mb-3">
                <Form.Label>{t('register.fields.companyName')}</Form.Label>
                <Form.Control
                  type="text"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder={t('register.fields.companyNamePlaceholder')}
                  autoComplete="organization"
                  required
                />
              </Form.Group>
              <Form.Group controlId="email" className="mb-3">
                <Form.Label>{t('register.fields.email')}</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t('register.fields.emailPlaceholder')}
                  autoComplete="email"
                  required
                />
              </Form.Group>
              <Form.Group controlId="firstName" className="mb-3">
                <Form.Label>{t('register.fields.firstName')}</Form.Label>
                <Form.Control
                  type="text"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder={t('register.fields.firstNamePlaceholder')}
                  autoComplete="given-name"
                />
              </Form.Group>
              <Form.Group controlId="lastName" className="mb-3">
                <Form.Label>{t('register.fields.lastName')}</Form.Label>
                <Form.Control
                  type="text"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder={t('register.fields.lastNamePlaceholder')}
                  autoComplete="family-name"
                />
              </Form.Group>
              <Form.Group controlId="password" className="mb-3">
                <Form.Label>{t('register.fields.password')}</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('register.fields.passwordPlaceholder')}
                  autoComplete="new-password"
                  required
                />
                <p className="text-microcopy auth-microcopy">{t('register.passwordHint')}</p>
              </Form.Group>
              <Form.Group controlId="confirmPassword" className="mb-4">
                <Form.Label>{t('register.fields.confirmPassword')}</Form.Label>
                <Form.Control
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder={t('register.fields.confirmPasswordPlaceholder')}
                  autoComplete="new-password"
                  required
                />
              </Form.Group>
              <button type="submit" className="btn btn-primary w-100" disabled={isSubmitting}>
                {isSubmitting && (
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                    className="me-2"
                  />
                )}
                {t('register.submit')}
              </button>
            </Form>
          </div>
          <footer className="auth-footer">
            <span className="text-microcopy">
              <Trans i18nKey="register.footer" components={{ loginLink: <Link to="/login" /> }} />
            </span>
          </footer>
        </div>
      </section>
    </main>
  );
}

export default RegisterPage;
