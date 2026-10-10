from django.db import models, transaction
from django.conf import settings
from django.core.exceptions import ValidationError
from accounts.constants import BloodGroup, BloodComponent


class BloodBank(models.Model):
    name = models.CharField(max_length=200)
    license_number = models.CharField(max_length=100, blank=True)
    address = models.TextField()
    city = models.CharField(max_length=100)
    locality = models.CharField(max_length=100)
    contact_phone = models.CharField(max_length=30)
    contact_email = models.EmailField(blank=True)
    operating_hours = models.CharField(max_length=100, default='24 Hours Emergency Desk')
    latitude = models.FloatField(default=12.9716)
    longitude = models.FloatField(default=77.5946)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} - {self.city}"


class BloodStock(models.Model):
    blood_bank = models.ForeignKey(
        BloodBank,
        on_delete=models.CASCADE,
        related_name='stock_levels'
    )
    blood_group = models.CharField(
        max_length=5,
        choices=BloodGroup.choices
    )
    component = models.CharField(
        max_length=50,
        choices=BloodComponent.choices,
        default=BloodComponent.WHOLE_BLOOD
    )
    units_available = models.PositiveIntegerField(
        default=0,
        help_text="Current verifiable available blood units"
    )
    low_stock_threshold = models.PositiveIntegerField(
        default=5,
        help_text="Threshold below which urgent replenishment warnings trigger"
    )
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['blood_bank', 'blood_group', 'component']
        constraints = [
            models.UniqueConstraint(
                fields=['blood_bank', 'blood_group', 'component'],
                name='unique_bank_group_component'
            )
        ]

    def __str__(self):
        return f"{self.blood_bank.name}: {self.blood_group} ({self.component}) = {self.units_available} units"

    @property
    def is_low_stock(self):
        return self.units_available <= self.low_stock_threshold


class TransactionType(models.TextChoices):
    ADDITION = 'ADDITION', 'Stock Addition / Voluntary Donor Intake'
    USAGE_ISSUE = 'USAGE_ISSUE', 'Hospital Emergency Issue / Patient Transfusion'
    CORRECTION = 'CORRECTION', 'Inventory Audit Adjustment'


class StockTransaction(models.Model):
    stock = models.ForeignKey(
        BloodStock,
        on_delete=models.CASCADE,
        related_name='transactions'
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=TransactionType.choices
    )
    units = models.IntegerField(
        help_text="Positive for additions, negative for deductions/issues"
    )
    previous_units = models.PositiveIntegerField()
    resulting_units = models.PositiveIntegerField()
    reason = models.TextField(help_text="Mandatory clinical or audit explanation")
    reference_note = models.CharField(max_length=150, blank=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='stock_transactions'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.transaction_type}: {self.units} units for {self.stock} at {self.created_at}"

    @classmethod
    def apply_transaction(cls, stock_id, transaction_type, units_change, reason, performed_by=None, reference_note=''):
        """
        Safely applies a stock change with atomic database transaction and negative inventory protection.
        """
        with transaction.atomic():
            stock = BloodStock.objects.select_for_update().get(id=stock_id)
            prev = stock.units_available

            if transaction_type == TransactionType.ADDITION:
                if units_change <= 0:
                    raise ValidationError("Addition units must be positive.")
                new_units = prev + units_change
            elif transaction_type == TransactionType.USAGE_ISSUE:
                abs_units = abs(units_change)
                if abs_units > prev:
                    raise ValidationError(
                        f"Cannot issue {abs_units} units. Only {prev} units available. Stock cannot become negative."
                    )
                new_units = prev - abs_units
                units_change = -abs_units
            elif transaction_type == TransactionType.CORRECTION:
                new_units = prev + units_change
                if new_units < 0:
                    raise ValidationError("Adjustment cannot result in negative stock.")
            else:
                raise ValidationError("Invalid transaction type.")

            stock.units_available = new_units
            stock.save()

            tx = cls.objects.create(
                stock=stock,
                transaction_type=transaction_type,
                units=units_change,
                previous_units=prev,
                resulting_units=new_units,
                reason=reason,
                reference_note=reference_note,
                performed_by=performed_by
            )
            return stock, tx
