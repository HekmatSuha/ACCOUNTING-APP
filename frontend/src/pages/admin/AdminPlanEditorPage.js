import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchAccountPlan, parseAdminError, updateAccountPlan } from '../../utils/adminApi';

const EMPTY_PLAN = {
  name: '',
  price: '',
  currency: 'USD',
  billing_cycle: 'monthly',
  seat_limit: '',
  features: '',
};

function AdminPlanEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(EMPTY_PLAN);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadPlan() {
      try {
        setLoading(true);
        const data = await fetchAccountPlan(id);
        if (mounted) {
          setPlan({
            name: data.name || '',
            price: data.price ?? '',
            currency: data.currency || 'USD',
            billing_cycle: data.billing_cycle || 'monthly',
            seat_limit: data.seat_limit ?? '',
            features: Array.isArray(data.features) ? data.features.join('\n') : data.features || '',
          });
        }
      } catch (requestError) {
        if (mounted) {
          setError(requestError.message || 'Unable to load plan details.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadPlan();

    return () => {
      mounted = false;
    };
  }, [id]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setPlan((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = {
        name: plan.name,
        price: Number(plan.price),
        currency: plan.currency,
        billing_cycle: plan.billing_cycle,
        seat_limit: plan.seat_limit ? Number(plan.seat_limit) : null,
        features: plan.features
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
      };

      const updated = await updateAccountPlan(id, payload);
      setPlan({
        name: updated.name || payload.name,
        price: updated.price ?? payload.price,
        currency: updated.currency || payload.currency,
        billing_cycle: updated.billing_cycle || payload.billing_cycle,
        seat_limit: updated.seat_limit ?? payload.seat_limit,
        features: Array.isArray(updated.features) ? updated.features.join('\n') : plan.features,
      });
      setMessage('Plan details saved.');
    } catch (requestError) {
      setError(parseAdminError(requestError, 'Unable to save plan details.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5" data-testid="admin-plan-loading">
        <Spinner animation="border" role="status" />
      </div>
    );
  }

  return (
    <Card>
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <Card.Title as="h1" className="h4 mb-0">
              Edit subscription plan
            </Card.Title>
            <Card.Subtitle className="text-muted">
              Configure pricing, seat limits and features for this account.
            </Card.Subtitle>
          </div>
          <Button variant="outline-secondary" onClick={() => navigate(`/admin/accounts/${id}`)}>
            Back to account
          </Button>
        </div>

        {error && (
          <Alert variant="danger" data-testid="admin-plan-error">
            {error}
          </Alert>
        )}
        {message && (
          <Alert variant="success" data-testid="admin-plan-success">
            {message}
          </Alert>
        )}

        <Form onSubmit={handleSubmit} data-testid="admin-plan-form">
          <Row className="g-3">
            <Col md={6}>
              <Form.Group controlId="plan-name">
                <Form.Label>Plan name</Form.Label>
                <Form.Control name="name" value={plan.name} onChange={handleChange} required />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group controlId="plan-price">
                <Form.Label>Price</Form.Label>
                <Form.Control
                  name="price"
                  type="number"
                  step="0.01"
                  min={0}
                  value={plan.price}
                  onChange={handleChange}
                  required
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group controlId="plan-currency">
                <Form.Label>Currency</Form.Label>
                <Form.Select name="currency" value={plan.currency} onChange={handleChange}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group controlId="plan-cycle">
                <Form.Label>Billing cycle</Form.Label>
                <Form.Select name="billing_cycle" value={plan.billing_cycle} onChange={handleChange}>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group controlId="plan-seat-limit">
                <Form.Label>Seat limit</Form.Label>
                <Form.Control
                  name="seat_limit"
                  type="number"
                  min={0}
                  value={plan.seat_limit}
                  onChange={handleChange}
                />
                <Form.Text muted>Leave empty for unlimited seats.</Form.Text>
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group controlId="plan-features">
                <Form.Label>Included features</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={6}
                  name="features"
                  value={plan.features}
                  onChange={handleChange}
                  placeholder="One feature per line"
                />
              </Form.Group>
            </Col>
          </Row>

          <div className="mt-4 d-flex justify-content-end gap-3">
            <Button type="button" variant="outline-secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}

export default AdminPlanEditorPage;
