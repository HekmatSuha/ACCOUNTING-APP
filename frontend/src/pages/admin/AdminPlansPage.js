import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Modal, Spinner, Table } from 'react-bootstrap';
import {
  createPlan,
  deletePlan,
  listPlans,
  parseAdminError,
  updatePlan,
} from '../../utils/adminApi';
import PlanForm from './PlanForm';

const EMPTY_PLAN = {
  name: '',
  price: '',
  currency: 'USD',
  billing_cycle: 'monthly',
  seat_limit: '',
  features: '',
};

function formatPrice(price, currency) {
  if (price == null) {
    return 'Free';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(price);
}

function AdminPlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleShowModal = (plan = null) => {
    const initialData = plan
      ? {
          ...EMPTY_PLAN,
          ...plan,
          features: Array.isArray(plan.features) ? plan.features.join('\n') : '',
        }
      : EMPTY_PLAN;
    setSelectedPlan(initialData);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedPlan(null);
    setFormError(null);
  };

  const handleDeletePlan = async (planId) => {
    if (window.confirm('Are you sure you want to delete this plan?')) {
      try {
        await deletePlan(planId);
        setPlans((previous) => previous.filter((p) => p.id !== planId));
      } catch (requestError) {
        setError(parseAdminError(requestError, 'Unable to delete the plan.'));
      }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    const payload = {
      ...selectedPlan,
      price: Number(selectedPlan.price),
      seat_limit: selectedPlan.seat_limit ? Number(selectedPlan.seat_limit) : null,
      features: selectedPlan.features
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
    };

    try {
      if (payload.id) {
        const updated = await updatePlan(payload.id, payload);
        setPlans((previous) => previous.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await createPlan(payload);
        setPlans((previous) => [...previous, created]);
      }
      handleCloseModal();
    } catch (requestError) {
      setFormError(parseAdminError(requestError, 'Unable to save the plan.'));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function loadPlans() {
      try {
        setLoading(true);
        const response = await listPlans();
        if (mounted) {
          setPlans(Array.isArray(response) ? response : []);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError.message || 'Unable to load plans.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadPlans();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="d-flex justify-content-center py-5">
        <Spinner animation="border" role="status" />
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  return (
    <Card>
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <Card.Title as="h1" className="h4 mb-0">
            Subscription plans
          </Card.Title>
          <Button variant="primary" onClick={() => handleShowModal()}>
            Add new plan
          </Button>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <div className="table-responsive">
          <Table hover>
            <thead>
              <tr>
                <th scope="col">Plan name</th>
                <th scope="col">Price</th>
                <th scope="col">Billing cycle</th>
                <th scope="col">Seat limit</th>
                <th scope="col" className="text-end">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td className="fw-semibold">{plan.name}</td>
                  <td>{formatPrice(plan.price, plan.currency)}</td>
                  <td>{plan.billing_cycle}</td>
                  <td>{plan.seat_limit || 'Unlimited'}</td>
                  <td className="text-end">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => handleShowModal(plan)}
                      className="me-2"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDeletePlan(plan.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        {selectedPlan && (
          <Modal show={showModal} onHide={handleCloseModal} size="lg">
            <Modal.Header closeButton>
              <Modal.Title>{selectedPlan.id ? 'Edit plan' : 'Add new plan'}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {formError && <Alert variant="danger">{formError}</Alert>}
              <PlanForm
                plan={selectedPlan}
                onPlanChange={setSelectedPlan}
                onSubmit={handleSubmit}
                saving={saving}
                onCancel={handleCloseModal}
              />
            </Modal.Body>
          </Modal>
        )}
      </Card.Body>
    </Card>
  );
}

export default AdminPlansPage;