// frontend/src/components/AppLayout.js

import React, { useState } from 'react';
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
    Bank,
    BoxArrowRight,
    ChevronLeft,
    ChevronRight
} from 'react-bootstrap-icons';

function AppLayout({ children }) {
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);

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
                <Button
                    variant="outline-light"
                    size="sm"
                    onClick={() => setCollapsed(!collapsed)}
                    className="align-self-end mb-3"
                >
                    {collapsed ? <ChevronRight /> : <ChevronLeft />}
                </Button>
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
                <Button
                    variant="outline-light"
                    onClick={handleLogout}
                    className={`mt-auto d-flex ${collapsed ? 'justify-content-center' : 'align-items-center'}`}
                >
                    <BoxArrowRight className={iconClass} /> {!collapsed && 'Logout'}
                </Button>
            </div>
            <div className="flex-grow-1 p-4">{children}</div>
        </div>
    );
}

export default AppLayout;

