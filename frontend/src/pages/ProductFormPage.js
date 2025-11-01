// frontend/src/pages/ProductFormPage.js

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Container, Card, Form, Button, Row, Col, Alert, Spinner, Image, Tabs, Tab } from 'react-bootstrap';

const INITIAL_FORM_STATE = {
    name: '',
    description: '',
    sku: '',
    category: '',
    subcategory: '',
    brand: '',
    barcode: '',
    unit_of_measure: '',
    tags: '',
    currency: 'USD',
    purchase_price: 0.00,
    sale_price: 0.00,
    tax_rate: 0.0,
    discount_rate: 0.0,
    wholesale_price: '',
    minimum_sale_price: '',
    stock_quantity: 0,
};

function ProductFormPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = Boolean(id);

    const [formData, setFormData] = useState(() => ({ ...INITIAL_FORM_STATE }));
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [existingImage, setExistingImage] = useState(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(isEditing);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const objectUrlRef = useRef(null);
    const [derivedProfitMargin, setDerivedProfitMargin] = useState(0);
    const [derivedFinalSalePrice, setDerivedFinalSalePrice] = useState(0);
    const [activeSection, setActiveSection] = useState('basic');

    useEffect(() => {
        if (isEditing) {
            setIsLoading(true);
            axiosInstance.get(`/products/${id}/`)
                .then(response => {
                    const { id: _removed, image, warehouse_quantities, ...data } = response.data;
                    const numericFields = ['purchase_price', 'sale_price', 'tax_rate', 'discount_rate', 'stock_quantity'];
                    const optionalNumericFields = ['wholesale_price', 'minimum_sale_price'];
                    const normalizedData = Object.keys(INITIAL_FORM_STATE).reduce((acc, key) => {
                        const value = data[key];
                        if (value === null || value === undefined) {
                            if (numericFields.includes(key)) {
                                acc[key] = INITIAL_FORM_STATE[key];
                            } else if (optionalNumericFields.includes(key)) {
                                acc[key] = '';
                            } else {
                                acc[key] = INITIAL_FORM_STATE[key] ?? '';
                            }
                        } else {
                            acc[key] = value;
                        }
                        return acc;
                    }, { ...INITIAL_FORM_STATE });
                    setFormData(normalizedData);
                    setExistingImage(image || null);
                    setImagePreview(null);
                    setImageFile(null);
                    if (objectUrlRef.current) {
                        URL.revokeObjectURL(objectUrlRef.current);
                        objectUrlRef.current = null;
                    }
                    setError('');
                })
                .catch(() => setError('Failed to fetch product details.'))
                .finally(() => setIsLoading(false));
        } else {
            setExistingImage(null);
            setImagePreview(null);
            setImageFile(null);
            setFormData({ ...INITIAL_FORM_STATE });
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
            setIsLoading(false);
        }
    }, [id, isEditing]);

    useEffect(() => {
        const purchasePrice = parseFloat(formData.purchase_price) || 0;
        const salePrice = parseFloat(formData.sale_price) || 0;
        const taxRate = parseFloat(formData.tax_rate) || 0;
        const discountRate = parseFloat(formData.discount_rate) || 0;
        const margin = salePrice > 0 ? ((salePrice - purchasePrice) / salePrice) * 100 : 0;
        const taxMultiplier = 1 + taxRate / 100;
        const discountMultiplier = Math.max(0, 1 - discountRate / 100);
        const finalSale = salePrice * taxMultiplier * discountMultiplier;
        setDerivedProfitMargin(Number.isFinite(margin) ? margin : 0);
        setDerivedFinalSalePrice(Number.isFinite(finalSale) ? finalSale : 0);
    }, [formData.purchase_price, formData.sale_price, formData.tax_rate, formData.discount_rate]);

    const validateValues = (values) => {
        const errors = {};
        const purchasePrice = parseFloat(values.purchase_price);
        const salePrice = parseFloat(values.sale_price);
        const taxRate = parseFloat(values.tax_rate);
        const discountRate = parseFloat(values.discount_rate);
        const wholesalePrice = values.wholesale_price === '' ? null : parseFloat(values.wholesale_price);
        const minimumSalePrice = values.minimum_sale_price === '' ? null : parseFloat(values.minimum_sale_price);

        if (Number.isNaN(purchasePrice) || purchasePrice < 0) {
            errors.purchase_price = 'Purchase price must be zero or greater.';
        }

        if (Number.isNaN(salePrice) || salePrice <= 0) {
            errors.sale_price = 'Sale price must be greater than zero.';
        } else if (!errors.purchase_price && !Number.isNaN(purchasePrice) && salePrice < purchasePrice) {
            errors.sale_price = 'Sale price must not be lower than the purchase price.';
        }

        if (!Number.isNaN(taxRate) && (taxRate < 0 || taxRate > 100)) {
            errors.tax_rate = 'Tax rate must be between 0 and 100.';
        }

        if (!Number.isNaN(discountRate) && (discountRate < 0 || discountRate > 100)) {
            errors.discount_rate = 'Discount must be between 0 and 100.';
        }

        if (wholesalePrice !== null && (Number.isNaN(wholesalePrice) || wholesalePrice < 0)) {
            errors.wholesale_price = 'Wholesale price must be zero or greater.';
        }

        if (minimumSalePrice !== null) {
            if (Number.isNaN(minimumSalePrice) || minimumSalePrice < 0) {
                errors.minimum_sale_price = 'Minimum sale price must be zero or greater.';
            } else if (!errors.sale_price && !Number.isNaN(salePrice) && salePrice < minimumSalePrice) {
                errors.sale_price = 'Sale price must be at least the minimum sale price.';
            }
        }

        return errors;
    };

    const handleChange = (e) => {
        const { name } = e.target;
        let { value } = e.target;

        const autoZeroFields = ['purchase_price', 'sale_price', 'tax_rate', 'discount_rate'];
        if (autoZeroFields.includes(name) && value === '') {
            value = 0;
        }

        const updatedForm = { ...formData, [name]: value };
        setFormData(updatedForm);
        const errors = validateValues(updatedForm);
        setFieldErrors(errors);
        if (Object.keys(errors).length === 0) {
            setError('');
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) {
            return;
        }

        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }

        const previewUrl = URL.createObjectURL(file);
        objectUrlRef.current = previewUrl;
        setImageFile(file);
        setImagePreview(previewUrl);
    };

    useEffect(() => {
        return () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
            }
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationErrors = validateValues(formData);
        if (Object.keys(validationErrors).length > 0) {
            setFieldErrors(validationErrors);
            setError('Please correct the highlighted fields before saving.');
            return;
        }

        setError('');

        const submissionData = new FormData();
        Object.keys(formData).forEach(key => {
            if (['image', 'id', 'stock_quantity', 'profit_margin', 'final_sale_price'].includes(key)) {
                return;
            }
            const value = formData[key];
            if (['wholesale_price', 'minimum_sale_price'].includes(key) && value === '') {
                return;
            }
            submissionData.append(key, value);
        });
        if (imageFile) {
            submissionData.append('image', imageFile);
        }
        const apiCall = isEditing
            ? axiosInstance.put(`/products/${id}/`, submissionData)
            : axiosInstance.post('/products/', submissionData);

        setIsSubmitting(true);
        try {
            await apiCall;
            navigate('/inventory');
        } catch (err) {
            setError('Failed to save product. Please check the fields.');
            console.error(err.response?.data);
        } finally {
            setIsSubmitting(false);
        }
    };

    const isFormDisabled = isLoading || isSubmitting;

    return (
        <Container>
            <Card>
                <Card.Header as="h4">{isEditing ? 'Edit Product' : 'Create New Product'}</Card.Header>
                <Card.Body>
                    {error && <Alert variant="danger">{error}</Alert>}
                    {isLoading ? (
                        <div className="d-flex justify-content-center py-5">
                            <Spinner animation="border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </Spinner>
                        </div>
                    ) : (
                        <Form onSubmit={handleSubmit}>
                            <Tabs
                                id="product-form-tabs"
                                activeKey={activeSection}
                                onSelect={(key) => setActiveSection(key || 'basic')}
                                className="mb-3"
                                variant="pills"
                                justify
                            >
                                <Tab eventKey="basic" title="Basic Information" mountOnEnter={false} unmountOnExit={false}>
                                        <Row>
                                            <Col md={8}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Product Name <span className="text-danger">*</span></Form.Label>
                                                    <Form.Control type="text" name="name" value={formData.name} onChange={handleChange} required disabled={isFormDisabled} />
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>SKU (Stock Keeping Unit)</Form.Label>
                                                    <Form.Control type="text" name="sku" value={formData.sku} onChange={handleChange} disabled={isFormDisabled} />
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Description</Form.Label>
                                            <Form.Control as="textarea" rows={3} name="description" value={formData.description} onChange={handleChange} disabled={isFormDisabled} />
                                        </Form.Group>
                                </Tab>
                                <Tab eventKey="categorization" title="Categorization & Metadata" mountOnEnter={false} unmountOnExit={false}>
                                        <Row>
                                            <Col md={6}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Category</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        name="category"
                                                        value={formData.category}
                                                        onChange={handleChange}
                                                        placeholder="e.g., Electronics"
                                                        disabled={isFormDisabled}
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col md={6}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Subcategory</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        name="subcategory"
                                                        value={formData.subcategory}
                                                        onChange={handleChange}
                                                        placeholder="e.g., Mobile Phones"
                                                        disabled={isFormDisabled}
                                                    />
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col md={6}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Brand / Manufacturer</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        name="brand"
                                                        value={formData.brand}
                                                        onChange={handleChange}
                                                        placeholder="e.g., Acme Corp"
                                                        disabled={isFormDisabled}
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col md={6}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Unit of Measure (UOM)</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        name="unit_of_measure"
                                                        value={formData.unit_of_measure}
                                                        onChange={handleChange}
                                                        placeholder="e.g., pcs, kg, liters"
                                                        disabled={isFormDisabled}
                                                    />
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col md={6}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Barcode / QR Code</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        name="barcode"
                                                        value={formData.barcode}
                                                        onChange={handleChange}
                                                        placeholder="Scan or enter barcode"
                                                        disabled={isFormDisabled}
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col md={6}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Tags / Keywords</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        name="tags"
                                                        value={formData.tags}
                                                        onChange={handleChange}
                                                        placeholder="e.g., featured, summer"
                                                        disabled={isFormDisabled}
                                                    />
                                                    <Form.Text className="text-muted">
                                                        Separate multiple tags with commas for easier filtering.
                                                    </Form.Text>
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                </Tab>
                                <Tab eventKey="pricing" title="Pricing & Taxes" mountOnEnter={false} unmountOnExit={false}>
                                        <Row>
                                            <Col md={4}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Currency</Form.Label>
                                                    <Form.Select
                                                        name="currency"
                                                        value={formData.currency}
                                                        onChange={handleChange}
                                                        disabled={isFormDisabled}
                                                    >
                                                        <option value="USD">USD — US Dollar</option>
                                                        <option value="EUR">EUR — Euro</option>
                                                        <option value="GBP">GBP — British Pound</option>
                                                        <option value="KZT">KZT — Kazakhstani Tenge</option>
                                                        <option value="CAD">CAD — Canadian Dollar</option>
                                                        <option value="AUD">AUD — Australian Dollar</option>
                                                    </Form.Select>
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Tax / VAT (%)</Form.Label>
                                                    <Form.Control
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                        name="tax_rate"
                                                        value={formData.tax_rate}
                                                        onChange={handleChange}
                                                        isInvalid={Boolean(fieldErrors.tax_rate)}
                                                        disabled={isFormDisabled}
                                                    />
                                                    <Form.Control.Feedback type="invalid">
                                                        {fieldErrors.tax_rate}
                                                    </Form.Control.Feedback>
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Discount (%)</Form.Label>
                                                    <Form.Control
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        max="100"
                                                        name="discount_rate"
                                                        value={formData.discount_rate}
                                                        onChange={handleChange}
                                                        isInvalid={Boolean(fieldErrors.discount_rate)}
                                                        disabled={isFormDisabled}
                                                    />
                                                    <Form.Control.Feedback type="invalid">
                                                        {fieldErrors.discount_rate}
                                                    </Form.Control.Feedback>
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col md={4}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>
                                                        Purchase Price ({formData.currency})
                                                    </Form.Label>
                                                    <Form.Control
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        name="purchase_price"
                                                        value={formData.purchase_price}
                                                        onChange={handleChange}
                                                        isInvalid={Boolean(fieldErrors.purchase_price)}
                                                        disabled={isFormDisabled}
                                                    />
                                                    <Form.Control.Feedback type="invalid">
                                                        {fieldErrors.purchase_price}
                                                    </Form.Control.Feedback>
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>
                                                        Sale Price ({formData.currency}) <span className="text-danger">*</span>
                                                    </Form.Label>
                                                    <Form.Control
                                                        type="number"
                                                        step="0.01"
                                                        min="0.01"
                                                        name="sale_price"
                                                        value={formData.sale_price}
                                                        onChange={handleChange}
                                                        required
                                                        isInvalid={Boolean(fieldErrors.sale_price)}
                                                        disabled={isFormDisabled}
                                                    />
                                                    <Form.Control.Feedback type="invalid">
                                                        {fieldErrors.sale_price}
                                                    </Form.Control.Feedback>
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Wholesale Price ({formData.currency})</Form.Label>
                                                    <Form.Control
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        name="wholesale_price"
                                                        value={formData.wholesale_price}
                                                        onChange={handleChange}
                                                        isInvalid={Boolean(fieldErrors.wholesale_price)}
                                                        disabled={isFormDisabled}
                                                    />
                                                    <Form.Control.Feedback type="invalid">
                                                        {fieldErrors.wholesale_price}
                                                    </Form.Control.Feedback>
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col md={4}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Minimum Sale Price ({formData.currency})</Form.Label>
                                                    <Form.Control
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        name="minimum_sale_price"
                                                        value={formData.minimum_sale_price}
                                                        onChange={handleChange}
                                                        isInvalid={Boolean(fieldErrors.minimum_sale_price)}
                                                        disabled={isFormDisabled}
                                                    />
                                                    <Form.Control.Feedback type="invalid">
                                                        {fieldErrors.minimum_sale_price}
                                                    </Form.Control.Feedback>
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Profit Margin (auto)</Form.Label>
                                                    <Form.Control
                                                        type="number"
                                                        readOnly
                                                        value={derivedProfitMargin.toFixed(2)}
                                                    />
                                                    <Form.Text className="text-muted">Calculated as ((Sale - Purchase) / Sale) × 100.</Form.Text>
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>
                                                        Final Sale Price (incl. tax/discount) ({formData.currency})
                                                    </Form.Label>
                                                    <Form.Control
                                                        type="number"
                                                        readOnly
                                                        value={derivedFinalSalePrice.toFixed(2)}
                                                    />
                                                    <Form.Text className="text-muted">
                                                        Displayed using the selected currency and current tax/discount values.
                                                    </Form.Text>
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                </Tab>
                                <Tab eventKey="inventory" title="Inventory & Media" mountOnEnter={false} unmountOnExit={false}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Product Image</Form.Label>
                                            <Form.Control
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageChange}
                                                disabled={isFormDisabled}
                                            />
                                            <Form.Text className="text-muted">
                                                Supported formats: JPG, PNG, GIF up to 5 MB.
                                            </Form.Text>
                                            {imageFile && imagePreview && (
                                                <div className="mt-2">
                                                    <Image
                                                        src={imagePreview}
                                                        thumbnail
                                                        alt="Selected product preview"
                                                        style={{ maxWidth: '150px' }}
                                                    />
                                                </div>
                                            )}
                                            {!imageFile && existingImage && (
                                                <div className="mt-2">
                                                    <Image
                                                        src={existingImage}
                                                        thumbnail
                                                        alt="Current product"
                                                        style={{ maxWidth: '150px' }}
                                                    />
                                                </div>
                                            )}
                                        </Form.Group>
                                        <Row>
                                            <Col md={6} lg={4}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Total Stock (read-only)</Form.Label>
                                                    <Form.Control
                                                        type="number"
                                                        step="0.01"
                                                        name="stock_quantity"
                                                        value={formData.stock_quantity}
                                                        readOnly
                                                        disabled
                                                    />
                                                    <Form.Text className="text-muted">
                                                        Manage inventory levels per warehouse from the Warehouses screen.
                                                    </Form.Text>
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                </Tab>
                            </Tabs>
                            <div className="d-flex flex-column flex-sm-row mt-3">
                                <Button variant="secondary" onClick={() => navigate('/inventory')} className="me-sm-2 mb-2 mb-sm-0">Cancel</Button>
                                <Button variant="primary" type="submit" disabled={isFormDisabled}>
                                    {isSubmitting && (
                                        <Spinner
                                            as="span"
                                            animation="border"
                                            size="sm"
                                            role="status"
                                            aria-hidden="true"
                                            className="me-2"
                                        />
                                    )}
                                    {isSubmitting ? 'Saving…' : 'Save Product'}
                                </Button>
                            </div>
                        </Form>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
}

export default ProductFormPage;
