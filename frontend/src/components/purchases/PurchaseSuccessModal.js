// frontend/src/components/purchases/PurchaseSuccessModal.js

import React from 'react';
import { Modal, Button, Alert, Spinner } from 'react-bootstrap';

function PurchaseSuccessModal({
    show,
    onHide,
    purchase,
    onPrint,
    onRecordPayment,
    onNewPurchase,
    isPrinting,
    errorMessage,
}) {
    if (!purchase) {
        return null;
    }

    const hasSupplier = Boolean(purchase.supplier_name);
    const hasCustomer = Boolean(purchase.customer_name);
    const billLabel = purchase.invoice_number
        ? `Invoice #${purchase.invoice_number}`
        : purchase.bill_number
            ? `Bill #${purchase.bill_number}`
            : 'The purchase';

    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton>
                <Modal.Title>Purchase Saved</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
                <p className="mb-4">
                    {billLabel} has been saved successfully.
                    {(hasSupplier || hasCustomer) && (
                        <>
                            {' '}
                            {hasSupplier && <span>Supplier: {purchase.supplier_name}.</span>}
                            {hasCustomer && <span>Customer: {purchase.customer_name}.</span>}
                        </>
                    )}
                </p>
                <p className="mb-3">Use the options below to print, record a payment, or begin another purchase.</p>
                <div className="d-flex flex-wrap gap-2">
                    <Button
                        variant="success"
                        onClick={onPrint}
                        disabled={!purchase?.id || isPrinting}
                        className="flex-fill"
                    >
                        {isPrinting ? (
                            <>
                                <Spinner as="span" animation="border" size="sm" className="me-2" /> Generating...
                            </>
                        ) : (
                            'Print Invoice'
                        )}
                    </Button>
                    <Button
                        variant="info"
                        onClick={onRecordPayment}
                        disabled={!purchase?.id}
                        className="flex-fill text-white"
                    >
                        Record Payment
                    </Button>
                    <Button variant="warning" onClick={onNewPurchase} className="flex-fill text-white">
                        New Purchase
                    </Button>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>
                    Close
                </Button>
            </Modal.Footer>
        </Modal>
    );
}

export default PurchaseSuccessModal;
