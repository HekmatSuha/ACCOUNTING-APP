import React from 'react';
import { Button, Card, Col, Form, Row, Stack } from 'react-bootstrap';

function SaleSidebarSummary({
    isEditMode,
    isOffer,
    customer,
    allowCustomerSwitch,
    customerOptions,
    selectedCustomerId,
    onCustomerChange,
    isLoadingCustomerOptions,
    documentNumber,
    onDocumentNumberChange,
    saleDate,
    onSaleDateChange,
    invoiceDate,
    onInvoiceDateChange,
    invoiceNumber,
    onInvoiceNumberChange,
    description,
    onDescriptionChange,
    totals,
    formatCurrency,
    hasWarehouses,
    hasLineItems,
    isSubmitting,
    primaryActionLabel,
    onCancel,
}) {
    return (
        <Card className="sale-form__sidebar-card">
            <Card.Header>
                <div className="sale-form__sidebar-title">
                    <div className="sale-form__sidebar-label">
                        {isEditMode ? 'Edit Sale' : isOffer ? 'Offer' : 'Sale'} Summary
                    </div>
                    <div className="sale-form__sidebar-entity">{customer.name}</div>
                </div>
            </Card.Header>
            <Card.Body>
                {allowCustomerSwitch && (
                    <Row className="gy-3 mb-1">
                        <Col xs={12}>
                            <Form.Group controlId="saleEditorCustomer">
                                <Form.Label>Customer</Form.Label>
                                <Form.Select
                                    value={selectedCustomerId || ''}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        onCustomerChange(value ? Number(value) : null);
                                    }}
                                    disabled={isLoadingCustomerOptions}
                                    required
                                >
                                    <option value="">Select a customer</option>
                                    {customerOptions.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.name}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                    </Row>
                )}
                <div className="sale-form__entity-meta">
                    {customer.phone && <span>{customer.phone}</span>}
                    {customer.email && <span>{customer.email}</span>}
                    <span>{customer.currency} account</span>
                </div>
                <Row className="gy-3 mt-1">
                    <Col xs={12}>
                        <Form.Group controlId="documentNumber">
                            <Form.Label>Document No</Form.Label>
                            <Form.Control
                                type="text"
                                value={documentNumber}
                                placeholder="Auto"
                                onChange={(event) => onDocumentNumberChange(event.target.value)}
                            />
                        </Form.Group>
                    </Col>
                    <Col md={6}>
                        <Form.Group controlId="saleDate">
                            <Form.Label>{isOffer ? 'Offer Date' : 'Sale Date'}</Form.Label>
                            <Form.Control
                                type="date"
                                value={saleDate}
                                onChange={(event) => onSaleDateChange(event.target.value)}
                            />
                        </Form.Group>
                    </Col>
                    <Col md={6}>
                        <Form.Group controlId="invoiceDate">
                            <Form.Label>Invoice Date</Form.Label>
                            <Form.Control
                                type="date"
                                value={invoiceDate}
                                onChange={(event) => onInvoiceDateChange(event.target.value)}
                            />
                        </Form.Group>
                    </Col>
                    <Col md={6}>
                        <Form.Group controlId="invoiceNumber">
                            <Form.Label>Invoice No</Form.Label>
                            <Form.Control
                                type="text"
                                value={invoiceNumber}
                                placeholder="Auto"
                                onChange={(event) => onInvoiceNumberChange(event.target.value)}
                            />
                        </Form.Group>
                    </Col>
                    <Col xs={12}>
                        <Form.Group controlId="description">
                            <Form.Label>Description</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={description}
                                onChange={(event) => onDescriptionChange(event.target.value)}
                                placeholder="Optional notes about this transaction"
                            />
                        </Form.Group>
                    </Col>
                </Row>
                <div className="sale-form__summary mt-4">
                    <div className="sale-form__summary-row">
                        <span>Subtotal</span>
                        <span>{formatCurrency(totals.base)}</span>
                    </div>
                    <div className="sale-form__summary-row">
                        <span>Discount</span>
                        <span>{formatCurrency(totals.discount)}</span>
                    </div>
                    <div className="sale-form__summary-row sale-form__summary-row--strong">
                        <span>Net Total</span>
                        <span>{formatCurrency(totals.net)}</span>
                    </div>
                </div>
            </Card.Body>
            <Card.Footer>
                <Stack gap={2}>
                    <Button type="submit" variant="success" disabled={!hasWarehouses || !hasLineItems || isSubmitting}>
                        {primaryActionLabel}
                    </Button>
                    <Button variant="outline-secondary" onClick={onCancel} type="button">
                        Cancel
                    </Button>
                </Stack>
            </Card.Footer>
        </Card>
    );
}

export default SaleSidebarSummary;
