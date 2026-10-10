from django.urls import path
from .views import (
    BloodBankListCreateView,
    BloodStockListView,
    LowStockAlertsView,
    ApplyStockTransactionView,
    StockTransactionHistoryListView
)

urlpatterns = [
    path('banks/', BloodBankListCreateView.as_view(), name='blood_banks_list_create'),
    path('stock/', BloodStockListView.as_view(), name='blood_stock_list'),
    path('low-stock/', LowStockAlertsView.as_view(), name='blood_low_stock_list'),
    path('stock/<int:pk>/transaction/', ApplyStockTransactionView.as_view(), name='blood_stock_transaction'),
    path('transactions/', StockTransactionHistoryListView.as_view(), name='blood_stock_transactions_history'),
]
