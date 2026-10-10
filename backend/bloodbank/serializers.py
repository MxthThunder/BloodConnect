from rest_framework import serializers
from .models import BloodBank, BloodStock, StockTransaction, TransactionType


class BloodBankSerializer(serializers.ModelSerializer):
    class Meta:
        model = BloodBank
        fields = [
            'id', 'name', 'license_number', 'address', 'city',
            'locality', 'contact_phone', 'contact_email',
            'operating_hours', 'latitude', 'longitude', 'is_active',
            'created_at'
        ]


class BloodStockSerializer(serializers.ModelSerializer):
    bank_name = serializers.CharField(source='blood_bank.name', read_only=True)
    bank_city = serializers.CharField(source='blood_bank.city', read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = BloodStock
        fields = [
            'id', 'blood_bank', 'bank_name', 'bank_city',
            'blood_group', 'component', 'units_available',
            'low_stock_threshold', 'is_low_stock', 'last_updated'
        ]


class StockTransactionSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.CharField(source='performed_by.get_full_name', read_only=True)
    blood_group = serializers.CharField(source='stock.blood_group', read_only=True)
    bank_name = serializers.CharField(source='stock.blood_bank.name', read_only=True)

    class Meta:
        model = StockTransaction
        fields = [
            'id', 'stock', 'bank_name', 'blood_group', 'transaction_type',
            'units', 'previous_units', 'resulting_units', 'reason',
            'reference_note', 'performed_by', 'performed_by_name', 'created_at'
        ]
        read_only_fields = ['id', 'previous_units', 'resulting_units', 'created_at']


class StockTransactionCreateSerializer(serializers.Serializer):
    transaction_type = serializers.ChoiceField(choices=TransactionType.choices)
    units = serializers.IntegerField(min_value=1)
    reason = serializers.CharField(min_length=5)
    reference_note = serializers.CharField(required=False, allow_blank=True)
