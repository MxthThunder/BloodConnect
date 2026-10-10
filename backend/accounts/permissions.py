from rest_framework import permissions
from .models import UserRole


class IsAdminUserRole(permissions.BasePermission):
    """
    Allows access only to users with the Admin role or Django superusers.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.role == UserRole.ADMIN or request.user.is_superuser or request.user.is_staff)
        )


class IsDonorUserRole(permissions.BasePermission):
    """
    Allows access to authenticated Donors and Administrators.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.role == UserRole.DONOR or request.user.role == UserRole.ADMIN or request.user.is_superuser)
        )


class IsRequesterUserRole(permissions.BasePermission):
    """
    Allows access to authenticated Requesters and Administrators.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.role == UserRole.REQUESTER or request.user.role == UserRole.ADMIN or request.user.is_superuser)
        )


class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Object-level permission to allow only owners of an object or admins to view/edit it.
    """
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == UserRole.ADMIN or request.user.is_superuser:
            return True
        # Check standard ownership attributes
        if hasattr(obj, 'user'):
            return obj.user == request.user
        if hasattr(obj, 'requester'):
            return obj.requester == request.user
        if hasattr(obj, 'recipient'):
            return obj.recipient == request.user
        if hasattr(obj, 'donor') and hasattr(obj.donor, 'user'):
            return obj.donor.user == request.user
        return False
