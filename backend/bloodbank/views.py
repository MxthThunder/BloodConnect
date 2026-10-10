from rest_framework import status, views, permissions, generics
from rest_framework.response import Response
from django.core.exceptions import ValidationError
from .models import BloodBank, BloodStock, StockTransaction
from .serializers import (
    BloodBankSerializer,
    BloodStockSerializer,
    StockTransactionSerializer,
    StockTransactionCreateSerializer
)
from notifications.models import Notification, NotificationType
from audit.models import AuditLog
from accounts.permissions import IsAdminUserRole
from accounts.models import User


class BloodBankListCreateView(generics.ListCreateAPIView):
    queryset = BloodBank.objects.filter(is_active=True).order_by('name')
    serializer_class = BloodBankSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAdminUserRole()]
        return [permissions.AllowAny()]


class BloodStockListView(generics.ListAPIView):
    """
    List sample stock records across monitored blood banks.
    Permits public demonstration viewing with clear disclaimer.
    """
    permission_classes = [permissions.AllowAny]
    serializer_class = BloodStockSerializer

    def get_queryset(self):
        queryset = BloodStock.objects.all().select_related('blood_bank').order_by('blood_bank__name', 'blood_group')
        bank_id = self.request.query_params.get('bank_id')
        blood_group = self.request.query_params.get('blood_group')
        low_only = self.request.query_params.get('low_stock')

        if bank_id:
            queryset = queryset.filter(blood_bank_id=bank_id)
        if blood_group:
            queryset = queryset.filter(blood_group=blood_group)
        if low_only == 'true':
            queryset = [s for s in queryset if s.is_low_stock]

        return queryset


class LowStockAlertsView(generics.ListAPIView):
    """
    Returns items currently below their low-stock safety threshold.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BloodStockSerializer

    def get_queryset(self):
        stocks = BloodStock.objects.all().select_related('blood_bank')
        return [s for s in stocks if s.is_low_stock]


class ApplyStockTransactionView(views.APIView):
    """
    Admin-only endpoint to safely adjust, add, or deduct blood units.
    Enforces atomic database lock and prohibits negative inventory.
    """
    permission_classes = [IsAdminUserRole]

    def post(self, request, pk):
        try:
            stock = BloodStock.objects.get(pk=pk)
        except BloodStock.DoesNotExist:
            return Response({'error': 'Blood stock record not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = StockTransactionCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        tx_type = serializer.validated_data['transaction_type']
        units = serializer.validated_data['units']
        reason = serializer.validated_data['reason']
        reference_note = serializer.validated_data.get('reference_note', '')

        try:
            updated_stock, tx = StockTransaction.apply_transaction(
                stock_id=stock.id,
                transaction_type=tx_type,
                units_change=units,
                reason=reason,
                performed_by=request.user,
                reference_note=reference_note
            )
        except ValidationError as e:
            return Response({'error': str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)

        # If stock is now low, create low-stock alert notification for administrators
        if updated_stock.is_low_stock:
            admin_users = User.objects.filter(role='admin') | User.objects.filter(is_superuser=True)
            for admin in admin_users:
                Notification.objects.create(
                    recipient=admin,
                    title=f"LOW STOCK ALERT: {updated_stock.blood_group} at {updated_stock.blood_bank.name}",
                    message=(
                        f"Inventory for {updated_stock.blood_group} ({updated_stock.component}) is now at "
                        f"{updated_stock.units_available} unit(s), which is at or below the safety threshold of "
                        f"{updated_stock.low_stock_threshold} units. Immediate intake drive recommended."
                    ),
                    notification_type=NotificationType.LOW_STOCK,
                    urgency='URGENT',
                    action_url="/admin-portal/low-stock"
                )

        AuditLog.record(
            actor=request.user,
            action='UPDATE_BLOOD_STOCK',
            target_model='BloodStock',
            target_id=stock.id,
            details=f"{tx_type}: {units} units. Reason: {reason}. Result: {updated_stock.units_available} units.",
            request=request
        )

        return Response({
            'message': 'Stock transaction completed successfully',
            'stock': BloodStockSerializer(updated_stock).data,
            'transaction': StockTransactionSerializer(tx).data
        })


class StockTransactionHistoryListView(generics.ListAPIView):
    """
    List recorded stock audit transactions.
    """
    permission_classes = [IsAdminUserRole]
    serializer_class = StockTransactionSerializer

    def get_queryset(self):
        queryset = StockTransaction.objects.all().select_related('stock', 'stock__blood_bank', 'performed_by').order_by('-created_at')
        stock_id = self.request.query_params.get('stock_id')
        if stock_id:
            queryset = queryset.filter(stock_id=stock_id)
        return queryset[:50]
