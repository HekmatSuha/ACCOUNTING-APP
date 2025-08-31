import React, { useEffect, useState } from 'react';
import { Table, Spinner, Alert } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';

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
      <h4>Bank Accounts</h4>
      <div className="mb-3">
        {Object.entries(totals).map(([currency, amount]) => (
          <span key={currency} className="me-3 fw-bold">
            {currency}: {amount.toFixed(2)}
          </span>
        ))}
      </div>
      <Table striped bordered hover>
        <thead>
          <tr>
            <th>Account</th>
            <th>Balance</th>
            <th>Currency</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(account => (
            <tr key={account.id}>
              <td>{account.name}</td>
              <td>{parseFloat(account.balance).toFixed(2)}</td>
              <td>{account.currency}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

export default BankAccountsOverview;
