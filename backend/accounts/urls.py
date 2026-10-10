from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    LogoutView,
    CurrentUserView,
    UserManagementListView,
    UserToggleStatusView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('login/', LoginView.as_view(), name='auth_login'),
    path('logout/', LogoutView.as_view(), name='auth_logout'),
    path('me/', CurrentUserView.as_view(), name='auth_me'),
    path('profile/', CurrentUserView.as_view(), name='auth_profile'),
    path('users/', UserManagementListView.as_view(), name='admin_users_list'),
    path('users/<int:pk>/toggle-status/', UserToggleStatusView.as_view(), name='admin_user_toggle'),
]
