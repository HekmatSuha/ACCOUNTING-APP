import React from 'react';
import { Alert, Badge, Button, Card, Table } from 'react-bootstrap';
import { PencilSquare, Plus, Trash } from 'react-bootstrap-icons';
import ProductSearchSelect from '../ProductSearchSelect';
import { getImageInitial, resolveImageUrl } from '../../utils/image';

function SaleLineItemsTable({
    isOffer,
    products,
    lineItems,
    warehouses,
    hasWarehouses,
    formError,
    onDismissFormError,
    formatCurrency,
    onQuickProductSelect,
    onNewLine,
    quickSearchKey,
    onEditItem,
    onRemoveItem,
    baseApiUrl,
    getProductById,
}) {
    return (
        <Card className="sale-form__items-card">
            <Card.Header>
                <div className="sale-form__items-header">
                    <div>
                        <h5 className="mb-0">Products &amp; Services</h5>
                        <small className="text-muted">
                            Add items from your catalog to this {isOffer ? 'offer' : 'sale'}.
                        </small>
                    </div>
                    <div className="sale-form__quick-add">
                        <div className="sale-form__quick-add-search">
                            <ProductSearchSelect
                                key={quickSearchKey}
                                products={products}
                                value={null}
                                onSelect={onQuickProductSelect}
                                placeholder="Search products to add"
                                imageBaseUrl={baseApiUrl}
                            />
                            <Button
                                type="button"
                                variant="link"
                                className="sale-form__add-new-item"
                                onClick={onNewLine}
                                disabled={!hasWarehouses}
                            >
                                Add new item
                            </Button>
                        </div>
                        <Button
                            type="button"
                            className="mt-2 mt-sm-0"
                            variant="outline-primary"
                            onClick={onNewLine}
                            disabled={!hasWarehouses}
                        >
                            <Plus className="me-1" /> New Line
                        </Button>
                    </div>
                </div>
            </Card.Header>
            <Card.Body>
                {!hasWarehouses && (
                    <Alert variant="warning" className="mb-3">
                        No warehouses available. Please create a warehouse before recording sales.
                    </Alert>
                )}
                {formError && (
                    <Alert variant="danger" className="mb-3" onClose={onDismissFormError} dismissible>
                        {formError}
                    </Alert>
                )}
                <div className="table-responsive">
                    <Table hover borderless className="sale-items-table align-middle">
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Warehouse</th>
                                <th className="text-center">Stock</th>
                                <th className="text-center">Quantity</th>
                                <th className="text-end">Unit Price</th>
                                <th className="text-center">Discount</th>
                                <th className="text-end">Line Total</th>
                                <th className="text-end">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {lineItems.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="text-center text-muted py-4">
                                        Add products using the search above to build this {isOffer ? 'offer' : 'sale'}.
                                    </td>
                                </tr>
                            )}
                            {lineItems.map((item, index) => {
                                const product = getProductById(item.product_id);
                                const warehouse = warehouses.find((w) => w.id === Number(item.warehouse_id));
                                const warehouseQuantity = product?.warehouse_quantities?.find(
                                    (stock) => stock.warehouse_id === Number(item.warehouse_id)
                                );
                                const availableStock = warehouseQuantity ? Number(warehouseQuantity.quantity) : null;
                                const discountLabel = item.discount ? `${Number(item.discount).toFixed(2)}%` : '—';
                                const lineTotal = Number(item.quantity) * Number(item.unit_price || 0);
                                const resolvedImage = resolveImageUrl(product?.image, baseApiUrl);
                                const imageInitial = getImageInitial(product?.name);
                                const metaDetails = [];

                                if (item.note) {
                                    metaDetails.push(<span key="note">Note: {item.note}</span>);
                                }

                                return (
                                    <tr key={`${item.product_id}-${index}`}>
                                        <td>
                                            <div className="sale-items-table__product product-name-cell">
                                                <div className="product-name-cell__image">
                                                    {resolvedImage ? (
                                                        <img src={resolvedImage} alt={product?.name || 'Product preview'} />
                                                    ) : (
                                                        <span>{imageInitial}</span>
                                                    )}
                                                </div>
                                                <div className="sale-items-table__info product-name-cell__info product-name-cell__body">
                                                    <div className="product-name-cell__header">
                                                        <div className="sale-items-table__name product-name-cell__name">
                                                            {product?.name || 'Unnamed product'}
                                                        </div>
                                                        {product?.sku && (
                                                            <span className="product-name-cell__badge">SKU {product.sku}</span>
                                                        )}
                                                    </div>
                                                    {metaDetails.length > 0 && (
                                                        <div className="sale-items-table__meta product-name-cell__meta">
                                                            {metaDetails}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            {warehouse ? <span>{warehouse.name}</span> : <span className="text-muted">No warehouse</span>}
                                        </td>
                                        <td className="text-center">
                                            {product ? (
                                                <Badge bg={availableStock && availableStock > 0 ? 'success' : 'danger'}>
                                                    {availableStock !== null ? `${availableStock}` : 'No data'}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted">Select a product</span>
                                            )}
                                        </td>
                                        <td className="text-center">{Number(item.quantity)}</td>
                                        <td className="text-end">{formatCurrency(item.unit_price)}</td>
                                        <td className="text-center">{discountLabel}</td>
                                        <td className="text-end">{formatCurrency(lineTotal)}</td>
                                        <td className="text-end">
                                            <div className="sale-items-table__actions">
                                                <Button
                                                    variant="outline-secondary"
                                                    size="sm"
                                                    onClick={() => onEditItem(index)}
                                                    aria-label="Edit line item"
                                                >
                                                    <PencilSquare />
                                                </Button>
                                                <Button
                                                    variant="outline-danger"
                                                    size="sm"
                                                    onClick={() => onRemoveItem(index)}
                                                    aria-label="Remove line item"
                                                >
                                                    <Trash />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Table>
                </div>
            </Card.Body>
        </Card>
    );
}

export default SaleLineItemsTable;
