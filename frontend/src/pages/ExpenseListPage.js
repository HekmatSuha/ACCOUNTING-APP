// frontend/src/pages/ExpenseListPage.js

import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { Table, Button, Card, Modal, Form, Alert, Row, Col, ListGroup, InputGroup } from 'react-bootstrap';
import { FaTrash, FaEdit } from 'react-icons/fa';
import ActionMenu from '../components/ActionMenu';
import { formatCurrency } from '../utils/format';
import { getBaseCurrency, loadBaseCurrency } from '../config/currency';

// This is the new, self-contained component for managing categories
const CategoryManagerModal = ({ show, handleClose, categories, onUpdate }) => {
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
            setNewCategoryName('');
            onUpdate(); // This refreshes the category list on the main page
        } catch (err) {
            setError(err.response?.data?.name?.[0] || 'A category with this name already exists.');
        }
    };

    const handleDeleteCategory = async (categoryId) => {
        if (window.confirm('Are you sure? Deleting a category will not delete its expenses, but they will become uncategorized.')) {
            try {
                await axiosInstance.delete(`/expense-categories/${categoryId}/`);
                onUpdate(); // Refresh list
            } catch (err) {
                setError('Could not delete category. It might be protected.');
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
                        placeholder="e.g., Rent, Utilities..."
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                    />
                    <Button variant="primary" onClick={handleAddCategory}>Add</Button>
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
                <Button variant="secondary" onClick={handleClose}>Done</Button>
            </Modal.Footer>
        </Modal>
    );
};

const getTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

function ExpenseListPage() {
    const [expenses, setExpenses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentExpense, setCurrentExpense] = useState(null);
    const [showCategoryModal, setShowCategoryModal] = useState(false); // State for the new modal
    const [baseCurrency, setBaseCurrency] = useState(getBaseCurrency());
    const [formData, setFormData] = useState({
        amount: '',
        expense_date: getTodayDate(),
        description: '',
        category: '',
        account: ''
    });
    const [error, setError] = useState('');

    const fetchData = async () => {
        try {
            const [expensesRes, categoriesRes, accountsRes] = await Promise.all([
                axiosInstance.get('/expenses/'),
                axiosInstance.get('/expense-categories/'),
                axiosInstance.get('/accounts/')
            ]);
            setExpenses(expensesRes.data);
            setCategories(categoriesRes.data);
            setAccounts(accountsRes.data);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            setError('Could not fetch expenses, categories, or accounts.');
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        loadBaseCurrency().then(setBaseCurrency);
    }, []);

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleShowModal = (expense = null) => {
        if (expense) {
            setIsEditing(true);
            setCurrentExpense(expense);
            setFormData({
                amount: expense.amount,
                expense_date: expense.expense_date,
                description: expense.description || '',
                category: expense.category || '',
                account: expense.account || ''
            });
        } else {
            setIsEditing(false);
            setCurrentExpense(null);
            setFormData({
                amount: '',
                expense_date: getTodayDate(),
                description: '',
                category: '',
                account: ''
            });
        }
        setShowModal(true);
        setError('');
    };

    const handleCloseModal = () => setShowModal(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const url = isEditing ? `/expenses/${currentExpense.id}/` : '/expenses/';
        const method = isEditing ? 'put' : 'post';
        const dataToSubmit = {
            ...formData,
            category: formData.category ? parseInt(formData.category) : null,
            account: formData.account ? parseInt(formData.account) : null,
        };

        try {
            await axiosInstance[method](url, dataToSubmit);
            fetchData();
            handleCloseModal();
        } catch (err) {
            console.error('Failed to save expense:', err.response?.data);
            setError('Failed to save expense. Please check your input.');
        }
    };

    const handleDelete = async (expenseId) => {
        if (window.confirm('Are you sure you want to delete this expense?')) {
            try {
                await axiosInstance.delete(`/expenses/${expenseId}/`);
                fetchData();
            } catch (error) {
                console.error('Failed to delete expense:', error);
                setError('Failed to delete expense.');
            }
        }
    };

    return (
        <>
            <Card>
                <Card.Header className="d-flex justify-content-between align-items-center">
                    <h4>Expenses</h4>
                    <div>
                        {/* Button to open the new category manager */}
                        <Button variant="secondary" className="me-2" onClick={() => setShowCategoryModal(true)}>
                            Manage Categories
                        </Button>
                        <Button variant="primary" onClick={() => handleShowModal()}>
                            + New Expense
                        </Button>
                    </div>
                </Card.Header>
                <Card.Body>
                    <Table striped bordered hover responsive>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Category</th>
                                <th>Account</th>
                                <th>Description</th>
                                <th>Amount</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.map((expense) => (
                                <tr key={expense.id}>
                                    <td>{expense.expense_date}</td>
                                    <td>{expense.category_name || 'Uncategorized'}</td>
                                    <td>{expense.account_name || 'N/A'}</td>
                                    <td>{expense.description}</td>
                                    <td>{formatCurrency(expense.amount, expense.account_currency || baseCurrency)}</td>
                                    <td className="text-nowrap">
                                        <ActionMenu
                                            actions={[
                                                {
                                                    label: 'Edit Expense',
                                                    icon: <FaEdit />,
                                                    onClick: () => handleShowModal(expense),
                                                },
                                                {
                                                    label: 'Delete Expense',
                                                    icon: <FaTrash />,
                                                    variant: 'text-danger',
                                                    onClick: () => handleDelete(expense.id),
                                                },
                                            ]}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Card.Body>
            </Card>

            <Modal show={showModal} onHide={handleCloseModal}>
                <Modal.Header closeButton>
                    <Modal.Title>{isEditing ? 'Edit Expense' : 'Add New Expense'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Form onSubmit={handleSubmit}>
                        <Row>
                            <Col>
                                <Form.Group className="mb-3">
                                    <Form.Label>Amount</Form.Label>
                                    <Form.Control type="number" name="amount" value={formData.amount} onChange={handleInputChange} required step="0.01" />
                                </Form.Group>
                            </Col>
                            <Col>
                                <Form.Group className="mb-3">
                                    <Form.Label>Expense Date</Form.Label>
                                    <Form.Control type="date" name="expense_date" value={formData.expense_date} onChange={handleInputChange} required />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Form.Group className="mb-3">
                            <Form.Label>Category</Form.Label>
                            <Form.Select name="category" value={formData.category} onChange={handleInputChange}>
                                <option value="">Uncategorized</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Account</Form.Label>
                            <Form.Select name="account" value={formData.account} onChange={handleInputChange}>
                                <option value="">No Account</option>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Description</Form.Label>
                            <Form.Control as="textarea" rows={3} name="description" value={formData.description} onChange={handleInputChange} />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>Close</Button>
                    <Button variant="primary" onClick={handleSubmit}>Save Changes</Button>
                </Modal.Footer>
            </Modal>
            
            {/* Render the new Category Manager Modal */}
            <CategoryManagerModal
                show={showCategoryModal}
                handleClose={() => setShowCategoryModal(false)}
                categories={categories}
                onUpdate={fetchData}
            />
        </>
    );
}

export default ExpenseListPage;