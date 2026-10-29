from django.contrib import admin

from .models import CampApplication, CampEvent, CampInterest


@admin.register(CampApplication)
class CampApplicationAdmin(admin.ModelAdmin):
    list_display = ('reference_number', 'title', 'organisation_name', 'locality', 'camp_date', 'status', 'partner_status')
    list_filter = ('status', 'partner_status', 'locality')
    search_fields = ('reference_number', 'title', 'organisation_name')


admin.site.register(CampEvent)
admin.site.register(CampInterest)
