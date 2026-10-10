from rest_framework import status, views, permissions, generics
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from .models import User
from .serializers import (
    RegisterSerializer,
    LoginSerializer,
    UserProfileSerializer,
    UserDetailWithProfileSerializer
)
from .permissions import IsAdminUserRole
from audit.models import AuditLog


class RegisterView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user, token = serializer.save()
            AuditLog.record(
                actor=user,
                action='USER_REGISTERED',
                target_model='User',
                target_id=user.id,
                details=f"Registered account with role: {user.role}",
                request=request
            )
            data = UserDetailWithProfileSerializer(user).data
            return Response({
                'token': token.key,
                'user': data,
                'message': 'Registration successful'
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            token, _ = Token.objects.get_or_create(user=user)
            AuditLog.record(
                actor=user,
                action='USER_LOGIN',
                target_model='User',
                target_id=user.id,
                details=f"Successful login for role: {user.role}",
                request=request
            )
            data = UserDetailWithProfileSerializer(user).data
            return Response({
                'token': token.key,
                'user': data,
                'message': 'Login successful'
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            request.user.auth_token.delete()
        except Exception:
            pass
        return Response({'message': 'Logged out successfully'}, status=status.HTTP_200_OK)


class CurrentUserView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserDetailWithProfileSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(UserDetailWithProfileSerializer(request.user).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserManagementListView(generics.ListAPIView):
    permission_classes = [IsAdminUserRole]
    serializer_class = UserDetailWithProfileSerializer

    def get_queryset(self):
        queryset = User.objects.all().order_by('-created_at')
        role = self.request.query_params.get('role')
        search = self.request.query_params.get('search')
        if role:
            queryset = queryset.filter(role=role)
        if search:
            queryset = queryset.filter(email__icontains=search) | queryset.filter(first_name__icontains=search)
        return queryset


class UserToggleStatusView(views.APIView):
    permission_classes = [IsAdminUserRole]

    def patch(self, request, pk):
        try:
            target_user = User.objects.get(pk=pk)
            target_user.is_active = not target_user.is_active
            target_user.save()
            AuditLog.record(
                actor=request.user,
                action='TOGGLE_USER_STATUS',
                target_model='User',
                target_id=target_user.id,
                details=f"Toggled user active status to {target_user.is_active}",
                request=request
            )
            return Response({'is_active': target_user.is_active, 'message': 'Status updated'})
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
