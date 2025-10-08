import React from 'react';
import { Alert, Card, Col, Form, Row } from 'react-bootstrap';

function SaleCustomerSelector({
    customerOptions,
    selectedCustomerId,
    onChange,
    isLoading,
    error,
    onDismissError,
}) {
    return (
        <Card className="sale-form__selection-card mb-4">
            <Card.Body>
                <Row className="align-items-end g-3">
                    <Col md={8}>
                        <Form.Group controlId="saleCustomer">
                            <Form.Label>Select Customer</Form.Label>
                            <Form.Select
                                value={selectedCustomerId || ''}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    onChange(value ? Number(value) : null);
                                }}
                                disabled={isLoading}
                            >
                                <option value="">Choose a customer...</option>
                                {customerOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.name}
                                    </option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Col>
                    <Col md={4}>
                        <div className="text-muted small">
                            {isLoading ? 'Loading customers...' : 'Select a customer to start a new sale.'}
                        </div>
                    </Col>
                </Row>
                {error && (
                    <Alert variant="danger" className="mt-3" onClose={onDismissError} dismissible>
                        {error}
                    </Alert>
                )}
            </Card.Body>
        </Card>
    );
}

export default SaleCustomerSelector;
