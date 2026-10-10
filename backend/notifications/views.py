from rest_framework import status, views, permissions, generics
from rest_framework.response import Response
from .models import Notification
from .serializers import NotificationSerializer
from accounts.permissions import IsAdminUserRole


class NotificationListView(generics.ListAPIView):
    """
    List in-app notifications for the authenticated user.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).order_by('-created_at')


class NotificationMarkReadView(views.APIView):
    """
    Mark a single notification as read.
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        try:
            notif = Notification.objects.get(pk=pk, recipient=request.user)
            notif.is_read = True
            notif.save()
            return Response({'message': 'Notification marked as read', 'is_read': True})
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)


class NotificationMarkAllReadView(views.APIView):
    """
    Mark all unread notifications for user as read.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        updated_count = Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'message': f'Marked {updated_count} notifications as read', 'count': updated_count})


class NotificationUnreadCountView(views.APIView):
    """
    Return count of unread notifications for badge counter.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({'unread_count': count})


class AdminNotificationOverviewView(generics.ListAPIView):
    """
    Admin overview of all dispatched notifications across the system.
    """
    permission_classes = [IsAdminUserRole]
    serializer_class = NotificationSerializer
    queryset = Notification.objects.all().select_related('recipient', 'related_request').order_by('-created_at')[:100]
