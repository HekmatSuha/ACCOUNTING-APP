// frontend/src/App.js

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import InviteAcceptPage from './pages/InviteAcceptPage';
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
import SupplierDetailPage from './pages/SupplierDetailPage';
import SupplierFormPage from './pages/SupplierFormPage';
import SaleListPage from './pages/SaleListPage'; // <-- Import
import SaleDetailPage from './pages/SaleDetailPage';
import CustomerPaymentPage from './pages/CustomerPaymentPage';
import SupplierPaymentPage from './pages/SupplierPaymentPage';
import ExpenseListPage from './pages/ExpenseListPage';
import ProfitLossPage from './pages/ProfitLossPage';
import SalesReportPage from './pages/SalesReportPage';
import CustomerBalanceReportPage from './pages/CustomerBalanceReportPage';
import InventoryReportPage from './pages/InventoryReportPage';
import PurchaseFormPage from './pages/PurchaseFormPage';
import EditSalePage from './pages/EditSalePage';
import PurchaseListPage from './pages/PurchaseListPage';
import PurchaseDetailPage from './pages/PurchaseDetailPage';
import EditPurchasePage from './pages/EditPurchasePage';
import BankAccountListPage from './pages/BankAccountListPage';
import BankAccountDetailPage from './pages/BankAccountDetailPage';
import OfferListPage from './pages/OfferListPage';
import OfferDetailPage from './pages/OfferDetailPage';
import ActivityPage from './pages/ActivityPage';
import CompanyInfoPage from './pages/CompanyInfoPage';
import WarehouseListPage from './pages/WarehouseListPage';
import WarehouseDetailPage from './pages/WarehouseDetailPage';
import UserSettingsPage from './pages/UserSettingsPage';

import { loadBaseCurrency } from './config/currency';
import { ProfileProvider } from './context/ProfileContext';
import AdminGuard from './pages/admin/AdminGuard';
import AdminAccountListPage from './pages/admin/AdminAccountListPage';
import AdminAccountDetailPage from './pages/admin/AdminAccountDetailPage';
import AdminPlanEditorPage from './pages/admin/AdminPlanEditorPage';
import AdminPlansPage from './pages/admin/AdminPlansPage';


function App() {
  useEffect(() => {
    loadBaseCurrency();
  }, []);
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/invite/:token" element={<InviteAcceptPage />} />
        
        {/* Protected routes */}
        <Route
          path="/*" // Match all nested routes
          element={
            <ProtectedRoute>
              <ProfileProvider>
                <AppLayout>
                  <Routes>
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="customers" element={<CustomerListPage />} />
                    <Route path="customers/new" element={<CustomerFormPage />} />
                    <Route path="customers/edit/:id" element={<CustomerFormPage />} />
                    <Route path="customers/:id" element={<CustomerDetailPage />} />
                    <Route path="customers/:id/payment" element={<CustomerPaymentPage />} />
                    <Route path="inventory" element={<ProductListPage />} /> {/* <-- Add Route */}
                    <Route path="inventory/new" element={<ProductFormPage />} /> {/* <-- Add Route */}
                    <Route path="inventory/edit/:id" element={<ProductFormPage />} /> {/* <-- Add Route */}
                    <Route path="customers/:customerId/new-sale" element={<SaleFormPage />} />
                    <Route path="customers/:customerId/new-purchase" element={<PurchaseFormPage />} />
                    <Route path="suppliers" element={<SupplierListPage />} />
                    <Route path="suppliers/new" element={<SupplierFormPage />} />
                    <Route path="suppliers/edit/:id" element={<SupplierFormPage />} />
                    <Route path="suppliers/:id" element={<SupplierDetailPage />} />
                    <Route path="suppliers/:id/payment" element={<SupplierPaymentPage />} />
                    <Route path="suppliers/:supplierId/new-purchase" element={<PurchaseFormPage />} />
                    <Route path="suppliers/:supplierId/new-sale" element={<SaleFormPage />} />
                    <Route path="sales" element={<SaleListPage />} />
                    <Route path="sales/new" element={<SaleFormPage />} />
                    <Route path="sales/:id" element={<SaleDetailPage />} />
                    <Route path="offers" element={<OfferListPage />} />
                    <Route path="offers/:id" element={<OfferDetailPage />} />
                    <Route path="warehouses" element={<WarehouseListPage />} />
                    <Route path="warehouses/:id" element={<WarehouseDetailPage />} />
                    <Route path="expenses" element={<ExpenseListPage />} /> {/* <-- Add Route */}
                    <Route path="reports/profit-loss" element={<ProfitLossPage />} />
                    <Route path="reports/sales" element={<SalesReportPage />} />
                    <Route path="reports/customer-balances" element={<CustomerBalanceReportPage />} />
                    <Route path="reports/inventory" element={<InventoryReportPage />} />
                    <Route path="sales/:id/edit" element={<EditSalePage />} /> {/* <-- Add Route */}
                    <Route path="purchases" element={<PurchaseListPage />} /> {/* <-- Add Route */}
                    <Route path="purchases/:id" element={<PurchaseDetailPage />} /> {/* <-- Add Route */}
                    <Route path="purchases/:id/edit" element={<EditPurchasePage />} /> {/* <-- Add Route */}
                    <Route path="accounts" element={<BankAccountListPage />} />
                    <Route path="accounts/:id" element={<BankAccountDetailPage />} />
                    <Route path="activities" element={<ActivityPage />} />
                    <Route path="settings/company-info" element={<CompanyInfoPage />} />
                    <Route path="settings/user" element={<UserSettingsPage />} />
                    <Route
                      path="admin/accounts"
                      element={
                        <AdminGuard>
                          <AdminAccountListPage />
                        </AdminGuard>
                      }
                    />
                    <Route
                      path="admin/plans"
                      element={
                        <AdminGuard>
                          <AdminPlansPage />
                        </AdminGuard>
                      }
                    />
                    <Route
                      path="admin/accounts/:id"
                      element={
                        <AdminGuard>
                          <AdminAccountDetailPage />
                        </AdminGuard>
                      }
                    />
                    <Route
                      path="admin/accounts/:id/plan"
                      element={
                        <AdminGuard>
                          <AdminPlanEditorPage />
                        </AdminGuard>
                      }
                    />
                  </Routes>
                </AppLayout>
              </ProfileProvider>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
