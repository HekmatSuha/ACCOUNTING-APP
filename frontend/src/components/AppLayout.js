// frontend/src/components/AppLayout.js

import React, { useState, useEffect } from 'react';
import { Nav, Button, Dropdown, Offcanvas } from 'react-bootstrap';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    Speedometer2,
    People,
    Truck,
    Receipt,
    Cart,
    CreditCard,
    FileText,
    BoxSeam,
    BarChart,
    PlusLg,
    DashLg,
    Bank,
    BoxArrowRight,
    List,
    PersonCircle,
    Gear
} from 'react-bootstrap-icons';

function AppLayout({ children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const [reportsOpen, setReportsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const username = localStorage.getItem('username') || 'User';

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        setReportsOpen(false);
    }, [location.pathname, collapsed]);

    const handleLogout = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        navigate('/login');
    };

    const isReportsRoute = location.pathname.startsWith('/reports');
    const linkClass = `app-nav-link w-100 d-flex gap-2 ${
        collapsed ? 'justify-content-center' : 'align-items-center'
    } mb-2`;
    const iconClass = collapsed ? '' : 'me-2';
    const sidebarWidth = collapsed ? '80px' : '250px';
    const reportsToggleActive = isReportsRoute || reportsOpen;
    const reportsToggleClass = `app-nav-link w-100 d-flex ${
        collapsed ? 'justify-content-center' : 'align-items-center justify-content-between'
    } gap-2 mb-2 ${reportsToggleActive ? 'active' : ''}`;

    const SidebarContent = (
        <>
            {!collapsed && !isMobile && <h4 className="mb-4">MyAccountingApp</h4>}
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
                <Nav.Link as={NavLink} to="/offers" className={linkClass}>
                    <FileText className={iconClass} /> {!collapsed && 'Offers'}
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
                <div className="position-relative">
                    <button
                        type="button"
                        className={`${reportsToggleClass} border-0`}
                        onClick={() => setReportsOpen((prev) => !prev)}
                        aria-expanded={reportsOpen}
                    >
                        <span className="d-flex align-items-center gap-2">
                            <BarChart className={iconClass} /> {!collapsed && 'Reports'}
                        </span>
                        {!collapsed && (reportsOpen ? <DashLg size={18} /> : <PlusLg size={18} />)}
                    </button>
                    {reportsOpen && (
                        <div
                            className={`sidebar-submenu ${
                                collapsed
                                    ? 'sidebar-submenu-collapsed position-absolute start-100 top-0 ms-2'
                                    : 'mt-2 ms-2 w-100'
                            }`}
                            style={collapsed ? { minWidth: '220px', zIndex: 1050 } : {}}
                        >
                            <NavLink
                                to="/reports/profit-loss"
                                className={({ isActive }) =>
                                    `sidebar-submenu-link ${isActive ? 'active' : ''}`
                                }
                            >
                                Profit &amp; Loss
                            </NavLink>
                            <NavLink
                                to="/reports/sales"
                                className={({ isActive }) =>
                                    `sidebar-submenu-link ${isActive ? 'active' : ''}`
                                }
                            >
                                Sales Report
                            </NavLink>
                            <NavLink
                                to="/reports/customer-balances"
                                className={({ isActive }) =>
                                    `sidebar-submenu-link ${isActive ? 'active' : ''}`
                                }
                            >
                                Customer Balances
                            </NavLink>
                        </div>
                    )}
                </div>
                <Nav.Link as={NavLink} to="/accounts" className={linkClass}>
                    <Bank className={iconClass} /> {!collapsed && 'Bank Accounts'}
                </Nav.Link>
            </Nav>
        </>
    );

    return (
        <div>
            {isMobile ? (
                <Offcanvas show={showSidebar} onHide={() => setShowSidebar(false)} className="app-sidebar">
                    <Offcanvas.Header closeButton closeVariant="white">
                        <Offcanvas.Title>MyAccountingApp</Offcanvas.Title>
                    </Offcanvas.Header>
                    <Offcanvas.Body>{SidebarContent}</Offcanvas.Body>
                </Offcanvas>
            ) : (
                <div
                    className="app-sidebar d-flex flex-column p-3"
                    style={{
                        width: sidebarWidth,
                        minHeight: '100vh',
                        transition: 'width 0.3s',
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        overflowY: 'auto'
                    }}
                >
                    {SidebarContent}
                </div>
            )}
            <div
                className="d-flex flex-column"
                style={{ marginLeft: isMobile ? 0 : sidebarWidth, transition: 'margin-left 0.3s', minHeight: '100vh' }}
            >
                <div className="app-header d-flex justify-content-between align-items-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="border-0 shadow-none"
                        onClick={() => (isMobile ? setShowSidebar(true) : setCollapsed(!collapsed))}
                    >
                        <List />
                    </Button>
                    <Dropdown align="end">
                        <Dropdown.Toggle
                            variant="ghost"
                            id="user-dropdown"
                            className="d-flex align-items-center gap-2"
                        >
                            <PersonCircle size={32} className="flex-shrink-0" />
                            {username}
                        </Dropdown.Toggle>
                        <Dropdown.Menu>
                            <Dropdown.Item as={NavLink} to="/settings/company-info">
                                <Gear className="me-2" /> Company Settings
                            </Dropdown.Item>
                            <Dropdown.Divider />
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

