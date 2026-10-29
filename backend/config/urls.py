from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def api_root(request):
    return JsonResponse({
        'name': 'BloodConnect Emergency Blood Donor Matching & Monitoring API',
        'status': 'healthy',
        'version': '1.0.0',
        'endpoints': {
            'auth': '/api/auth/',
            'donors': '/api/donors/',
            'requests': '/api/requests/',
            'matching': '/api/matching/',
            'bloodbank': '/api/bloodbank/',
            'notifications': '/api/notifications/',
            'audit': '/api/audit/',
            'dashboard': '/api/dashboard/',
            'escalation': '/api/escalation/',
        }
    })


urlpatterns = [
    path('', api_root, name='api_root'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/donors/', include('donors.urls')),
    path('api/requests/', include('blood_requests.urls')),
    path('api/matching/', include('matching.urls')),
    path('api/bloodbank/', include('bloodbank.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/audit/', include('audit.urls')),
    path('api/dashboard/', include('dashboard.urls')),
    path('api/escalation/', include('escalation.urls')),
    path('api/camps/', include('camps.urls')),
]
