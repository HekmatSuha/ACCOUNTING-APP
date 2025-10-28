// frontend/src/components/PurchaseItemModal.js

import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Badge, Button, Col, Form, Modal, Row, Stack } from 'react-bootstrap';
import ProductSearchSelect from './ProductSearchSelect';

function PurchaseItemModal({
    show,
    onHide,
    onSave,
    initialItem,
    products,
    warehouses,
    currency,
    imageBaseUrl,
}) {
    const [formState, setFormState] = useState({
        product_id: '',
        quantity: 1,
        unit_price: 0,
        warehouse_id: '',
        discount: 0,
        note: '',
    });

    useEffect(() => {
        if (!show) return;
        const defaultWarehouse = warehouses[0]?.id || '';
        setFormState({
            product_id: initialItem?.product_id || '',
            quantity: initialItem?.quantity ?? 1,
            unit_price: initialItem?.unit_price ?? 0,
            warehouse_id: initialItem?.warehouse_id || defaultWarehouse,
            discount: initialItem?.discount ?? 0,
            note: initialItem?.note || '',
        });
    }, [show, initialItem, warehouses]);

    const selectedProduct = useMemo(() => {
        if (!formState.product_id) return null;
        return products.find((product) => product.id === Number(formState.product_id)) || null;
    }, [formState.product_id, products]);

    const currencyFormatter = useMemo(() => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency });
    }, [currency]);

    const handleProductSelect = (product) => {
        if (!product) {
            setFormState((prev) => ({
                ...prev,
                product_id: '',
                unit_price: 0,
                discount: 0,
            }));
            return;
        }
        const defaultWarehouse = formState.warehouse_id || warehouses[0]?.id || '';
        setFormState((prev) => ({
            ...prev,
            product_id: product.id,
            quantity: prev.quantity || 1,
            unit_price: Number(product.purchase_price) || 0,
            discount: 0,
            warehouse_id: defaultWarehouse,
        }));
    };

    const handleDiscountChange = (value) => {
        const bounded = Math.min(Math.max(Number(value) || 0, 0), 100);
        if (!selectedProduct) {
            setFormState((prev) => ({ ...prev, discount: bounded }));
            return;
        }
        const basePrice = Number(selectedProduct.purchase_price) || 0;
        const discountedPrice = Number((basePrice * (1 - bounded / 100)).toFixed(2));
        setFormState((prev) => ({
            ...prev,
            discount: bounded,
            unit_price: discountedPrice,
        }));
    };

    const handleUnitPriceChange = (value) => {
        const price = Number(value) || 0;
        setFormState((prev) => ({
            ...prev,
            unit_price: price,
            discount: 0,
        }));
    };

    const handleFieldChange = (name, value) => {
        setFormState((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const lineTotal = Number(formState.quantity || 0) * Number(formState.unit_price || 0);
    const stockInfo = selectedProduct?.warehouse_quantities?.find(
        (stock) => stock.warehouse_id === Number(formState.warehouse_id)
    );
    const availableStock = stockInfo ? Number(stockInfo.quantity) : null;

    const resolvedImage = selectedProduct?.image
        ? selectedProduct.image.startsWith('http')
            ? selectedProduct.image
            : `${imageBaseUrl}${selectedProduct.image}`
        : null;

    const canSave = Boolean(
        formState.product_id &&
        Number(formState.quantity) > 0 &&
        Number(formState.unit_price) >= 0 &&
        (formState.warehouse_id || warehouses.length === 0)
    );

    const handleSave = () => {
        if (!canSave) return;
        onSave({
            ...formState,
            quantity: Number(formState.quantity),
            unit_price: Number(formState.unit_price),
            discount: Number(formState.discount) || 0,
        });
    };

    return (
        <Modal show={show} onHide={onHide} centered size="lg" className="sale-form__modal">
            <Modal.Header closeButton>
                <Modal.Title>{formState.product_id ? 'Edit item' : 'Add item'}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Stack gap={4}>
                    <div className="sale-form__modal-product">
                        <div className="sale-form__modal-image">
                            {resolvedImage ? (
                                <img src={resolvedImage} alt={selectedProduct?.name || 'Product preview'} />
                            ) : (
                                <span>No image</span>
                            )}
                        </div>
                        <div className="sale-form__modal-info">
                            <h5>{selectedProduct?.name || 'Select a product'}</h5>
                            <div className="sale-form__modal-meta">
                                {selectedProduct?.sku && <span>SKU: {selectedProduct.sku}</span>}
                                {selectedProduct?.purchase_price && (
                                    <span>
                                        Base: {currencyFormatter.format(Number(selectedProduct.purchase_price))}
                                    </span>
                                )}
                                {availableStock !== null && (
                                    <span>
                                        Stock:{' '}
                                        <Badge bg={availableStock > 0 ? 'success' : 'danger'}>{availableStock}</Badge>
                                    </span>
                                )}
                            </div>
                            <div className="sale-form__inventory-panel">
                                <div className="sale-form__inventory-panel-header">ÜRÜN / HİZMETLER</div>
                                <div className="sale-form__inventory-panel-body">
                                    <ProductSearchSelect
                                        products={products}
                                        value={selectedProduct}
                                        onSelect={handleProductSelect}
                                        placeholder="Ürün isminden arayın veya barkod okutun"
                                        imageBaseUrl={imageBaseUrl}
                                    />
                                    <Button
                                        variant="link"
                                        className="sale-form__inventory-panel-action"
                                        href="/inventory/new"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        listede olmayan ürün eklemek için tıklayın
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Row className="gy-3">
                        <Col md={4}>
                            <Form.Group controlId="purchaseItemQuantity">
                                <Form.Label>Quantity</Form.Label>
                                <Form.Control
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formState.quantity}
                                    onChange={(event) => handleFieldChange('quantity', event.target.value)}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group controlId="purchaseItemWarehouse">
                                <Form.Label>Warehouse</Form.Label>
                                <Form.Select
                                    value={formState.warehouse_id}
                                    onChange={(event) => handleFieldChange('warehouse_id', event.target.value)}
                                    disabled={warehouses.length === 0}
                                >
                                    <option value="">Select warehouse</option>
                                    {warehouses.map((warehouse) => (
                                        <option key={warehouse.id} value={warehouse.id}>
                                            {warehouse.name}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group controlId="purchaseItemDiscount">
                                <Form.Label>Discount %</Form.Label>
                                <Form.Control
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={formState.discount}
                                    onChange={(event) => handleDiscountChange(event.target.value)}
                                    disabled={!selectedProduct}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group controlId="purchaseItemUnitPrice">
                                <Form.Label>Unit Cost</Form.Label>
                                <Form.Control
                                    type="number"
                                    step="0.01"
                                    value={formState.unit_price}
                                    onChange={(event) => handleUnitPriceChange(event.target.value)}
                                    disabled={!selectedProduct}
                                />
                                <Form.Text muted>Currency: {currency}</Form.Text>
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group controlId="purchaseItemNote">
                                <Form.Label>Note</Form.Label>
                                <Form.Control
                                    type="text"
                                    value={formState.note}
                                    onChange={(event) => handleFieldChange('note', event.target.value)}
                                    placeholder="Optional item note"
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                    <div className="sale-form__modal-summary">
                        <div>
                            <span className="sale-form__modal-summary-label">Line total</span>
                            <span className="sale-form__modal-summary-value">{currencyFormatter.format(lineTotal)}</span>
                        </div>
                        <div>
                            <span className="sale-form__modal-summary-label">Discount</span>
                            <span className="sale-form__modal-summary-value">
                                {`${Number(formState.discount || 0).toFixed(2)}%`}
                            </span>
                        </div>
                    </div>
                    {!warehouses.length && (
                        <Alert variant="warning" className="mb-0">
                            No warehouses available. Please create a warehouse before saving items.
                        </Alert>
                    )}
                </Stack>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="outline-secondary" onClick={onHide}>
                    Cancel
                </Button>
                <Button variant="success" onClick={handleSave} disabled={!canSave}>
                    {formState.product_id ? 'Save item' : 'Add item'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
}

PurchaseItemModal.propTypes = {
    show: PropTypes.bool.isRequired,
    onHide: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    initialItem: PropTypes.shape({
        product_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        quantity: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        unit_price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        warehouse_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        discount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        note: PropTypes.string,
    }),
    products: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.number.isRequired,
            name: PropTypes.string.isRequired,
            sku: PropTypes.string,
            purchase_price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            image: PropTypes.string,
            warehouse_quantities: PropTypes.arrayOf(
                PropTypes.shape({
                    warehouse_id: PropTypes.number.isRequired,
                    quantity: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
                })
            ),
        })
    ).isRequired,
    warehouses: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.number.isRequired,
            name: PropTypes.string.isRequired,
        })
    ).isRequired,
    currency: PropTypes.string.isRequired,
    imageBaseUrl: PropTypes.string,
};

PurchaseItemModal.defaultProps = {
    initialItem: null,
    imageBaseUrl: '',
};

export default PurchaseItemModal;

