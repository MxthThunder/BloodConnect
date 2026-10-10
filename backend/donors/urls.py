from django.urls import path
from .views import (
    DonorProfileView,
    ToggleAvailabilityView,
    DonationHistoryListView,
    DonorDirectoryListView,
    DonorRelevantRequestsView
)

urlpatterns = [
    path('profile/', DonorProfileView.as_view(), name='donor_profile'),
    path('toggle-availability/', ToggleAvailabilityView.as_view(), name='donor_toggle_availability'),
    path('history/', DonationHistoryListView.as_view(), name='donor_history'),
    path('directory/', DonorDirectoryListView.as_view(), name='donor_directory'),
    path('relevant-requests/', DonorRelevantRequestsView.as_view(), name='donor_relevant_requests'),
]
