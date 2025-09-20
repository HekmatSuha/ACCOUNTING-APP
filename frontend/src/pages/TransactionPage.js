import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { useNavigate } from 'react-router-dom';
import { Form, Button, Card, Row, Col, Table, Alert } from 'react-bootstrap';
import { formatCurrency } from '../utils/format';
import { FaTrash } from 'react-icons/fa';
import '../styles/datatable.css';

function TransactionPage() {
    // State for data fetched from the API
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);

    // State for the form data
    const [customerId, setCustomerId] = useState('');
    const [saleItems, setSaleItems] = useState([
        { product_id: '', quantity: 1, unit_price: '' }
    ]);
    
    // State for UI feedback
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Fetch customers and products when the component loads
    useEffect(() => {
        const fetchData = async () => {
            try {
                const customerRes = await axiosInstance.get('/customers/');
                setCustomers(customerRes.data);

                const productRes = await axiosInstance.get('/products/');
                setProducts(productRes.data);
            } catch (err) {
                setError('Failed to load customers or products.');
            }
        };
        fetchData();
    }, []);

    // Handle changes in the sale item rows
    const handleItemChange = (index, event) => {
        const values = [...saleItems];
        const { name, value } = event.target;
        
        values[index][name] = value;

        // If the product is changed, update its unit_price
        if (name === 'product_id') {
            const selectedProduct = products.find(p => p.id.toString() === value);
            values[index]['unit_price'] = selectedProduct ? selectedProduct.sale_price : '';
        }

        setSaleItems(values);
    };
    
    // Add a new empty row for a sale item
    const handleAddItem = () => {
        setSaleItems([...saleItems, { product_id: '', quantity: 1, unit_price: '' }]);
    };

    // Remove a sale item row
    const handleRemoveItem = (index) => {
        const values = [...saleItems];
        values.splice(index, 1);
        setSaleItems(values);
    };

    // Calculate the total amount of the sale
    const calculateTotal = () => {
        return saleItems.reduce((total, item) => {
            const quantity = Number(item.quantity) || 0;
            const price = Number(item.unit_price) || 0;
            return total + quantity * price;
        }, 0);
    };

    // Handle form submission
    const handleSubmit = async (event, isOffer = false) => {
        event.preventDefault();
        setError('');

        if (!customerId || saleItems.some(item => !item.product_id || item.quantity <= 0)) {
            setError('Please select a customer and ensure all items have a product and valid quantity.');
            return;
        }

        const transactionData = {
            customer_id: parseInt(customerId),
            items: saleItems.map(item => ({
                product_id: parseInt(item.product_id),
                quantity: parseInt(item.quantity),
                unit_price: parseFloat(item.unit_price)
            }))
        };
        
        const url = isOffer ? '/offers/' : '/sales/';
        const successUrl = isOffer ? '/offers' : '/sales';
        const errorMessage = isOffer ? 'Failed to create offer. Please check your input.' : 'Failed to create sale. Please check your input.';

        try {
            await axiosInstance.post(url, transactionData);
            navigate(successUrl);
        } catch (err) {
            console.error(err);
            setError(errorMessage);
        }
    };

    return (
        <Card>
            <Card.Header><h4>Create New Transaction</h4></Card.Header>
            <Card.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                <Form>
                    <Row className="mb-3">
                        <Form.Group as={Col} controlId="formCustomer">
                            <Form.Label>Customer</Form.Label>
                            <Form.Select
                                value={customerId}
                                onChange={(e) => setCustomerId(e.target.value)}
                                required
                            >
                                <option value="">Select a Customer</option>
                                {customers.map(customer => (
                                    <option key={customer.id} value={customer.id}>
                                        {customer.name}
                                    </option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                    </Row>

                    <h5>Sale Items</h5>
                    <div className="data-table-container">
                        <Table responsive className="data-table data-table--compact">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>Quantity</th>
                                    <th>Unit Price</th>
                                    <th>Line Total</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {saleItems.map((item, index) => (
                                    <tr key={index}>
                                        <td>
                                            <Form.Select
                                                name="product_id"
                                                value={item.product_id}
                                                onChange={(e) => handleItemChange(index, e)}
                                                required
                                            >
                                                <option value="">Select a Product</option>
                                                {products.map((product) => (
                                                    <option key={product.id} value={product.id}>
                                                        {product.name}
                                                    </option>
                                                ))}
                                            </Form.Select>
                                        </td>
                                        <td>
                                            <Form.Control
                                                type="number"
                                                name="quantity"
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(index, e)}
                                                min="1"
                                                required
                                            />
                                        </td>
                                        <td>
                                            <Form.Control
                                                type="number"
                                                name="unit_price"
                                                value={item.unit_price}
                                                onChange={(e) => handleItemChange(index, e)}
                                                step="0.01"
                                                required
                                            />
                                        </td>
                                        <td>
                                            {formatCurrency((Number(item.quantity) || 0) * (Number(item.unit_price) || 0))}
                                        </td>
                                        <td>
                                            <Button variant="danger" onClick={() => handleRemoveItem(index)}>
                                                <FaTrash />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>

                    <Button variant="secondary" onClick={handleAddItem} className="mb-3">
                        + Add Item
                    </Button>

                    <div className="text-end">
                        <h3>Total: {formatCurrency(calculateTotal())}</h3>
                    </div>

                    <div className="mt-3">
                        <Button variant="primary" onClick={(e) => handleSubmit(e, false)}>
                            Create Sale
                        </Button>
                        <Button variant="info" className="ms-2" onClick={(e) => handleSubmit(e, true)}>
                            Create Offer
                        </Button>
                        <Button variant="light" className="ms-2" onClick={() => navigate(-1)}>
                            Cancel
                        </Button>
                    </div>
                </Form>
            </Card.Body>
        </Card>
    );
}

export default TransactionPage;
