// frontend/src/components/AppLayout.js

import React from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { NavLink, useNavigate } from 'react-router-dom';

function AppLayout({ children }) {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        navigate('/login');
    };

    return (
        <>
            <Navbar bg="dark" variant="dark" expand="lg" className="mb-4">
                <Container>
                    <Navbar.Brand as={NavLink} to="/dashboard">MyAccountingApp</Navbar.Brand>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="me-auto">
                            <Nav.Link as={NavLink} to="/dashboard">Dashboard</Nav.Link>
                            <Nav.Link as={NavLink} to="/customers">Customers</Nav.Link>
                            <Nav.Link as={NavLink} to="/suppliers">Suppliers</Nav.Link>
                            <Nav.Link as={NavLink} to="/sales">Sales</Nav.Link>
                            <Nav.Link as={NavLink} to="/purchases">Purchases</Nav.Link>
                            <Nav.Link as={NavLink} to="/expenses">Expenses</Nav.Link>
                            <Nav.Link as={NavLink} to="/inventory">Inventory</Nav.Link>
                            <Nav.Link as={NavLink} to="/reports/profit-loss">Profit & Loss</Nav.Link>
                            <Nav.Link as={NavLink} to="/accounts">Bank Accounts</Nav.Link>
                        </Nav>
                        <Button variant="outline-light" onClick={handleLogout}>Logout</Button>
                    </Navbar.Collapse>
                </Container>
            </Navbar>
            <Container>
                {children}
            </Container>
        </>
    );
}

export default AppLayout;