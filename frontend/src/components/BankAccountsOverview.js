import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Spinner, Alert, ListGroup } from 'react-bootstrap';
import { FaLandmark } from 'react-icons/fa';
import axiosInstance from '../utils/axiosInstance';
import { formatNumber } from '../utils/format';

function BankAccountsOverview() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await axiosInstance.get('/accounts/');
        setAccounts(res.data);
      } catch (err) {
        setError('Could not load bank accounts.');
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  if (loading) {
    return <div className="text-center"><Spinner animation="border" /></div>;
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const totals = accounts.reduce((acc, account) => {
    const currency = account.currency;
    const amount = parseFloat(account.balance);
    acc[currency] = (acc[currency] || 0) + amount;
    return acc;
  }, {});

  return (
    <div className="mt-5">
      <h4 className="mb-4">Bank Accounts</h4>
      <Card className="mb-4 shadow-sm">
        <Card.Header as="h5">Account Totals</Card.Header>
        <Card.Body>
          <ListGroup variant="flush">
            {Object.entries(totals).map(([currency, amount]) => (
              <ListGroup.Item key={currency} className="d-flex justify-content-between align-items-center">
                <span className="fw-bold">{currency}</span>
                <span className="badge bg-primary rounded-pill fs-6">{formatNumber(amount)}</span>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Card.Body>
      </Card>
      <Row className="g-4">
        {accounts.map(account => (
          <Col md={6} lg={4} key={account.id}>
            <Card className="shadow-sm">
              <Card.Body className="d-flex align-items-center">
                <FaLandmark size={30} className="me-3 text-muted" />
                <div>
                  <h6 className="mb-1">{account.name}</h6>
                  <h4 className="mb-0">{formatNumber(account.balance)} <small className="text-muted">{account.currency}</small></h4>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}

export default BankAccountsOverview;
