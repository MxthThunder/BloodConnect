from django.urls import path
from .views import (
    BloodRequestListCreateView,
    BloodRequestDetailView,
    BloodRequestCancelView,
    BloodRequestVerifyView,
    BloodRequestFulfillView,
    BloodRequestRematchView
)

urlpatterns = [
    path('', BloodRequestListCreateView.as_view(), name='blood_request_list_create'),
    path('<int:pk>/', BloodRequestDetailView.as_view(), name='blood_request_detail'),
    path('<int:pk>/cancel/', BloodRequestCancelView.as_view(), name='blood_request_cancel'),
    path('<int:pk>/verify/', BloodRequestVerifyView.as_view(), name='blood_request_verify'),
    path('<int:pk>/fulfill/', BloodRequestFulfillView.as_view(), name='blood_request_fulfill'),
    path('<int:pk>/rematch/', BloodRequestRematchView.as_view(), name='blood_request_rematch'),
]
