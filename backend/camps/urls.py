from django.urls import path

from . import views as v

urlpatterns = [
    path('options/', v.OptionsView.as_view(), name='camps_options'),
    path('', v.PublicCampListView.as_view(), name='camps_public_list'),
    path('my-interests/', v.MyInterestsView.as_view(), name='camps_my_interests'),
    path('applications/', v.ApplicationListView.as_view(), name='camps_applications'),
    path('applications/<int:pk>/', v.ApplicationDetailView.as_view(), name='camps_application_detail'),
    path('applications/<int:pk>/cancel/', v.ApplicationCancelView.as_view(), name='camps_application_cancel'),
    path('applications/<int:pk>/action/', v.ApplicationActionView.as_view(), name='camps_application_action'),
    path('<int:pk>/', v.PublicCampDetailView.as_view(), name='camps_public_detail'),
    path('<int:pk>/interest/', v.InterestView.as_view(), name='camps_interest'),
]
