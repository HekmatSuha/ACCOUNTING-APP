"""URL routing for the accounting API."""

from django.urls import include, path
from rest_framework.permissions import AllowAny
from rest_framework.routers import DefaultRouter
from rest_framework_nested import routers
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views.activities import ActivityViewSet
from .views.auth import ChangePasswordView, CreateUserView, CurrentUserView
from .views.banking import BankAccountViewSet
from .views.common import dashboard_summary
from .views.company import CompanyInfoViewSet, CompanySettingsViewSet
from .views.currencies import CurrencyViewSet
from .views.customers import (
    CustomerPaymentViewSet,
    CustomerViewSet,
    customer_balance_report,
)
from .views.expenses import ExpenseCategoryViewSet, ExpenseViewSet, profit_and_loss_report
from .views.products import ProductViewSet, inventory_report
from .views.purchases import PurchaseReturnViewSet, PurchaseViewSet
from .views.sales import OfferViewSet, PaymentViewSet, SaleReturnViewSet, SaleViewSet, sales_report
from .views.warehouses import WarehouseViewSet
from .views.suppliers import SupplierPaymentViewSet, SupplierViewSet

router = DefaultRouter()
router.register(r'company-info', CompanyInfoViewSet, basename='company-info')
router.register(r'settings', CompanySettingsViewSet, basename='company-settings')
router.register(r'activities', ActivityViewSet, basename='activity')
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'sales', SaleViewSet, basename='sale')
router.register(r'offers', OfferViewSet, basename='offer')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'currencies', CurrencyViewSet, basename='currency')
router.register(r'accounts', BankAccountViewSet, basename='account')
router.register(r'expense-categories', ExpenseCategoryViewSet, basename='expense-category')
router.register(r'expenses', ExpenseViewSet, basename='expense')
router.register(r'purchases', PurchaseViewSet, basename='purchase')
router.register(r'purchase-returns', PurchaseReturnViewSet, basename='purchase-return')
router.register(r'sale-returns', SaleReturnViewSet, basename='sale-return')
router.register(r'warehouses', WarehouseViewSet, basename='warehouse')

sales_router = routers.NestedSimpleRouter(router, r'sales', lookup='sale')
sales_router.register(r'payments', PaymentViewSet, basename='sale-payments')

customers_router = routers.NestedSimpleRouter(router, r'customers', lookup='customer')
customers_router.register(r'payments', CustomerPaymentViewSet, basename='customer-payments')
customers_router.register(r'offers', OfferViewSet, basename='customer-offers')

suppliers_router = routers.NestedSimpleRouter(router, r'suppliers', lookup='supplier')
suppliers_router.register(r'payments', SupplierPaymentViewSet, basename='supplier-payments')

urlpatterns = [
    path(
        'token/',
        TokenObtainPairView.as_view(permission_classes=[AllowAny]),
        name='get_token',
    ),
    path(
        'token/refresh/',
        TokenRefreshView.as_view(permission_classes=[AllowAny]),
        name='refresh_token',
    ),
    path('dashboard-summary/', dashboard_summary, name='dashboard-summary'),
    path('auth/register/', CreateUserView.as_view(), name='register'),
    path('user/profile/', CurrentUserView.as_view(), name='user-profile'),
    path('user/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('reports/profit-loss/', profit_and_loss_report, name='profit-loss-report'),
    path('reports/customer-balances/', customer_balance_report, name='customer-balance-report'),
    path('reports/sales/', sales_report, name='sales-report'),
    path('reports/inventory/', inventory_report, name='inventory-report'),
    path('', include(router.urls)),
    path('', include(sales_router.urls)),
    path('', include(customers_router.urls)),
    path('', include(suppliers_router.urls)),
]
