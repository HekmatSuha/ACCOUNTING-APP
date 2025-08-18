// frontend/src/components/CategoryManagerModal.js

import React, { useState } from 'react';
import { Modal, Button, Form, Alert, ListGroup, InputGroup } from 'react-bootstrap';
import axiosInstance from '../utils/axiosInstance';
import { FaTrash } from 'react-icons/fa';

function CategoryManagerModal({ show, handleClose, categories, onUpdate }) {
    const [newCategoryName, setNewCategoryName] = useState('');
    const [error, setError] = useState('');

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) {
            setError('Category name cannot be empty.');
            return;
        }
        try {
            setError('');
            await axiosInstance.post('/expense-categories/', { name: newCategoryName });
            setNewCategoryName(''); // Clear input
            onUpdate(); // Refresh the category list in the parent component
        } catch (err) {
            console.error('Failed to add category:', err.response?.data);
            setError(err.response?.data?.name?.[0] || 'Failed to add category.');
        }
    };

    const handleDeleteCategory = async (categoryId) => {
        if (window.confirm('Are you sure you want to delete this category? This cannot be undone.')) {
            try {
                await axiosInstance.delete(`/expense-categories/${categoryId}/`);
                onUpdate(); // Refresh list
            } catch (err) {
                console.error('Failed to delete category:', err);
                setError('Could not delete category. It might be in use by an expense.');
            }
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered>
            <Modal.Header closeButton>
                <Modal.Title>Manage Expense Categories</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {error && <Alert variant="danger" onClose={() => setError('')} dismissible>{error}</Alert>}
                
                <h5>Add New Category</h5>
                <InputGroup className="mb-3">
                    <Form.Control
                        placeholder="e.g., Office Supplies"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                    />
                    <Button variant="primary" onClick={handleAddCategory}>
                        Add
                    </Button>
                </InputGroup>

                <hr />

                <h5>Existing Categories</h5>
                <ListGroup>
                    {categories.map(cat => (
                        <ListGroup.Item key={cat.id} className="d-flex justify-content-between align-items-center">
                            {cat.name}
                            <Button variant="outline-danger" size="sm" onClick={() => handleDeleteCategory(cat.id)}>
                                <FaTrash />
                            </Button>
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>
                    Done
                </Button>
            </Modal.Footer>
        </Modal>
    );
}

export default CategoryManagerModal;