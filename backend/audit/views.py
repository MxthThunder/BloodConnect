from rest_framework import generics
from .models import AuditLog
from .serializers import AuditLogSerializer
from accounts.permissions import IsAdminUserRole


class AuditLogListView(generics.ListAPIView):
    """
    List audit records for platform activities.
    """
    permission_classes = [IsAdminUserRole]
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        queryset = AuditLog.objects.all().order_by('-created_at')
        action = self.request.query_params.get('action')
        target = self.request.query_params.get('target_model')
        if action:
            queryset = queryset.filter(action__icontains=action)
        if target:
            queryset = queryset.filter(target_model__icontains=target)
        return queryset[:100]
