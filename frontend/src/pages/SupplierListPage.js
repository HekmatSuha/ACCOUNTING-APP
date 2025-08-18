// frontend/src/pages/SupplierListPage.js

import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { Table, Button, Card, Modal, Form, Alert } from 'react-bootstrap';

function SupplierListPage() {
    // State for the list of suppliers
    const [suppliers, setSuppliers] = useState([]);

    // State for the modal form
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentSupplier, setCurrentSupplier] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        open_balance: 0.00
    });

    // State for UI feedback
    const [error, setError] = useState('');

    // Initial data fetch
    useEffect(() => {
        fetchSuppliers();
    }, []);

    const fetchSuppliers = async () => {
        try {
            const response = await axiosInstance.get('/suppliers/');
            setSuppliers(response.data);
        } catch (error) {
            console.error('Failed to fetch suppliers:', error);
            setError('Could not fetch the list of suppliers.');
        }
    };

    // --- HANDLER FUNCTIONS ---

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleShowModal = (supplier = null) => {
        if (supplier) {
            // Editing an existing supplier
            setIsEditing(true);
            setCurrentSupplier(supplier);
            setFormData({
                name: supplier.name,
                email: supplier.email || '',
                phone: supplier.phone || '',
                address: supplier.address || '',
                open_balance: supplier.open_balance
            });
        } else {
            // Adding a new supplier
            setIsEditing(false);
            setCurrentSupplier(null);
            setFormData({ name: '', email: '', phone: '', address: '', open_balance: 0.00 });
        }
        setShowModal(true);
        setError(''); // Clear errors when opening modal
    };

    const handleCloseModal = () => setShowModal(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const url = isEditing ? `/suppliers/${currentSupplier.id}/` : '/suppliers/';
        const method = isEditing ? 'put' : 'post';

        try {
            await axiosInstance[method](url, formData);
            fetchSuppliers(); // Refresh the list
            handleCloseModal(); // Close the modal on success
        } catch (err) {
            console.error('Failed to save supplier:', err.response?.data);
            setError('Failed to save supplier. Please check the form fields.');
        }
    };

    const handleDelete = async (supplierId) => {
        if (window.confirm('Are you sure you want to delete this supplier?')) {
            try {
                await axiosInstance.delete(`/suppliers/${supplierId}/`);
                fetchSuppliers(); // Refresh the list
            } catch (error) {
                console.error('Failed to delete supplier:', error);
                setError('Failed to delete supplier. They might be linked to a purchase.');
            }
        }
    };

    return (
        <>
            <Card>
                <Card.Header className="d-flex justify-content-between align-items-center">
                    <h4>Suppliers</h4>
                    <Button variant="primary" onClick={() => handleShowModal()}>
                        + New Supplier
                    </Button>
                </Card.Header>
                <Card.Body>
                    {error && !showModal && <Alert variant="danger">{error}</Alert>}
                    <Table striped bordered hover responsive>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Open Balance</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {suppliers.map((supplier) => (
                                <tr key={supplier.id}>
                                    <td>{supplier.name}</td>
                                    <td>{supplier.email || 'N/A'}</td>
                                    <td>{supplier.phone || 'N/A'}</td>
                                    <td>${parseFloat(supplier.open_balance).toFixed(2)}</td>
                                    <td>
                                        <Button variant="warning" size="sm" className="me-2" onClick={() => handleShowModal(supplier)}>Edit</Button>
                                        <Button variant="danger" size="sm" onClick={() => handleDelete(supplier.id)}>Delete</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Card.Body>
            </Card>

            {/* Add/Edit Supplier Modal */}
            <Modal show={showModal} onHide={handleCloseModal}>
                <Modal.Header closeButton>
                    <Modal.Title>{isEditing ? 'Edit Supplier' : 'Add New Supplier'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3">
                            <Form.Label>Supplier Name</Form.Label>
                            <Form.Control type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Email</Form.Label>
                            <Form.Control type="email" name="email" value={formData.email} onChange={handleInputChange} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Phone</Form.Label>
                            <Form.Control type="text" name="phone" value={formData.phone} onChange={handleInputChange} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Address</Form.Label>
                            <Form.Control as="textarea" rows={3} name="address" value={formData.address} onChange={handleInputChange} />
                        </Form.Group>
                         <Form.Group className="mb-3">
                            <Form.Label>Opening Balance</Form.Label>
                            <Form.Control type="number" step="0.01" name="open_balance" value={formData.open_balance} onChange={handleInputChange} />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>Close</Button>
                    <Button variant="primary" onClick={handleSubmit}>Save Changes</Button>
                </Modal.Footer>
            </Modal>
        </>
    );
}

export default SupplierListPage;