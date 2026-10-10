from django.urls import path
from .views import (
    NotificationListView,
    NotificationMarkReadView,
    NotificationMarkAllReadView,
    NotificationUnreadCountView,
    AdminNotificationOverviewView
)

urlpatterns = [
    path('', NotificationListView.as_view(), name='notifications_list'),
    path('<int:pk>/read/', NotificationMarkReadView.as_view(), name='notification_mark_read'),
    path('mark-all-read/', NotificationMarkAllReadView.as_view(), name='notification_mark_all_read'),
    path('unread-count/', NotificationUnreadCountView.as_view(), name='notification_unread_count'),
    path('all/', AdminNotificationOverviewView.as_view(), name='admin_notifications_all'),
]
