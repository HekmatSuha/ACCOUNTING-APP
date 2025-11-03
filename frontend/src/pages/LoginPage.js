import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Alert } from 'react-bootstrap';
import { Eye, EyeSlash } from 'react-bootstrap-icons';
import { useTranslation, Trans } from 'react-i18next';
import './LoginPage.css';

// 1. Centralize the API URL
const API_URL = 'http://127.0.0.1:8000/api';

function LoginPage() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [hasError, setHasError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setHasError(false);
    try {
      // 2. Use the API_URL constant for the request
      const response = await axios.post(`${API_URL}/token/`, { username, password });
      localStorage.setItem('accessToken', response.data.access);
      localStorage.setItem('refreshToken', response.data.refresh);
      localStorage.setItem('username', username);
      navigate('/dashboard');
    } catch (err) {
      setHasError(true);
      console.error('Login failed:', err);
    }
  };

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <aside className="auth-hero" aria-hidden="true">
          <div className="auth-hero-content">
            <span className="auth-hero-kicker">{t('login.hero.kicker')}</span>
            <h1>{t('login.hero.title')}</h1>
            <p className="auth-hero-text">{t('login.hero.text')}</p>
          </div>
        </aside>
        <div className="auth-form-side">
          <div className="auth-form-inner">
            <header className="auth-header">
              <h2 className="auth-title">{t('login.title')}</h2>
              <p className="text-muted mb-0">{t('login.subtitle')}</p>
            </header>
            {hasError && (
              <Alert variant="danger" className="auth-alert">
                {t('login.error')}
              </Alert>
            )}
            <Form onSubmit={handleSubmit} className="auth-form">
              <Form.Group controlId="username" className="mb-3">
                <Form.Label>{t('login.fields.username')}</Form.Label>
                <Form.Control
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('login.fields.usernamePlaceholder')}
                  autoComplete="username"
                  required
                />
              </Form.Group>
              <Form.Group controlId="password" className="mb-2">
                <Form.Label>{t('login.fields.password')}</Form.Label>
                <div className="password-field">
                  <Form.Control
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('login.fields.passwordPlaceholder')}
                    autoComplete="current-password"
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
                <p className="text-microcopy auth-microcopy">{t('login.passwordHint')}</p>
              </Form.Group>
              <div className="auth-meta-row">
                <Form.Check
                  type="checkbox"
                  id="rememberMe"
                  label={t('login.rememberMe')}
                  className="auth-remember"
                />
                <span className="text-microcopy auth-help">
                  {t('login.helpText')}{' '}
                  <a href="mailto:support@example.com">{t('login.contactSupport')}</a>
                </span>
              </div>
              <button type="submit" className="btn btn-primary w-100">
                {t('login.submit')}
              </button>
            </Form>
          </div>
          <footer className="auth-footer">
            <span className="text-microcopy">
              <Trans i18nKey="login.footer" components={{ registerLink: <Link to="/register" /> }} />
            </span>
          </footer>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
