// frontend/src/pages/ProductFormPage.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Container, Card, Form, Button, Row, Col, Alert, Spinner, Image, Tabs, Tab, InputGroup } from 'react-bootstrap';

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
    const [existingGallery, setExistingGallery] = useState([]);
    const [galleryFiles, setGalleryFiles] = useState([]);
    const [galleryRemovalIds, setGalleryRemovalIds] = useState([]);
    const [error, setError] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [isLoading, setIsLoading] = useState(isEditing);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const objectUrlRef = useRef(null);
    const fileInputRef = useRef(null);
    const galleryInputRef = useRef(null);
    const [derivedProfitMargin, setDerivedProfitMargin] = useState(0);
    const [derivedFinalSalePrice, setDerivedFinalSalePrice] = useState(0);
    const [derivedProfit, setDerivedProfit] = useState(0);
    const [activeSection, setActiveSection] = useState('basic');
    const [isGeneratingSku, setIsGeneratingSku] = useState(false);
    const [isSuggestingPrice, setIsSuggestingPrice] = useState(false);
    const [isFetchingTotalStock, setIsFetchingTotalStock] = useState(false);
    const [totalStock, setTotalStock] = useState(0);
    const [stockError, setStockError] = useState('');
    const galleryObjectUrlsRef = useRef([]);

    const clearGalleryPreviews = useCallback(() => {
        galleryObjectUrlsRef.current.forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch (revocationError) {
                console.error(revocationError);
            }
        });
        galleryObjectUrlsRef.current = [];
    }, []);

    const refreshTotalStock = useCallback(async () => {
        if (!isEditing) {
            setTotalStock(0);
            setStockError('');
            return;
        }

        setIsFetchingTotalStock(true);
        setStockError('');
        try {
            const { data } = await axiosInstance.get(`/products/${id}/total-stock/`);
            const total = parseFloat(data.total_stock);
            setTotalStock(Number.isFinite(total) ? total : 0);
        } catch (stockFetchError) {
            console.error(stockFetchError);
            setStockError('Unable to refresh total stock at this time.');
        } finally {
            setIsFetchingTotalStock(false);
        }
    }, [id, isEditing]);

    useEffect(() => {
        if (isEditing) {
            setIsLoading(true);
            axiosInstance.get(`/products/${id}/`)
                .then(response => {
                    const { id: _removed, image, gallery = [], warehouse_quantities, ...data } = response.data;
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
                    setExistingGallery(Array.isArray(gallery) ? gallery : []);
                    setGalleryFiles([]);
                    setGalleryRemovalIds([]);
                    clearGalleryPreviews();
                    const stockValue = parseFloat(data.stock_quantity ?? 0);
                    setTotalStock(Number.isFinite(stockValue) ? stockValue : 0);
                    setStockError('');
                    setInfoMessage('');
                    if (objectUrlRef.current) {
                        URL.revokeObjectURL(objectUrlRef.current);
                        objectUrlRef.current = null;
                    }
                    setError('');
                    refreshTotalStock();
                })
                .catch(() => setError('Failed to fetch product details.'))
                .finally(() => setIsLoading(false));
        } else {
            setExistingImage(null);
            setImagePreview(null);
            setImageFile(null);
            setExistingGallery([]);
            setGalleryFiles([]);
            setGalleryRemovalIds([]);
            clearGalleryPreviews();
            setFormData({ ...INITIAL_FORM_STATE });
            setTotalStock(0);
            setStockError('');
            setInfoMessage('');
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
                objectUrlRef.current = null;
            }
            setIsLoading(false);
        }
    }, [id, isEditing, refreshTotalStock, clearGalleryPreviews]);

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
        const profit = salePrice - purchasePrice;
        setDerivedProfit(Number.isFinite(profit) ? profit : 0);
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
        setExistingImage(null);
        setInfoMessage('');
    };

    const handleRemoveImage = () => {
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = null;
        }
        setImageFile(null);
        setImagePreview(null);
        setExistingImage(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setInfoMessage('Image removed.');
    };

    const handleGalleryChange = (event) => {
        const files = Array.from(event.target.files || []);
        if (!files.length) {
            return;
        }

        const newEntries = files.map((file, index) => {
            const previewUrl = URL.createObjectURL(file);
            galleryObjectUrlsRef.current.push(previewUrl);
            return {
                tempId: `${file.name}-${Date.now()}-${index}`,
                file,
                previewUrl,
            };
        });

        setGalleryFiles(prev => [...prev, ...newEntries]);
        if (galleryInputRef.current) {
            galleryInputRef.current.value = '';
        }
    };

    const handleRemoveGalleryFile = (tempId) => {
        setGalleryFiles(prev => {
            const entry = prev.find(item => item.tempId === tempId);
            if (entry) {
                try {
                    URL.revokeObjectURL(entry.previewUrl);
                } catch (revocationError) {
                    console.error(revocationError);
                }
                galleryObjectUrlsRef.current = galleryObjectUrlsRef.current.filter(
                    url => url !== entry.previewUrl
                );
            }
            return prev.filter(item => item.tempId !== tempId);
        });
    };

    const handleRemoveExistingGallery = (imageId) => {
        setExistingGallery(prev => prev.filter(item => item.id !== imageId));
        setGalleryRemovalIds(prev => {
            if (prev.includes(imageId)) {
                return prev;
            }
            return [...prev, imageId];
        });
    };

    const handleGenerateSku = async () => {
        setIsGeneratingSku(true);
        setError('');
        try {
            const params = {};
            if (formData.category) {
                params.category = formData.category;
            } else if (formData.name) {
                params.name = formData.name;
            }
            const { data } = await axiosInstance.get('/products/suggest-sku/', { params });
            const updatedForm = { ...formData, sku: data.sku };
            setFormData(updatedForm);
            const errors = validateValues(updatedForm);
            setFieldErrors(errors);
            setInfoMessage('SKU generated automatically.');
        } catch (skuError) {
            console.error(skuError);
            setError('Failed to generate SKU automatically.');
        } finally {
            setIsGeneratingSku(false);
        }
    };

    const handleSuggestPrice = async () => {
        setIsSuggestingPrice(true);
        setError('');
        try {
            const params = { purchase_price: formData.purchase_price || 0 };
            const { data } = await axiosInstance.get('/products/suggest-price/', { params });
            const updatedForm = { ...formData, sale_price: data.suggested_price };
            setFormData(updatedForm);
            const errors = validateValues(updatedForm);
            setFieldErrors(errors);
            setInfoMessage(`Sale price updated using a ${data.margin_percent}% margin suggestion.`);
        } catch (priceError) {
            console.error(priceError);
            setError('Failed to suggest a sale price. Please review the inputs.');
        } finally {
            setIsSuggestingPrice(false);
        }
    };

    useEffect(() => {
        return () => {
            if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
            }
            clearGalleryPreviews();
        };
    }, [clearGalleryPreviews]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationErrors = validateValues(formData);
        if (Object.keys(validationErrors).length > 0) {
            setFieldErrors(validationErrors);
            setError('Please correct the highlighted fields before saving.');
            return;
        }

        setInfoMessage('');
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
        galleryFiles.forEach(entry => {
            submissionData.append('gallery_images', entry.file);
        });
        galleryRemovalIds.forEach(idToRemove => {
            submissionData.append('gallery_remove_ids', idToRemove);
        });
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

    const hasImagePreview = Boolean(imageFile && imagePreview);
    const previewSrc = hasImagePreview ? imagePreview : existingImage;
    const previewAlt = hasImagePreview ? 'Selected product preview' : 'Current product';

    return (
        <Container>
            <Card>
                <Card.Header as="h4">{isEditing ? 'Edit Product' : 'Create New Product'}</Card.Header>
                <Card.Body>
                    {error && <Alert variant="danger">{error}</Alert>}
                    {infoMessage && <Alert variant="success">{infoMessage}</Alert>}
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
                                                    <div className="d-flex gap-2">
                                                        <Form.Control
                                                            type="text"
                                                            name="sku"
                                                            value={formData.sku}
                                                            onChange={handleChange}
                                                            disabled={isFormDisabled}
                                                        />
                                                        <Button
                                                            variant="outline-primary"
                                                            onClick={handleGenerateSku}
                                                            disabled={isFormDisabled || isGeneratingSku}
                                                        >
                                                            {isGeneratingSku ? (
                                                                <Spinner
                                                                    as="span"
                                                                    animation="border"
                                                                    size="sm"
                                                                    role="status"
                                                                    aria-hidden="true"
                                                                />
                                                            ) : (
                                                                'Auto'
                                                            )}
                                                        </Button>
                                                    </div>
                                                    <Form.Text className="text-muted">
                                                        Generate a unique SKU based on the category with one click.
                                                    </Form.Text>
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
                                                    <Form.Label className="d-flex justify-content-between align-items-center">
                                                        <span>
                                                            Sale Price ({formData.currency}) <span className="text-danger">*</span>
                                                        </span>
                                                        <Button
                                                            variant="outline-success"
                                                            size="sm"
                                                            onClick={handleSuggestPrice}
                                                            disabled={isFormDisabled || isSuggestingPrice}
                                                        >
                                                            {isSuggestingPrice ? (
                                                                <Spinner
                                                                    as="span"
                                                                    animation="border"
                                                                    size="sm"
                                                                    role="status"
                                                                    aria-hidden="true"
                                                                />
                                                            ) : (
                                                                'AI Suggest'
                                                            )}
                                                        </Button>
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
                                            <Col md={3}>
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
                                            <Col md={3}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label id="profit-margin-label">Profit Margin (auto)</Form.Label>
                                                    <InputGroup aria-labelledby="profit-margin-label profit-margin-help">
                                                        <InputGroup.Text id="profit-margin-addon">
                                                            <span aria-hidden="true" className="me-2">🧮</span>
                                                            <span className="fw-semibold">Auto</span>
                                                        </InputGroup.Text>
                                                        <div
                                                            className="form-control bg-light text-end"
                                                            role="status"
                                                            aria-live="polite"
                                                            aria-labelledby="profit-margin-label profit-margin-addon profit-margin-help"
                                                        >
                                                            {derivedProfitMargin.toFixed(2)}%
                                                        </div>
                                                    </InputGroup>
                                                    <Form.Text id="profit-margin-help" className="text-muted">
                                                        Calculated as ((Sale - Purchase) / Sale) × 100.
                                                    </Form.Text>
                                                </Form.Group>
                                            </Col>
                                            <Col md={3}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label id="final-sale-price-label">
                                                        Final Sale Price (incl. tax/discount) ({formData.currency})
                                                    </Form.Label>
                                                    <InputGroup aria-labelledby="final-sale-price-label final-sale-price-help">
                                                        <InputGroup.Text id="final-sale-price-addon">
                                                            <span aria-hidden="true" className="me-2">💰</span>
                                                            <span className="fw-semibold">Auto</span>
                                                        </InputGroup.Text>
                                                        <div
                                                            className="form-control bg-light text-end"
                                                            role="status"
                                                            aria-live="polite"
                                                            aria-labelledby="final-sale-price-label final-sale-price-addon final-sale-price-help"
                                                        >
                                                            {formData.currency} {derivedFinalSalePrice.toFixed(2)}
                                                        </div>
                                                    </InputGroup>
                                                    <Form.Text id="final-sale-price-help" className="text-muted">
                                                        Displayed using the selected currency and current tax/discount values.
                                                    </Form.Text>
                                                </Form.Group>
                                            </Col>
                                            <Col md={3}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Auto Profit ({formData.currency})</Form.Label>
                                                    <Form.Control
                                                        type="number"
                                                        readOnly
                                                        value={derivedProfit.toFixed(2)}
                                                    />
                                                    <Form.Text className="text-muted">
                                                        Profit shown as Sale price minus Purchase price.
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
                                                ref={fileInputRef}
                                                disabled={isFormDisabled}
                                            />
                                            <Form.Text className="text-muted">
                                                Supported formats: JPG, PNG, GIF up to 5 MB.
                                            </Form.Text>
                                            {(hasImagePreview || existingImage) && previewSrc && (
                                                <div className="mt-2 d-flex flex-column align-items-start">
                                                    <Image
                                                        src={previewSrc}
                                                        thumbnail
                                                        alt={previewAlt}
                                                        style={{ maxWidth: '150px' }}
                                                    />
                                                    <Button
                                                        variant="outline-danger"
                                                        size="sm"
                                                        className="mt-2"
                                                        onClick={handleRemoveImage}
                                                        disabled={isFormDisabled}
                                                    >
                                                        Remove image
                                                    </Button>
                                                </div>
                                            )}
                                        </Form.Group>
                                        <Form.Group className="mb-3">
                                            <Form.Label>Product Gallery</Form.Label>
                                            <Form.Control
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                onChange={handleGalleryChange}
                                                ref={galleryInputRef}
                                                disabled={isFormDisabled}
                                            />
                                            <Form.Text className="text-muted">
                                                Add multiple images to showcase the product in a gallery.
                                            </Form.Text>
                                            <div className="mt-3 d-flex flex-wrap gap-3">
                                                {existingGallery.map(image => (
                                                    <div key={`existing-${image.id}`} className="position-relative">
                                                        <Image
                                                            src={image.image}
                                                            thumbnail
                                                            alt="Existing product gallery"
                                                            style={{ maxWidth: '120px' }}
                                                        />
                                                        <Button
                                                            variant="outline-danger"
                                                            size="sm"
                                                            className="mt-2"
                                                            onClick={() => handleRemoveExistingGallery(image.id)}
                                                            disabled={isFormDisabled}
                                                        >
                                                            Remove
                                                        </Button>
                                                    </div>
                                                ))}
                                                {galleryFiles.map(entry => (
                                                    <div key={entry.tempId} className="position-relative">
                                                        <Image
                                                            src={entry.previewUrl}
                                                            thumbnail
                                                            alt="New product gallery preview"
                                                            style={{ maxWidth: '120px' }}
                                                        />
                                                        <Button
                                                            variant="outline-danger"
                                                            size="sm"
                                                            className="mt-2"
                                                            onClick={() => handleRemoveGalleryFile(entry.tempId)}
                                                            disabled={isFormDisabled}
                                                        >
                                                            Remove
                                                        </Button>
                                                    </div>
                                                ))}
                                                {existingGallery.length === 0 && galleryFiles.length === 0 && (
                                                    <span className="text-muted small">No gallery images added yet.</span>
                                                )}
                                            </div>
                                            {(existingGallery.length > 0 || galleryFiles.length > 0) && (
                                                <Form.Text className="text-muted d-block mt-2">
                                                    Removed images will be deleted after you save the product.
                                                </Form.Text>
                                            )}
                                        </Form.Group>
                                        <Row>
                                            <Col md={6} lg={4}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Total Stock (read-only)</Form.Label>
                                                    <div className="d-flex gap-2 align-items-center">
                                                        <Form.Control
                                                            type="number"
                                                            step="0.01"
                                                            name="stock_quantity"
                                                            value={totalStock}
                                                            readOnly
                                                            disabled
                                                        />
                                                        {isEditing && (
                                                            <Button
                                                                variant="outline-secondary"
                                                                size="sm"
                                                                onClick={refreshTotalStock}
                                                                disabled={isFormDisabled || isFetchingTotalStock}
                                                            >
                                                                {isFetchingTotalStock ? (
                                                                    <Spinner
                                                                        as="span"
                                                                        animation="border"
                                                                        size="sm"
                                                                        role="status"
                                                                        aria-hidden="true"
                                                                    />
                                                                ) : (
                                                                    'Refresh'
                                                                )}
                                                            </Button>
                                                        )}
                                                    </div>
                                                    {stockError ? (
                                                        <Form.Text className="text-danger">{stockError}</Form.Text>
                                                    ) : (
                                                        <Form.Text className="text-muted">
                                                            Manage inventory levels per warehouse from the Warehouses screen.
                                                        </Form.Text>
                                                    )}
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
