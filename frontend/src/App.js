// frontend/src/App.js

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProtectedRoute from './pages/ProtectedRoute';
import AppLayout from './components/AppLayout';
import CustomerListPage from './pages/CustomerListPage'; // <-- Import
import CustomerFormPage from './pages/CustomerFormPage';
import CustomerDetailPage from './pages/CustomerDetailPage';
import ProductListPage from './pages/ProductListPage'; // <-- Import
import ProductFormPage from './pages/ProductFormPage';
import SaleFormPage from './pages/SaleFormPage';
import SupplierListPage from './pages/SupplierListPage';
import SaleListPage from './pages/SaleListPage'; // <-- Import
import NewSalePage from './pages/NewSalePage';   // <-- Import
import SaleDetailPage from './pages/SaleDetailPage';
import ExpenseListPage from './pages/ExpenseListPage';
import ProfitLossPage from './pages/ProfitLossPage';
import SalesReportPage from './pages/SalesReportPage';
import EditSalePage from './pages/EditSalePage';
import PurchaseListPage from './pages/PurchaseListPage';
import PurchaseDetailPage from './pages/PurchaseDetailPage';
import EditPurchasePage from './pages/EditPurchasePage';
import BankAccountListPage from './pages/BankAccountListPage';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Protected routes */}
        <Route
          path="/*" // Match all nested routes
          element={
            <ProtectedRoute>
              <AppLayout>
                <Routes>
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="customers" element={<CustomerListPage />} /> 
                  <Route path="customers/new" element={<CustomerFormPage />} /> 
                  <Route path="customers/edit/:id" element={<CustomerFormPage />} />
                  <Route path="customers/:id" element={<CustomerDetailPage />} />
                  <Route path="inventory" element={<ProductListPage />} /> {/* <-- Add Route */}
                  <Route path="inventory/new" element={<ProductFormPage />} /> {/* <-- Add Route */}
                  <Route path="inventory/edit/:id" element={<ProductFormPage />} /> {/* <-- Add Route */}
                  <Route path="customers/:customerId/new-sale" element={<SaleFormPage />} />
                  <Route path="suppliers" element={<SupplierListPage />} />
                  <Route path="sales" element={<SaleListPage />} />
                  <Route path="sales/new" element={<NewSalePage />} />
                  <Route path="sales/:id" element={<SaleDetailPage />} />
                  <Route path="expenses" element={<ExpenseListPage />} /> {/* <-- Add Route */}
                  <Route path="reports/profit-loss" element={<ProfitLossPage />} />
                  <Route path="reports/sales" element={<SalesReportPage />} />
                  <Route path="sales/:id/edit" element={<EditSalePage />} /> {/* <-- Add Route */}
                  <Route path="purchases" element={<PurchaseListPage />} /> {/* <-- Add Route */}
                  <Route path="purchases/:id" element={<PurchaseDetailPage />} /> {/* <-- Add Route */}
                  <Route path="purchases/:id/edit" element={<EditPurchasePage />} /> {/* <-- Add Route */}
                  <Route path="accounts" element={<BankAccountListPage />} />

                </Routes>

              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;