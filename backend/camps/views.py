from datetime import date

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import permissions, status as http
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from accounts.permissions import IsAdminUserRole, IsOrganiserOrAdmin, IsOrganiserUserRole
from . import presenters, service
from .constants import CampStatus
from .models import CampApplication, CampInterest
from .serializers import CampWriteSerializer, PartnerSerializer
from .service import CampError


def error(message, code='invalid', status=http.HTTP_400_BAD_REQUEST):
    return Response({'error': message, 'code': code}, status=status)


def _is_admin(user):
    return bool(user and user.is_authenticated and (user.role == UserRole.ADMIN or user.is_superuser))


class CampView(APIView):
    def handle_exception(self, exc):
        if isinstance(exc, CampError):
            code = {'not_found': http.HTTP_404_NOT_FOUND, 'invalid_transition': http.HTTP_409_CONFLICT,
                    'locked': http.HTTP_409_CONFLICT, 'not_open': http.HTTP_409_CONFLICT}.get(exc.code, http.HTTP_400_BAD_REQUEST)
            return error(exc.message, exc.code, code)
        return super().handle_exception(exc)


def _app_qs():
    return CampApplication.objects.select_related('partner', 'organiser').prefetch_related('events', 'interests')


# ------------------------------------------------------------------------------------------ public
class OptionsView(CampView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(presenters.options_payload(is_admin=_is_admin(request.user)))


def _public_queryset():
    return (_app_qs().filter(status=CampStatus.APPROVED, camp_date__gte=timezone.localdate())
            .annotate(n_interest=Count('interests')))


def _interested_ids(user):
    if user and user.is_authenticated:
        return set(CampInterest.objects.filter(user=user).values_list('application_id', flat=True))
    return set()


class PublicCampListView(CampView):
    """Upcoming approved camps. Search by locality, free text and date range."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = _public_queryset()
        locality = request.query_params.get('locality', '').strip()
        text = request.query_params.get('q', '').strip()
        if locality:
            qs = qs.filter(locality=locality)
        if text:
            qs = qs.filter(Q(title__icontains=text) | Q(organisation_name__icontains=text)
                           | Q(venue_name__icontains=text) | Q(address__icontains=text) | Q(locality__icontains=text))
        for param, lookup in (('date_from', 'camp_date__gte'), ('date_to', 'camp_date__lte')):
            raw = request.query_params.get(param)
            if raw:
                try:
                    qs = qs.filter(**{lookup: date.fromisoformat(raw)})
                except ValueError:
                    return error(f'{param} must be YYYY-MM-DD.', 'invalid_date')
        mine = _interested_ids(request.user)
        rows = [presenters.public_camp(c, c.n_interest, c.pk in mine) for c in qs.order_by('camp_date', 'start_time')[:200]]
        return Response({'count': len(rows), 'results': rows})


class PublicCampDetailView(CampView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        app = _public_queryset().filter(pk=pk).first()
        if app is None:
            return error('Camp not found.', 'not_found', http.HTTP_404_NOT_FOUND)
        return Response(presenters.public_camp(app, app.n_interest, app.pk in _interested_ids(request.user)))


class InterestView(CampView):
    """Register (POST) or withdraw (DELETE) interest. Requires a signed-in account; this is not a booking."""
    permission_classes = [permissions.IsAuthenticated]

    def _respond(self, request, pk, interested):
        service.set_interest(pk, request.user, interested)
        app = _public_queryset().filter(pk=pk).first()
        return Response({'is_interested': interested, 'interest_count': app.n_interest if app else 0})

    def post(self, request, pk):
        return self._respond(request, pk, True)

    def delete(self, request, pk):
        return self._respond(request, pk, False)


class MyInterestsView(CampView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        ids = CampInterest.objects.filter(user=request.user).values_list('application_id', flat=True)
        qs = _app_qs().filter(pk__in=ids, status=CampStatus.APPROVED, camp_date__gte=timezone.localdate()) \
            .annotate(n_interest=Count('interests')).order_by('camp_date')
        return Response({'results': [presenters.public_camp(c, c.n_interest, True) for c in qs]})


# ------------------------------------------------------------------------------------------ applications
class ApplicationListView(CampView):
    """Organisers: their own applications (GET) and submit a new one (POST). Administrators: every application (GET)."""
    permission_classes = [IsOrganiserOrAdmin]

    def get(self, request):
        admin = _is_admin(request.user)
        qs = _app_qs() if admin else _app_qs().filter(organiser=request.user)
        wanted = request.query_params.get('status', '').strip()
        counts = {row['status']: row['n'] for row in qs.values('status').annotate(n=Count('id'))}
        if wanted:
            qs = qs.filter(status=wanted)
        text = request.query_params.get('q', '').strip()
        if text and admin:
            qs = qs.filter(Q(title__icontains=text) | Q(organisation_name__icontains=text)
                           | Q(reference_number__icontains=text) | Q(locality__icontains=text))
        render = presenters.admin_application if admin else presenters.organiser_application
        rows = [render(a, with_events=False) for a in qs.order_by('-created_at')[:300]]
        return Response({'count': len(rows), 'results': rows, 'status_counts': counts})

    def post(self, request):
        if request.user.role != UserRole.ORGANISER:
            return error('Only camp organiser accounts can submit an application.', 'forbidden', http.HTTP_403_FORBIDDEN)
        ser = CampWriteSerializer(data=request.data)
        if not ser.is_valid():
            return Response({'error': 'Please correct the highlighted fields.', 'code': 'validation', 'fields': ser.errors},
                            status=http.HTTP_400_BAD_REQUEST)
        app = service.submit(request.user, ser.validated_data, request)
        return Response(presenters.organiser_application(_app_qs().get(pk=app.pk)), status=http.HTTP_201_CREATED)


class ApplicationDetailView(CampView):
    permission_classes = [IsOrganiserOrAdmin]

    def _get(self, request, pk):
        qs = _app_qs()
        if not _is_admin(request.user):
            qs = qs.filter(organiser=request.user)
        return qs.filter(pk=pk).first()

    def get(self, request, pk):
        app = self._get(request, pk)
        if app is None:
            return error('Camp application not found.', 'not_found', http.HTTP_404_NOT_FOUND)
        render = presenters.admin_application if _is_admin(request.user) else presenters.organiser_application
        return Response(render(app))

    def patch(self, request, pk):
        if request.user.role != UserRole.ORGANISER:
            return error('Only the organiser can edit an application.', 'forbidden', http.HTTP_403_FORBIDDEN)
        ser = CampWriteSerializer(data=request.data, partial=True)
        if not ser.is_valid():
            return Response({'error': 'Please correct the highlighted fields.', 'code': 'validation', 'fields': ser.errors},
                            status=http.HTTP_400_BAD_REQUEST)
        data = dict(ser.validated_data)
        start, end = data.get('start_time'), data.get('end_time')
        existing = CampApplication.objects.filter(pk=pk, organiser=request.user).first()
        if existing is None:
            return error('Camp application not found.', 'not_found', http.HTTP_404_NOT_FOUND)
        if (start or end) and (start or existing.start_time) >= (end or existing.end_time):
            return Response({'error': 'The end time must be after the start time.', 'code': 'validation',
                             'fields': {'end_time': ['The end time must be after the start time.']}}, status=http.HTTP_400_BAD_REQUEST)
        service.edit(pk, request.user, data, request)
        return Response(presenters.organiser_application(_app_qs().get(pk=pk)))


class ApplicationCancelView(CampView):
    permission_classes = [IsOrganiserOrAdmin]

    def post(self, request, pk):
        service.cancel(pk, request.user, request.data.get('reason', ''), request)
        render = presenters.admin_application if _is_admin(request.user) else presenters.organiser_application
        return Response(render(_app_qs().get(pk=pk)))


class ApplicationActionView(CampView):
    """Administrator workflow steps: start_review, partner, approve, reject, complete, note."""
    permission_classes = [IsAdminUserRole]

    def post(self, request, pk):
        action = request.data.get('action')
        user = request.user
        if action == 'start_review':
            service.start_review(pk, user, request)
        elif action == 'partner':
            ser = PartnerSerializer(data=request.data)
            if not ser.is_valid():
                return Response({'error': 'Please correct the partner details.', 'code': 'validation', 'fields': ser.errors},
                                status=http.HTTP_400_BAD_REQUEST)
            service.update_partner(pk, user, ser.validated_data, request)
        elif action == 'approve':
            service.approve(pk, user, request.data.get('note', ''), request)
        elif action == 'reject':
            service.reject(pk, user, request.data.get('reason', ''), request)
        elif action == 'complete':
            raw = request.data.get('actual_donors')
            donors = None
            if raw not in (None, ''):
                try:
                    donors = int(raw)
                    if donors < 0:
                        raise ValueError
                except (TypeError, ValueError):
                    return error('Donor count must be a whole number, 0 or more.', 'invalid_count')
            service.complete(pk, user, donors, request.data.get('notes', ''), request)
        elif action == 'note':
            service.add_note(pk, user, request.data.get('message', ''), bool(request.data.get('visible_to_organiser')), request)
        else:
            return error('Unknown action.', 'unknown_action')
        return Response(presenters.admin_application(_app_qs().get(pk=pk)))
