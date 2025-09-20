import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Alert } from 'react-bootstrap';
import './LoginPage.css';

// 1. Centralize the API URL
const API_URL = 'http://127.0.0.1:8000/api';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      // 2. Use the API_URL constant for the request
      const response = await axios.post(`${API_URL}/token/`, { username, password });
      localStorage.setItem('accessToken', response.data.access);
      localStorage.setItem('refreshToken', response.data.refresh);
      localStorage.setItem('username', username);
      navigate('/dashboard');
    } catch (err) {
      setError('Login failed. Please check your username and password.');
      console.error('Login failed:', err);
    }
  };

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <aside className="auth-hero" aria-hidden="true">
          <div className="auth-hero-content">
            <span className="auth-hero-kicker">Accounting OS</span>
            <h1>Run your finances with clarity.</h1>
            <p className="auth-hero-text">
              Streamline invoicing, reconcile accounts, and monitor cash flow with real-time insights designed for modern teams.
            </p>
          </div>
        </aside>
        <div className="auth-form-side">
          <div className="auth-form-inner">
            <header className="auth-header">
              <h2 className="auth-title">Sign in to your workspace</h2>
              <p className="text-muted mb-0">
                Welcome back! Please enter your details to continue.
              </p>
            </header>
            {error && (
              <Alert variant="danger" className="auth-alert">
                {error}
              </Alert>
            )}
            <Form onSubmit={handleSubmit} className="auth-form">
              <Form.Group controlId="username" className="mb-3">
                <Form.Label>Username</Form.Label>
                <Form.Control
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  autoComplete="username"
                  required
                />
              </Form.Group>
              <Form.Group controlId="password" className="mb-2">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <p className="text-microcopy auth-microcopy">
                  Use at least 8 characters, including a number and a symbol.
                </p>
              </Form.Group>
              <div className="auth-meta-row">
                <Form.Check
                  type="checkbox"
                  id="rememberMe"
                  label="Remember me"
                  className="auth-remember"
                />
                <span className="text-microcopy auth-help">
                  Trouble signing in?
                  <a href="mailto:support@example.com">Contact support</a>
                </span>
              </div>
              <button type="submit" className="btn btn-primary w-100">
                Log In
              </button>
            </Form>
          </div>
          <footer className="auth-footer">
            <span className="text-microcopy">
              New to the platform? <Link to="/register">Create an account</Link>
            </span>
          </footer>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
