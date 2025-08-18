// frontend/src/components/AppLayout.js

import React from 'react';
import { Nav, Button } from 'react-bootstrap';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    Speedometer2,
    People,
    Truck,
    Receipt,
    Cart,
    CreditCard,
    BoxSeam,
    BarChart,
    Bank
} from 'react-bootstrap-icons';

function AppLayout({ children }) {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        navigate('/login');
    };

    return (
        <div className="d-flex">
            <div className="bg-dark text-white d-flex flex-column p-3" style={{ minWidth: '250px', minHeight: '100vh' }}>
                <h4 className="mb-4">MyAccountingApp</h4>
                <Nav className="flex-column mb-auto">
                    <Nav.Link as={NavLink} to="/dashboard" className="text-white d-flex align-items-center mb-2">
                        <Speedometer2 className="me-2" /> Dashboard
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/customers" className="text-white d-flex align-items-center mb-2">
                        <People className="me-2" /> Customers
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/suppliers" className="text-white d-flex align-items-center mb-2">
                        <Truck className="me-2" /> Suppliers
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/sales" className="text-white d-flex align-items-center mb-2">
                        <Receipt className="me-2" /> Sales
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/purchases" className="text-white d-flex align-items-center mb-2">
                        <Cart className="me-2" /> Purchases
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/expenses" className="text-white d-flex align-items-center mb-2">
                        <CreditCard className="me-2" /> Expenses
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/inventory" className="text-white d-flex align-items-center mb-2">
                        <BoxSeam className="me-2" /> Inventory
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/reports/profit-loss" className="text-white d-flex align-items-center mb-2">
                        <BarChart className="me-2" /> Profit &amp; Loss
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/accounts" className="text-white d-flex align-items-center mb-2">
                        <Bank className="me-2" /> Bank Accounts
                    </Nav.Link>
                </Nav>
                <Button variant="outline-light" onClick={handleLogout} className="mt-auto">Logout</Button>
            </div>
            <div className="flex-grow-1 p-4">
                {children}
            </div>
        </div>
    );
}

export default AppLayout;
