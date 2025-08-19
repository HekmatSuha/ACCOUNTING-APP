# backend/api/urls.py

from django.urls import path, include
from .views import CreateUserView, ExpenseCategoryViewSet, ExpenseViewSet, profit_and_loss_report, sales_report
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
# --- Import the router and the viewset ---
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers
from .views import CustomerViewSet, dashboard_summary, ProductViewSet,SaleViewSet, SupplierViewSet,PaymentViewSet,PurchaseViewSet, CustomerPaymentViewSet
from .views import BankAccountViewSet

# Create a router and register our viewsets with it.
router = DefaultRouter()
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'sales', SaleViewSet, basename='sale')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'accounts', BankAccountViewSet, basename='account')
# Create a nested router for payments under sales
sales_router = routers.NestedSimpleRouter(router, r'sales', lookup='sale')
sales_router.register(r'payments', PaymentViewSet, basename='sale-payments')

# Create a nested router for payments under customers
customers_router = routers.NestedSimpleRouter(router, r'customers', lookup='customer')
customers_router.register(r'payments', CustomerPaymentViewSet, basename='customer-payments')

router.register(r'expense-categories', ExpenseCategoryViewSet, basename='expense-category') # <-- Add this
router.register(r'expenses', ExpenseViewSet, basename='expense')
router.register(r'purchases', PurchaseViewSet, basename='purchase')


# The API URLs are now determined automatically by the router.
urlpatterns = [
    path('token/', TokenObtainPairView.as_view(), name='get_token'),
    path('token/refresh/', TokenRefreshView.as_view(), name='refresh_token'),
    path('dashboard-summary/', dashboard_summary, name='dashboard-summary'),
    path('auth/register/', CreateUserView.as_view(), name='register'),
    path('reports/profit-loss/', profit_and_loss_report, name='profit-loss-report'),
    path('reports/sales/', sales_report, name='sales-report'),


    # --- Add the router's URLs ---
    path('', include(router.urls)),
    path('', include(sales_router.urls)),
    path('', include(customers_router.urls)),
]