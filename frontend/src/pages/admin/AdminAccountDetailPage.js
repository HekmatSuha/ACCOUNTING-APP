import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, ProgressBar, Row, Spinner, Table } from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchAccount, parseAdminError, updateAccount, updateSubscription } from '../../utils/adminApi';

function AdminAccountDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [limitValue, setLimitValue] = useState('');
  const [seatMessage, setSeatMessage] = useState(null);
  const [seatError, setSeatError] = useState(null);
  const [subscriptionMessage, setSubscriptionMessage] = useState(null);
  const [subscriptionError, setSubscriptionError] = useState(null);
  const [updatingSeatLimit, setUpdatingSeatLimit] = useState(false);
  const [updatingSubscription, setUpdatingSubscription] = useState(false);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [planCode, setPlanCode] = useState('starter');

  useEffect(() => {
    let mounted = true;

    async function loadAccount() {
      try {
        setLoading(true);
        const data = await fetchAccount(id);
        if (mounted) {
          setAccount(data);
          setLimitValue(data.seat_limit ?? '');
          setPlanCode(data.subscription?.plan || 'starter');
          setBillingCycle(data.subscription?.billing_cycle || 'monthly');
        }
      } catch (requestError) {
        if (mounted) {
          setError(requestError.message || 'Unable to load account information.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadAccount();

    return () => {
      mounted = false;
    };
  }, [id]);

  const seatUsage = useMemo(() => {
    if (!account) {
      return { used: 0, limit: 0, percent: 0 };
    }
    const used = Number(account.seats_used || 0);
    const limit = Number(account.seat_limit || 0);
    const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    return { used, limit, percent };
  }, [account]);

  const handleSeatLimitSubmit = async (event) => {
    event.preventDefault();
    setSeatError(null);
    setSeatMessage(null);
    setUpdatingSeatLimit(true);

    try {
      const payload = { seat_limit: Number(limitValue) };
      const updated = await updateAccount(id, payload);
      setAccount(updated);
      setSeatMessage('Seat limit updated successfully.');
    } catch (requestError) {
      setSeatError(parseAdminError(requestError, 'Unable to update the seat limit.'));
    } finally {
      setUpdatingSeatLimit(false);
    }
  };

  const handleSubscriptionSubmit = async (event) => {
    event.preventDefault();
    setSubscriptionError(null);
    setSubscriptionMessage(null);
    setUpdatingSubscription(true);

    try {
      const payload = {
        plan: planCode,
        billing_cycle: billingCycle,
      };
      const updated = await updateSubscription(id, payload);
      setAccount((previous) => ({
        ...previous,
        subscription: {
          ...(previous?.subscription || {}),
          ...updated,
        },
      }));
      setSubscriptionMessage('Subscription updated successfully.');
    } catch (requestError) {
      setSubscriptionError(parseAdminError(requestError, 'Unable to update the subscription.'));
    } finally {
      setUpdatingSubscription(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5" data-testid="admin-account-loading">
        <Spinner animation="border" role="status" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" className="mb-4" data-testid="admin-account-error">
        {error}
      </Alert>
    );
  }

  if (!account) {
    return null;
  }

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center">
        <div>
          <h1 className="h3 mb-1">{account.name}</h1>
          <div className="text-muted">Account owner: {account.owner_name || 'Unknown'}</div>
        </div>
        <Button variant="outline-secondary" onClick={() => navigate(-1)}>
          Back to accounts
        </Button>
      </div>

      <Row className="g-4">
        <Col lg={6}>
          <Card>
            <Card.Body>
              <Card.Title as="h2" className="h5 d-flex justify-content-between">
                Seat usage
                <Badge bg={seatUsage.percent >= 90 ? 'danger' : 'primary'}>
                  {seatUsage.used}/{seatUsage.limit || '∞'}
                </Badge>
              </Card.Title>
              <ProgressBar now={seatUsage.percent} className="mb-3" />
              <p className="text-muted mb-0">
                Monitor how many users are active in this workspace. Adjust the seat limit below if additional
                licenses are required.
              </p>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card>
            <Card.Body>
              <Card.Title as="h2" className="h5">Seat limit</Card.Title>
              <Form onSubmit={handleSeatLimitSubmit} className="d-flex gap-3 align-items-end" data-testid="seat-limit-form">
                <Form.Group controlId="seat-limit-input" className="flex-grow-1">
                  <Form.Label>Seats allowed</Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    value={limitValue}
                    onChange={(event) => setLimitValue(event.target.value)}
                    required
                  />
                </Form.Group>
                <Button type="submit" disabled={updatingSeatLimit}>
                  {updatingSeatLimit ? 'Saving…' : 'Update'}
                </Button>
              </Form>
              {seatError && (
                <Alert variant="danger" className="mt-3" data-testid="seat-limit-error">
                  {seatError}
                </Alert>
              )}
              {seatMessage && (
                <Alert variant="success" className="mt-3" data-testid="seat-limit-success">
                  {seatMessage}
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card>
        <Card.Body>
          <Card.Title as="h2" className="h5">Subscription</Card.Title>
          <Form onSubmit={handleSubscriptionSubmit} className="row g-3" data-testid="subscription-form">
            <Col md={4}>
              <Form.Label htmlFor="subscription-plan">Plan</Form.Label>
              <Form.Select
                id="subscription-plan"
                value={planCode}
                onChange={(event) => setPlanCode(event.target.value)}
              >
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="enterprise">Enterprise</option>
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label htmlFor="subscription-cycle">Billing cycle</Form.Label>
              <Form.Select
                id="subscription-cycle"
                value={billingCycle}
                onChange={(event) => setBillingCycle(event.target.value)}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </Form.Select>
            </Col>
            <Col md={4} className="d-flex align-items-end">
              <Button type="submit" className="w-100" disabled={updatingSubscription}>
                {updatingSubscription ? 'Saving…' : 'Save subscription'}
              </Button>
            </Col>
            {subscriptionError && (
              <Col xs={12}>
                <Alert variant="danger" data-testid="subscription-error">
                  {subscriptionError}
                </Alert>
              </Col>
            )}
            {subscriptionMessage && (
              <Col xs={12}>
                <Alert variant="success" data-testid="subscription-success">
                  {subscriptionMessage}
                </Alert>
              </Col>
            )}
          </Form>
          <div className="mt-3">
            <div className="text-muted small">Current plan: {account.subscription?.plan || 'Not assigned'}</div>
            <div className="text-muted small">Billing cycle: {account.subscription?.billing_cycle || 'Not set'}</div>
            <div className="text-muted small">Renews on: {account.subscription?.renews_on || 'N/A'}</div>
          </div>
          <div className="mt-3">
            <Link to={`/admin/accounts/${id}/plan`} className="btn btn-outline-secondary btn-sm">
              Edit plan details
            </Link>
          </div>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <Card.Title as="h2" className="h5">Active members</Card.Title>
          {Array.isArray(account.members) && account.members.length > 0 ? (
            <div className="table-responsive">
              <Table hover size="sm">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {account.members.map((member) => (
                    <tr key={member.id}>
                      <td>{member.name || member.username}</td>
                      <td>{member.email}</td>
                      <td>{member.role || 'User'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="text-muted">No members have joined this workspace yet.</div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

export default AdminAccountDetailPage;
