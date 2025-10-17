import React from 'react';
import { Button, Col, Form, Row } from 'react-bootstrap';

function PlanForm({ plan, onPlanChange, onSubmit, saving, onCancel }) {
  const handleChange = (event) => {
    const { name, value } = event.target;
    onPlanChange((previous) => ({ ...previous, [name]: value }));
  };

  return (
    <Form onSubmit={onSubmit}>
      <Row className="g-3">
        <Col md={6}>
          <Form.Group controlId="plan-name">
            <Form.Label>Plan name</Form.Label>
            <Form.Control
              name="name"
              value={plan.name}
              onChange={handleChange}
              required
            />
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
            <Form.Select
              name="currency"
              value={plan.currency}
              onChange={handleChange}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group controlId="plan-cycle">
            <Form.Label>Billing cycle</Form.Label>
            <Form.Select
              name="billing_cycle"
              value={plan.billing_cycle}
              onChange={handleChange}
            >
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
        <Button
          type="button"
          variant="outline-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </Form>
  );
}

export default PlanForm;