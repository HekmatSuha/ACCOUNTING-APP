import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';
import { getCurrencyOptions, loadCurrencyOptions, getBaseCurrency, loadBaseCurrency } from '../config/currency';
import { formatCurrency } from '../utils/format';
import '../styles/paymentModal.css';

function SupplierPaymentModal({ show, handleClose, supplierId, onPaymentAdded, payment, supplierCurrency }) {
    const [amount, setAmount] = useState('');
    const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
    const [method, setMethod] = useState('Cash');
    const [description, setDescription] = useState('');
    const [account, setAccount] = useState('');
    const [accounts, setAccounts] = useState([]);
    const [accountCurrency, setAccountCurrency] = useState(getBaseCurrency());
    const [paymentCurrency, setPaymentCurrency] = useState('USD');
    const [baseCurrency, setBaseCurrency] = useState(getBaseCurrency());
    const [exchangeRate, setExchangeRate] = useState(1);
    const [convertedAmount, setConvertedAmount] = useState('');
    const [error, setError] = useState('');
    const [currencyOptions, setCurrencyOptions] = useState([]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const accountsRes = await axiosInstance.get('accounts/');
                setAccounts(accountsRes.data);

                const bc = await loadBaseCurrency();
                setBaseCurrency(bc);
                setAccountCurrency(supplierCurrency || bc);
                setPaymentCurrency(supplierCurrency || bc);

                const options = getCurrencyOptions();
                if (options.length === 0) {
                    const loadedOptions = await loadCurrencyOptions();
                    setCurrencyOptions(loadedOptions);
                } else {
                    setCurrencyOptions(options);
                }
            } catch (err) {
                console.error('Failed to fetch initial data:', err);
            }
        };

        if (show) {
            fetchInitialData();
        }

        if (payment) {
            const originalAmount = payment.original_amount ?? payment.amount ?? '';
            const paymentCurrencyCode = payment.original_currency || supplierCurrency || getBaseCurrency();
            const initialExchangeRate = payment.account_exchange_rate
                ? Number(payment.account_exchange_rate)
                : payment.exchange_rate
                    ? Number(payment.exchange_rate)
                    : 1;
            const initialConvertedAmount =
                payment.account_converted_amount ?? payment.converted_amount ?? originalAmount ?? '';

            setAmount(originalAmount !== null && originalAmount !== undefined ? String(originalAmount) : '');
            setExpenseDate(payment.expense_date || new Date().toISOString().slice(0, 10));
            setMethod(payment.method || 'Cash');
            setDescription(payment.description || '');
            setAccount(payment.account ? String(payment.account) : '');
            setPaymentCurrency(paymentCurrencyCode);
            setExchangeRate(initialExchangeRate || 1);
            setConvertedAmount(
                initialConvertedAmount !== null && initialConvertedAmount !== undefined
                    ? String(initialConvertedAmount)
                    : ''
            );
        } else {
            setAmount('');
            setExpenseDate(new Date().toISOString().slice(0, 10));
            setMethod('Cash');
            setDescription('');
            setAccount('');
            setPaymentCurrency(supplierCurrency || getBaseCurrency());
            setAccountCurrency(supplierCurrency || getBaseCurrency());
            setExchangeRate(1);
            setConvertedAmount('');
        }
    }, [payment, show, supplierCurrency]);


    useEffect(() => {
        if (account) {
            const acc = accounts.find(a => a.id === parseInt(account));
            if (acc) {
                setAccountCurrency(acc.currency);
            }
        } else {
            setAccountCurrency(supplierCurrency || baseCurrency);
        }
    }, [account, accounts, baseCurrency, supplierCurrency]);

    useEffect(() => {
        const amt = parseFloat(amount) || 0;
        if (account && paymentCurrency !== accountCurrency) {
            setConvertedAmount((amt * exchangeRate).toFixed(2));
        } else {
            setConvertedAmount(amount);
        }
    }, [account, amount, paymentCurrency, accountCurrency, exchangeRate]);


    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!amount || parseFloat(amount) <= 0) {
            setError('Please enter a valid positive amount.');
            return;
        }

        if (paymentCurrency !== accountCurrency && (!exchangeRate || exchangeRate <= 0)) {
            setError('Please provide a valid exchange rate.');
            return;
        }

        const paymentData = {
            expense_date: expenseDate,
            original_amount: parseFloat(amount),
            method,
            description,
            account: account ? parseInt(account, 10) : null,
            original_currency: paymentCurrency,
        };

        if (account && paymentCurrency !== accountCurrency) {
            const converted = parseFloat(convertedAmount);
            paymentData.account_exchange_rate = exchangeRate;
            paymentData.account_converted_amount = Number.isNaN(converted)
                ? parseFloat(amount) * exchangeRate
                : converted;
        }

        if (paymentCurrency !== supplierCurrency) {
            paymentData.exchange_rate = exchangeRate;
        }

        try {
            const url = payment
                ? `suppliers/${supplierId}/payments/${payment.id}/`
                : `suppliers/${supplierId}/payments/`;
            const httpMethod = payment ? 'put' : 'post';

            await axiosInstance[httpMethod](url, paymentData);

            onPaymentAdded();
            handleClose();
        } catch (err) {
            setError('Failed to process payment. Please try again.');
            console.error(err);
        }
    };

    const resolvedPaymentCurrency = paymentCurrency || supplierCurrency || baseCurrency || 'USD';
    const resolvedAccountCurrency = accountCurrency || supplierCurrency || baseCurrency || resolvedPaymentCurrency;
    const amountNumber = Number(amount) || 0;
    const paymentAmountLabel = formatCurrency(amountNumber, resolvedPaymentCurrency);
    const convertedAmountLabel = paymentCurrency !== accountCurrency
        ? convertedAmount
            ? formatCurrency(convertedAmount, resolvedAccountCurrency)
            : '—'
        : formatCurrency(amountNumber, resolvedAccountCurrency);

    return (
        <Modal show={show} onHide={handleClose} centered className="payment-modal">
            <Form onSubmit={handleSubmit}>
                <Modal.Header closeButton>
                    <div>
                        <div className="payment-modal__title">{payment ? 'Update Payment' : 'Record Payment'}</div>
                        <div className="payment-modal__subtitle">Log supplier payments with accurate currency conversions.</div>
                    </div>
                </Modal.Header>
                <Modal.Body>
                    {error && <Alert variant="danger" className="payment-modal__alert">{error}</Alert>}
                    <div className="payment-modal__grid">
                        <Form.Group controlId="paymentAmount" className="payment-modal__field">
                            <Form.Label>Amount</Form.Label>
                            <Form.Control
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={(event) => setAmount(event.target.value)}
                                placeholder="Enter amount"
                                required
                            />
                        </Form.Group>
                        <Form.Group controlId="paymentDate" className="payment-modal__field">
                            <Form.Label>Payment Date</Form.Label>
                            <Form.Control
                                type="date"
                                value={expenseDate}
                                onChange={(event) => setExpenseDate(event.target.value)}
                                required
                            />
                        </Form.Group>
                        <Form.Group controlId="paymentMethod" className="payment-modal__field">
                            <Form.Label>Payment Method</Form.Label>
                            <Form.Select value={method} onChange={(event) => setMethod(event.target.value)}>
                                <option value="Cash">Cash</option>
                                <option value="Bank">Bank Transfer</option>
                                <option value="Card">Credit/Debit Card</option>
                            </Form.Select>
                        </Form.Group>
                        <Form.Group controlId="paymentAccount" className="payment-modal__field">
                            <Form.Label>Account</Form.Label>
                            <Form.Select value={account} onChange={(event) => setAccount(event.target.value)}>
                                <option value="">No Account</option>
                                {accounts.map((a) => {
                                    const formattedBalance = formatCurrency(
                                        a.balance ?? 0,
                                        a.currency || resolvedAccountCurrency || 'USD',
                                    );
                                    return (
                                        <option key={a.id} value={a.id}>
                                            {a.name} ({formattedBalance})
                                        </option>
                                    );
                                })}
                            </Form.Select>
                        </Form.Group>
                        <Form.Group controlId="paymentCurrency" className="payment-modal__field">
                            <Form.Label>Currency</Form.Label>
                            <Form.Select value={paymentCurrency} onChange={(event) => setPaymentCurrency(event.target.value)}>
                                {currencyOptions.map((c) => (
                                    <option key={c[0]} value={c[0]}>{c[1]}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>

                        {paymentCurrency !== accountCurrency && (
                            <>
                                <Form.Group controlId="exchangeRate" className="payment-modal__field">
                                    <Form.Label>Exchange Rate ({paymentCurrency} to {accountCurrency})</Form.Label>
                                    <Form.Control
                                        type="number"
                                        step="0.0001"
                                        value={exchangeRate}
                                        onChange={(event) => setExchangeRate(parseFloat(event.target.value) || 0)}
                                        required
                                    />
                                </Form.Group>
                                <Form.Group controlId="convertedAmount" className="payment-modal__field">
                                    <Form.Label>Converted Amount ({accountCurrency})</Form.Label>
                                    <Form.Control type="text" value={convertedAmount} readOnly />
                                </Form.Group>
                            </>
                        )}
                        <Form.Group controlId="paymentNotes" className="payment-modal__field payment-modal__field--wide">
                            <Form.Label>Notes</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                placeholder="Optional notes"
                            />
                        </Form.Group>
                    </div>

                    <div className="payment-modal__summary">
                        <div className="payment-modal__summary-row">
                            <span className="payment-modal__summary-label">Amount</span>
                            <span className="payment-modal__summary-value">{paymentAmountLabel}</span>
                        </div>
                        <div className="payment-modal__summary-row">
                            <span className="payment-modal__summary-label">Recorded to account</span>
                            <span className="payment-modal__summary-value">{convertedAmountLabel}</span>
                        </div>
                        {paymentCurrency !== accountCurrency ? (
                            <div className="payment-modal__summary-note">
                                Exchange rate ensures the receiving account reflects the converted value.
                            </div>
                        ) : (
                            <div className="payment-modal__summary-note">
                                Funds will be tracked in {resolvedAccountCurrency}.
                            </div>
                        )}
                    </div>
                </Modal.Body>
                <Modal.Footer className="payment-modal__footer">
                    <Button variant="outline-secondary" type="button" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit">
                        {payment ? 'Update Payment' : 'Save Payment'}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
}

export default SupplierPaymentModal;
