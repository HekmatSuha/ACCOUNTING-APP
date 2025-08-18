// frontend/src/pages/ProductListPage.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { Table, Button, Card, Spinner } from 'react-bootstrap';
import { Plus } from 'react-bootstrap-icons';

function ProductListPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
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

    return (
        <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
                <h4>Inventory / Products</h4>
                <Button variant="primary" onClick={() => navigate('/inventory/new')}>
                    <Plus size={20} /> New Product
                </Button>
            </Card.Header>
            <Card.Body>
                <Table striped bordered hover responsive>
                    <thead className="table-dark">
                        <tr>
                            <th>SKU</th>
                            <th>Name</th>
                            <th>Stock Quantity</th>
                            <th>Sale Price</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" className="text-center"><Spinner animation="border" /></td></tr>
                        ) : products.length > 0 ? (
                            products.map(product => (
                                <tr key={product.id}>
                                    <td>{product.sku || 'N/A'}</td>
                                    <td>{product.name}</td>
                                    <td>{product.stock_quantity}</td>
                                    <td>{formatCurrency(product.sale_price)}</td>
                                    <td>
                                        <Button variant="info" size="sm" onClick={() => navigate(`/inventory/edit/${product.id}`)}>
                                            Edit
                                        </Button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="5" className="text-center">No products found.</td></tr>
                        )}
                    </tbody>
                </Table>
            </Card.Body>
        </Card>
    );
}

export default ProductListPage;