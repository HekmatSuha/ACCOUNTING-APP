// frontend/src/components/sales/SaleSuccessModal.js

import React from 'react';
import { Modal, Button, Alert, Spinner } from 'react-bootstrap';

function SaleSuccessModal({
    show,
    onHide,
    sale,
    onPrint,
    onRecordPayment,
    onNewSale,
    isPrinting,
    errorMessage,
}) {
    const hasCustomer = sale?.customer_name;
    const hasSupplier = sale?.supplier_name;
    const invoiceLabel = sale?.invoice_number ? `Invoice #${sale.invoice_number}` : 'The sale';

    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton>
                <Modal.Title>Sale Saved</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
                <p className="mb-4">
                    {invoiceLabel} has been saved successfully.
                    {(hasCustomer || hasSupplier) && (
                        <>
                            {' '}
                            {hasCustomer && <span>Customer: {sale.customer_name}.</span>}
                            {hasSupplier && <span>Supplier: {sale.supplier_name}.</span>}
                        </>
                    )}
                </p>
                <p className="mb-3">Use the options below to print, record a payment, or begin another sale.</p>
                <div className="d-flex flex-wrap gap-2">
                    <Button
                        variant="success"
                        onClick={onPrint}
                        disabled={!sale?.id || isPrinting}
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
                        disabled={!sale?.id}
                        className="flex-fill text-white"
                    >
                        Record Payment
                    </Button>
                    <Button variant="warning" onClick={onNewSale} className="flex-fill text-white">
                        New Sale
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

export default SaleSuccessModal;

