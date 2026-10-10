from django.urls import path
from .views import (
    RequestMatchesListView,
    DonorAlertsListView,
    DonorAlertDetailView,
    DonorAlertResponseView,
    AdminMatchingOverviewView
)

urlpatterns = [
    path('request/<int:request_id>/', RequestMatchesListView.as_view(), name='matching_request_matches'),
    path('donor-alerts/', DonorAlertsListView.as_view(), name='matching_donor_alerts'),
    path('donor-alerts/<int:pk>/', DonorAlertDetailView.as_view(), name='matching_donor_alert_detail'),
    path('donor-alerts/<int:pk>/respond/', DonorAlertResponseView.as_view(), name='matching_donor_alert_respond'),
    path('all-matches/', AdminMatchingOverviewView.as_view(), name='matching_all_matches'),
]
