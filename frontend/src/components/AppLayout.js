// frontend/src/components/AppLayout.js

import React, { useState } from 'react';
import { Nav, Button, Dropdown } from 'react-bootstrap';
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
    Bank,
    BoxArrowRight,
    ChevronLeft,
    ChevronRight,
    PersonCircle
} from 'react-bootstrap-icons';

function AppLayout({ children }) {
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);
    const username = localStorage.getItem('username') || 'User';

    const handleLogout = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        navigate('/login');
    };

    const linkClass = `text-white d-flex ${collapsed ? 'justify-content-center' : 'align-items-center'} mb-2`;
    const iconClass = collapsed ? '' : 'me-2';

    return (
        <div className="d-flex">
            <div
                className="bg-dark text-white d-flex flex-column p-3"
                style={{ width: collapsed ? '80px' : '250px', minHeight: '100vh', transition: 'width 0.3s' }}
            >
                {!collapsed && <h4 className="mb-4">MyAccountingApp</h4>}
                <Nav className="flex-column mb-auto">
                    <Nav.Link as={NavLink} to="/dashboard" className={linkClass}>
                        <Speedometer2 className={iconClass} /> {!collapsed && 'Dashboard'}
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/customers" className={linkClass}>
                        <People className={iconClass} /> {!collapsed && 'Customers'}
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/suppliers" className={linkClass}>
                        <Truck className={iconClass} /> {!collapsed && 'Suppliers'}
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/sales" className={linkClass}>
                        <Receipt className={iconClass} /> {!collapsed && 'Sales'}
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/purchases" className={linkClass}>
                        <Cart className={iconClass} /> {!collapsed && 'Purchases'}
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/expenses" className={linkClass}>
                        <CreditCard className={iconClass} /> {!collapsed && 'Expenses'}
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/inventory" className={linkClass}>
                        <BoxSeam className={iconClass} /> {!collapsed && 'Inventory'}
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/reports/profit-loss" className={linkClass}>
                        <BarChart className={iconClass} /> {!collapsed && 'Profit & Loss'}
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/accounts" className={linkClass}>
                        <Bank className={iconClass} /> {!collapsed && 'Bank Accounts'}
                    </Nav.Link>
                </Nav>
            </div>
            <div className="flex-grow-1 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-center border-bottom p-3">
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => setCollapsed(!collapsed)}
                    >
                        {collapsed ? <ChevronRight /> : <ChevronLeft />}
                    </Button>
                    <Dropdown align="end">
                        <Dropdown.Toggle variant="outline-secondary" id="user-dropdown">
                            <PersonCircle size={32} className="me-2" />
                            {username}
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            <Dropdown.Item onClick={handleLogout}>
                                <BoxArrowRight className="me-2" /> Logout
                            </Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                </div>
                <div className="p-4 flex-grow-1">{children}</div>
            </div>
        </div>
    );
}

export default AppLayout;

