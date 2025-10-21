import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Form, ProgressBar, Spinner, Table } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  createAccount,
  listAccounts,
  listPlans,
  parseAdminError,
  withOptimisticUpdate,
} from '../../utils/adminApi';

const EMPTY_FORM = {
  name: '',
  seat_limit: '',
  plan: '',
  owner_email: '',
  owner_username: '',
  owner_password: '',
  owner_is_admin: true,
  owner_is_billing_manager: false,
};

function formatPlanName(plan) {
  if (!plan) {
    return 'Unassigned';
  }
  return plan
    .toString()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function AdminAccountListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [showPlanHint, setShowPlanHint] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [plans, setPlans] = useState([]);

  const resolveFieldError = (fieldName) => {
    const message = formErrors?.[fieldName];
    if (!message) {
      return '';
    }
    if (Array.isArray(message)) {
      return message.join(' ');
    }
    if (typeof message === 'string') {
      return message;
    }
    return String(message);
  };

  const hasAccounts = accounts.length > 0;

  const filteredAccounts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return accounts;
    }

    return accounts.filter((account) => {
      const name = account.name?.toLowerCase() ?? '';
      const domain = account.email_domain?.toLowerCase() ?? '';
      const plan = formatPlanName(account.subscription?.plan).toLowerCase();

      return (
        name.includes(query) || domain.includes(query) || plan.includes(query)
      );
    });
  }, [accounts, searchQuery]);

  const sortedAccounts = useMemo(() => {
    return [...filteredAccounts].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredAccounts]);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        const [accountsResponse, plansResponse] = await Promise.all([
          listAccounts(),
          listPlans(),
        ]);

        if (mounted) {
          const loadedPlans = Array.isArray(plansResponse) ? plansResponse : [];
          setPlans(loadedPlans);
          setAccounts(Array.isArray(accountsResponse) ? accountsResponse : []);

          if (loadedPlans.length > 0) {
            setFormState((prev) =>
              prev.plan ? prev : { ...prev, plan: loadedPlans[0].code },
            );
          }
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message || 'Unable to load accounts or plans.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setShowPlanHint(params.get('section') === 'plans');
  }, [location.search]);

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === 'checkbox' ? checked : value;
    setFormState((previous) => ({ ...previous, [name]: nextValue }));
    setFormErrors((previous) => ({ ...previous, [name]: undefined }));
  };

  const handleCreateAccount = async (event) => {
    event.preventDefault();
    setFormError(null);
    setFormErrors({});
    setCreating(true);

    const payload = {
      name: formState.name.trim(),
      seat_limit: Number(formState.seat_limit) || 0,
      plan: formState.plan,
    };

    const trimmedOwnerEmail = formState.owner_email.trim();
    const trimmedOwnerUsername = formState.owner_username.trim();

    if (trimmedOwnerEmail) {
      payload.owner_email = trimmedOwnerEmail;
    }
    if (trimmedOwnerUsername) {
      payload.owner_username = trimmedOwnerUsername;
      payload.owner_is_admin = Boolean(formState.owner_is_admin);
      payload.owner_is_billing_manager = Boolean(formState.owner_is_billing_manager);
    }
    if (trimmedOwnerUsername && formState.owner_password) {
      payload.owner_password = formState.owner_password;
    }

    const optimisticAccount = {
      id: `optimistic-${Date.now()}`,
      name: payload.name,
      seat_limit: payload.seat_limit,
      seats_used: 0,
      subscription: { plan: payload.plan },
      status: 'Provisioning',
      owner: trimmedOwnerUsername
        ? {
            username: trimmedOwnerUsername,
            email: trimmedOwnerEmail || null,
            is_admin: Boolean(formState.owner_is_admin),
            is_billing_manager: Boolean(formState.owner_is_billing_manager),
          }
        : null,
      optimistic: true,
    };

    try {
      await withOptimisticUpdate(
        () => createAccount(payload),
        {
          applyOptimistic: () => {
            setAccounts((previous) => [optimisticAccount, ...previous]);
            return optimisticAccount.id;
          },
          commit: (createdAccount, token) => {
            setAccounts((previous) =>
              previous.map((account) =>
                account.id === token ? createdAccount : account,
              ),
            );
          },
          rollback: (token) => {
            setAccounts((previous) => previous.filter((account) => account.id !== token));
          },
        },
      );
      setFormState((previous) => ({ ...EMPTY_FORM, plan: previous.plan }));
      setFormErrors({});
    } catch (requestError) {
      setFormError(parseAdminError(requestError, 'Unable to create the account.'));
      const fieldMessages = requestError?.cause?.response?.data;
      if (fieldMessages && typeof fieldMessages === 'object' && !Array.isArray(fieldMessages)) {
        setFormErrors(fieldMessages);
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5" data-testid="admin-accounts-loading">
        <Spinner animation="border" role="status" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" className="mb-4" data-testid="admin-accounts-error">
        {error}
      </Alert>
    );
  }

  return (
    <div className="d-flex flex-column gap-4">
      <Card>
        <Card.Body>
          <Card.Title as="h2" className="h4">
            Create a new customer account
          </Card.Title>
          <Form onSubmit={handleCreateAccount} className="row g-3" data-testid="create-account-form">
            <div className="col-12 col-lg-4">
              <Form.Label htmlFor="account-name">Account name</Form.Label>
              <Form.Control
                id="account-name"
                name="name"
                value={formState.name}
                onChange={handleInputChange}
                placeholder="Acme Corporation"
                required
                isInvalid={Boolean(resolveFieldError('name'))}
              />
              <Form.Control.Feedback type="invalid">
                {resolveFieldError('name')}
              </Form.Control.Feedback>
            </div>
            <div className="col-6 col-lg-2">
              <Form.Label htmlFor="account-seat-limit">Seat limit</Form.Label>
              <Form.Control
                id="account-seat-limit"
                name="seat_limit"
                type="number"
                min={0}
                value={formState.seat_limit}
                onChange={handleInputChange}
                placeholder="25"
                required
                isInvalid={Boolean(resolveFieldError('seat_limit'))}
              />
              <Form.Control.Feedback type="invalid">
                {resolveFieldError('seat_limit')}
              </Form.Control.Feedback>
              <Form.Text muted>Users allowed for this workspace.</Form.Text>
            </div>
            <div className="col-6 col-lg-2">
              <Form.Label htmlFor="account-plan">Plan</Form.Label>
              <Form.Select
                id="account-plan"
                name="plan"
                value={formState.plan}
                onChange={handleInputChange}
                disabled={plans.length === 0}
                isInvalid={Boolean(resolveFieldError('plan'))}
              >
                {plans.length === 0 && <option>No plans available</option>}
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.code}>
                    {plan.name}
                  </option>
                ))}
              </Form.Select>
              <Form.Control.Feedback type="invalid">
                {resolveFieldError('plan')}
              </Form.Control.Feedback>
            </div>
            <div className="col-12 col-lg-4">
              <Form.Label htmlFor="owner-username">Owner username</Form.Label>
              <Form.Control
                id="owner-username"
                name="owner_username"
                value={formState.owner_username}
                onChange={handleInputChange}
                placeholder="owner.user"
                isInvalid={Boolean(resolveFieldError('owner_username'))}
                autoComplete="username"
              />
              <Form.Control.Feedback type="invalid">
                {resolveFieldError('owner_username')}
              </Form.Control.Feedback>
            </div>
            <div className="col-12 col-lg-4">
              <Form.Label htmlFor="owner-email">Owner email</Form.Label>
              <Form.Control
                id="owner-email"
                name="owner_email"
                type="email"
                value={formState.owner_email}
                onChange={handleInputChange}
                placeholder="owner@example.com"
                isInvalid={Boolean(resolveFieldError('owner_email'))}
                autoComplete="email"
              />
              <Form.Control.Feedback type="invalid">
                {resolveFieldError('owner_email')}
              </Form.Control.Feedback>
            </div>
            <div className="col-12 col-lg-4">
              <Form.Label htmlFor="owner-password">Owner password</Form.Label>
              <Form.Control
                id="owner-password"
                name="owner_password"
                type="password"
                value={formState.owner_password}
                onChange={handleInputChange}
                placeholder="Set a secure password"
                isInvalid={Boolean(resolveFieldError('owner_password'))}
                autoComplete="new-password"
              />
              <Form.Control.Feedback type="invalid">
                {resolveFieldError('owner_password')}
              </Form.Control.Feedback>
            </div>
            <div className="col-12 col-lg-4">
              <Form.Label className="d-block">Owner roles</Form.Label>
              <div className="d-flex flex-column gap-2">
                <Form.Check
                  id="owner-is-admin"
                  name="owner_is_admin"
                  type="checkbox"
                  label="Grant admin access"
                  checked={Boolean(formState.owner_is_admin)}
                  onChange={handleInputChange}
                />
                <Form.Check
                  id="owner-is-billing-manager"
                  name="owner_is_billing_manager"
                  type="checkbox"
                  label="Grant billing manager access"
                  checked={Boolean(formState.owner_is_billing_manager)}
                  onChange={handleInputChange}
                />
              </div>
            </div>
            <div className="col-12 col-lg-2 align-self-end ms-lg-auto">
              <Button type="submit" className="w-100" disabled={creating}>
                {creating ? 'Creating…' : 'Create account'}
              </Button>
            </div>
            {formError && (
              <div className="col-12">
                <Alert variant="danger" className="mb-0">
                  {formError}
                </Alert>
              </div>
            )}
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <Card.Title as="h2" className="h4">
            <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
              <div className="d-flex align-items-center gap-2">
                <span>Managed customer accounts</span>
                <Badge bg="secondary" data-testid="account-count-badge">
                  {accounts.length}
                </Badge>
              </div>
              <Form.Control
                type="search"
                placeholder="Search accounts"
                aria-label="Search accounts"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                data-testid="admin-account-search"
                style={{ maxWidth: 320 }}
              />
            </div>
          </Card.Title>
          {showPlanHint && (
            <Alert variant="info" className="mb-3" data-testid="admin-plan-hint">
              Choose an account below and open “Edit plan details” to configure subscriptions.
            </Alert>
          )}

          {hasAccounts ? (
            <div className="table-responsive">
              <Table hover responsive="md" data-testid="admin-accounts-table">
                <thead>
                  <tr>
                    <th scope="col">Account</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Seat usage</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="text-end">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAccounts.map((account) => {
                    const seatsUsed = Number(account.seats_used || 0);
                    const seatLimit = Number(account.seat_limit || 0);
                    const usagePercent = seatLimit > 0 ? Math.min(100, Math.round((seatsUsed / seatLimit) * 100)) : 0;

                    return (
                      <tr key={account.id}>
                        <td>
                          <div className="fw-semibold">{account.name}</div>
                          <div className="text-muted small">{account.email_domain || 'No domain'}</div>
                        </td>
                        <td>
                          <Badge bg="info" className="text-uppercase">
                            {formatPlanName(account.subscription?.plan)}
                          </Badge>
                        </td>
                        <td style={{ minWidth: 200 }}>
                          <div className="d-flex align-items-center gap-2">
                            <ProgressBar now={usagePercent} visuallyHidden label={`${usagePercent}%`} className="flex-grow-1" />
                            <span className="small text-nowrap">
                              {seatsUsed}/{seatLimit || '∞'}
                            </span>
                          </div>
                        </td>
                        <td>{account.status || 'Active'}</td>
                        <td className="text-end">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => navigate(`/admin/accounts/${account.id}`)}
                          >
                            Manage
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-4 text-muted" data-testid="admin-accounts-empty">
              No customer accounts available yet.
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

export default AdminAccountListPage;
