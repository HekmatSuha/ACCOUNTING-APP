// frontend/src/pages/ProductFormPage.js

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Container, Card, Form, Button, Row, Col, Alert, Spinner, Image } from 'react-bootstrap';

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
    purchase_price: 0.00,
    sale_price: 0.00,
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

    useEffect(() => {
        if (isEditing) {
            setIsLoading(true);
            axiosInstance.get(`/products/${id}/`)
                .then(response => {
                    const { id: _removed, image, warehouse_quantities, ...data } = response.data;
                    const numericFields = ['purchase_price', 'sale_price', 'stock_quantity'];
                    const normalizedData = Object.keys(INITIAL_FORM_STATE).reduce((acc, key) => {
                        const value = data[key];
                        if (value === null || value === undefined) {
                            acc[key] = numericFields.includes(key) ? INITIAL_FORM_STATE[key] : '';
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

    const validateValues = (values) => {
        const errors = {};
        const purchasePrice = parseFloat(values.purchase_price);
        const salePrice = parseFloat(values.sale_price);

        if (Number.isNaN(purchasePrice) || purchasePrice < 0) {
            errors.purchase_price = 'Purchase price must be zero or greater.';
        }

        if (Number.isNaN(salePrice) || salePrice <= 0) {
            errors.sale_price = 'Sale price must be greater than zero.';
        } else if (!errors.purchase_price && !Number.isNaN(purchasePrice) && salePrice < purchasePrice) {
            errors.sale_price = 'Sale price must not be lower than the purchase price.';
        }

        return errors;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
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
            if (key !== 'image' && key !== 'id' && key !== 'stock_quantity') {
                submissionData.append(key, formData[key]);
            }
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
                                <Col md={4}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Purchase Price ($)</Form.Label>
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
                                        <Form.Label>Sale Price ($) <span className="text-danger">*</span></Form.Label>
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
                            <Button variant="secondary" onClick={() => navigate('/inventory')} className="me-2">Cancel</Button>
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
                        </Form>
                    )}
                </Card.Body>
            </Card>
        </Container>
    );
}

export default ProductFormPage;