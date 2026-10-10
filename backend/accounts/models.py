from django.contrib.auth.models import AbstractUser
from django.db import models


class UserRole(models.TextChoices):
    REQUESTER = 'requester', 'Requester'
    DONOR = 'donor', 'Donor'
    ADMIN = 'admin', 'Administrator'


class User(AbstractUser):
    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.REQUESTER,
        help_text="Role determining permissions and access portal."
    )
    phone = models.CharField(max_length=20, blank=True)
    city = models.CharField(max_length=100, blank=True)
    locality = models.CharField(max_length=100, blank=True)
    is_verified = models.BooleanField(
        default=True,
        help_text="Designates whether the user's account is verified."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role}) - {self.email}"

    @property
    def is_admin_role(self):
        return self.role == UserRole.ADMIN or self.is_superuser

    @property
    def is_donor_role(self):
        return self.role == UserRole.DONOR

    @property
    def is_requester_role(self):
        return self.role == UserRole.REQUESTER
