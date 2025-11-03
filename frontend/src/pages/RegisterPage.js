import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Alert, Spinner } from 'react-bootstrap';
import { Eye, EyeSlash } from 'react-bootstrap-icons';
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
          email,
          defaultValue:
            'Account created successfully. You can now sign in using {{email}} as your username.',
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
    <main className="auth-layout register-layout">
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
            <Form onSubmit={handleSubmit} className="auth-form register-form">
              <div className="register-form-card">
                <div className="register-form-header">
                  <h3 className="register-form-title">
                    {t('register.sections.profile.title', {
                      defaultValue: 'Profile details',
                    })}
                  </h3>
                  <p className="register-form-description">
                    {t('register.sections.profile.description', {
                      defaultValue:
                        'Tell us about your business so we can personalise your workspace.',
                    })}
                  </p>
                </div>
                <Form.Group controlId="companyName" className="register-form-group">
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
                <div className="register-field-row">
                  <Form.Group controlId="firstName" className="register-form-group">
                    <Form.Label>{t('register.fields.firstName')}</Form.Label>
                    <Form.Control
                      type="text"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder={t('register.fields.firstNamePlaceholder')}
                      autoComplete="given-name"
                    />
                  </Form.Group>
                  <Form.Group controlId="lastName" className="register-form-group">
                    <Form.Label>{t('register.fields.lastName')}</Form.Label>
                    <Form.Control
                      type="text"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      placeholder={t('register.fields.lastNamePlaceholder')}
                      autoComplete="family-name"
                    />
                  </Form.Group>
                </div>
              </div>
              <div className="register-form-card">
                <div className="register-form-header">
                  <h3 className="register-form-title">
                    {t('register.sections.security.title', {
                      defaultValue: 'Sign-in credentials',
                    })}
                  </h3>
                  <p className="register-form-description">
                    {t('register.sections.security.description', {
                      defaultValue: 'Create the details you will use to access your account.',
                    })}
                  </p>
                </div>
                <Form.Group controlId="email" className="register-form-group">
                  <Form.Label>{t('register.fields.email')}</Form.Label>
                  <Form.Control
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t('register.fields.emailPlaceholder')}
                    autoComplete="email"
                    required
                  />
                  <Form.Text className="register-field-hint">
                    {t('register.fields.emailHint', {
                      defaultValue:
                        'This email address will also be your username when signing in.',
                    })}
                  </Form.Text>
                </Form.Group>
                <div className="register-field-row">
                  <Form.Group controlId="password" className="register-form-group">
                    <Form.Label>{t('register.fields.password')}</Form.Label>
                    <div className="password-field">
                      <Form.Control
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder={t('register.fields.passwordPlaceholder')}
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        aria-label={
                          showPassword
                            ? t('common.hidePassword', { defaultValue: 'Hide password' })
                            : t('common.showPassword', { defaultValue: 'Show password' })
                        }
                        title={
                          showPassword
                            ? t('common.hidePassword', { defaultValue: 'Hide password' })
                            : t('common.showPassword', { defaultValue: 'Show password' })
                        }
                        onClick={() => setShowPassword((prev) => !prev)}
                      >
                        {showPassword ? <EyeSlash aria-hidden="true" /> : <Eye aria-hidden="true" />}
                      </button>
                    </div>
                    <Form.Text className="register-field-hint">
                      {t('register.passwordHint', {
                        defaultValue:
                          'Use at least 8 characters, including a number and a symbol.',
                      })}
                    </Form.Text>
                  </Form.Group>
                  <Form.Group controlId="confirmPassword" className="register-form-group">
                    <Form.Label>{t('register.fields.confirmPassword')}</Form.Label>
                    <div className="password-field">
                      <Form.Control
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder={t('register.fields.confirmPasswordPlaceholder')}
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        aria-label={
                          showConfirmPassword
                            ? t('common.hidePassword', { defaultValue: 'Hide password' })
                            : t('common.showPassword', { defaultValue: 'Show password' })
                        }
                        title={
                          showConfirmPassword
                            ? t('common.hidePassword', { defaultValue: 'Hide password' })
                            : t('common.showPassword', { defaultValue: 'Show password' })
                        }
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                      >
                        {showConfirmPassword ? <EyeSlash aria-hidden="true" /> : <Eye aria-hidden="true" />}
                      </button>
                    </div>
                  </Form.Group>
                </div>
              </div>
              <div className="register-form-actions">
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
              </div>
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
