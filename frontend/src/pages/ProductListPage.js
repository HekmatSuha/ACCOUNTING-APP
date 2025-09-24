// frontend/src/pages/ProductListPage.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Table, Button, Card, Spinner, Image, Modal } from 'react-bootstrap';
import { Plus } from 'react-bootstrap-icons';
import '../styles/datatable.css';

const API_BASE_URL = 'http://127.0.0.1:8000';

function ProductListPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await axiosInstance.get('/products/');
                setProducts(response.data);
            } catch (error) {
                console.error("Failed to fetch products:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const handleImageClick = (image) => {
        const src = image.startsWith('http') ? image : `${API_BASE_URL}${image}`;
        setSelectedImage(src);
        setShowImageModal(true);
    };

    const handleCloseModal = () => {
        setShowImageModal(false);
        setSelectedImage(null);
    };

    return (
        <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
                <h4>Inventory / Products</h4>
                <Button variant="primary" onClick={() => navigate('/inventory/new')}>
                    <Plus size={20} /> New Product
                </Button>
            </Card.Header>
            <Card.Body>
                <div className="data-table-container">
                    <Table responsive className="data-table">
                        <thead>
                            <tr>
                                <th>Image</th>
                                <th>SKU</th>
                                <th>Name</th>
                                <th>Stock Quantity</th>
                                <th>Warehouse Stock</th>
                                <th>Sale Price</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="data-table-status">
                                        <Spinner animation="border" />
                                    </td>
                                </tr>
                            ) : products.length > 0 ? (
                                products.map(product => (
                                    <tr key={product.id}>
                                        <td>
                                            {product.image && (
                                                <Image
                                                    src={
                                                        product.image.startsWith('http')
                                                            ? product.image
                                                            : `${API_BASE_URL}${product.image}`
                                                    }
                                                    rounded
                                                    width={50}
                                                    height={50}
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => handleImageClick(product.image)}
                                                />
                                            )}
                                        </td>
                                        <td>{product.sku || 'N/A'}</td>
                                        <td>{product.name}</td>
                                        <td>{product.stock_quantity}</td>
                                        <td>
                                            {product.warehouse_quantities && product.warehouse_quantities.length > 0 ? (
                                                product.warehouse_quantities.map((entry) => (
                                                    <div key={`${product.id}-${entry.warehouse_id}`}>
                                                        <strong>{entry.warehouse_name || 'Warehouse'}:</strong>{' '}
                                                        {entry.quantity}
                                                    </div>
                                                ))
                                            ) : (
                                                <span className="text-muted">No warehouse data</span>
                                            )}
                                        </td>
                                        <td>{formatCurrency(product.sale_price)}</td>
                                        <td>
                                            <Button variant="info" size="sm" onClick={() => navigate(`/inventory/edit/${product.id}`)}>
                                                Edit
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="7" className="data-table-empty">No products found.</td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </div>
            </Card.Body>
            <Modal show={showImageModal} onHide={handleCloseModal} centered>
                <Modal.Body className="text-center">
                    {selectedImage && (
                        <img src={selectedImage} alt="Product" className="img-fluid" />
                    )}
                </Modal.Body>
            </Modal>
        </Card>
    );
}

export default ProductListPage;