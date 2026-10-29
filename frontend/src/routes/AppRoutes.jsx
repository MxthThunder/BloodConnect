import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Layouts
import PublicLayout from '../layouts/PublicLayout';
import DashboardLayout from '../layouts/DashboardLayout';

// Public Pages
import LandingPage from '../pages/LandingPage';
import AboutPage from '../pages/AboutPage';
import HowItWorksPage from '../pages/HowItWorksPage';
import AwarenessPage from '../pages/AwarenessPage';
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import ContactPage from '../pages/ContactPage';

// Requester Pages
import RequesterDashboard from '../pages/requester/RequesterDashboard';
import CreateRequestPage from '../pages/requester/CreateRequestPage';
import MyRequestsPage from '../pages/requester/MyRequestsPage';
import RequestDetailPage from '../pages/requester/RequestDetailPage';
import RequestMatchesPage from '../pages/requester/RequestMatchesPage';
import RequesterNotificationsPage from '../pages/requester/RequesterNotificationsPage';
import RequesterProfilePage from '../pages/requester/RequesterProfilePage';

// Donor Pages
import DonorDashboard from '../pages/donor/DonorDashboard';
import DonorProfilePage from '../pages/donor/DonorProfilePage';
import DonorRelevantRequestsPage from '../pages/donor/DonorRelevantRequestsPage';
import DonorAlertDetailPage from '../pages/donor/DonorAlertDetailPage';
import DonorHistoryPage from '../pages/donor/DonorHistoryPage';
import DonorNotificationsPage from '../pages/donor/DonorNotificationsPage';

// Administrator Pages
import AdminDashboard from '../pages/admin/AdminDashboard';
import VerificationQueuePage from '../pages/admin/VerificationQueuePage';
import RequestManagementPage from '../pages/admin/RequestManagementPage';
import DonorManagementPage from '../pages/admin/DonorManagementPage';
import UserManagementPage from '../pages/admin/UserManagementPage';
import MatchingResultsPage from '../pages/admin/MatchingResultsPage';
import BloodBankStockPage from '../pages/admin/BloodBankStockPage';
import LowStockAlertsPage from '../pages/admin/LowStockAlertsPage';
import NotificationManagementPage from '../pages/admin/NotificationManagementPage';
import AuditLogsPage from '../pages/admin/AuditLogsPage';
import CommandCenterPage from '../pages/admin/CommandCenterPage';
import OutreachEscalationPage from '../pages/admin/OutreachEscalationPage';
import SimulatorPage from '../pages/admin/SimulatorPage';
import StrategyComparisonPage from '../pages/admin/StrategyComparisonPage';
import EscalationSettingsPage from '../pages/admin/EscalationSettingsPage';

// Donation camps
import CampsPage from '../pages/camps/CampsPage';
import CampDetailPage from '../pages/camps/CampDetailPage';

// Organiser Pages
import OrganiserDashboard from '../pages/organiser/OrganiserDashboard';
import ApplyCampPage from '../pages/organiser/ApplyCampPage';
import ApplicationDetailPage from '../pages/organiser/ApplicationDetailPage';
import CampApplicationsPage from '../pages/admin/CampApplicationsPage';
import CampApplicationDetailPage from '../pages/admin/CampApplicationDetailPage';

// Protected Route Guard
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-xs">
        Authenticating session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Redirect to user's authorized portal
    if (role === 'admin') return <Navigate to="/admin-portal/dashboard" replace />;
    if (role === 'donor') return <Navigate to="/donor/dashboard" replace />;
    if (role === 'organiser') return <Navigate to="/organiser/dashboard" replace />;
    return <Navigate to="/requester/dashboard" replace />;
  }

  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Pages */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/awareness" element={<AwarenessPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/camps" element={<CampsPage base="/camps" />} />
        <Route path="/camps/:id" element={<CampDetailPage base="/camps" />} />
      </Route>

      {/* Camp Organiser Portal */}
      <Route
        path="/organiser"
        element={
          <ProtectedRoute allowedRoles={['organiser']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<OrganiserDashboard />} />
        <Route path="apply" element={<ApplyCampPage />} />
        <Route path="applications/:id" element={<ApplicationDetailPage />} />
        <Route path="applications/:id/edit" element={<ApplyCampPage />} />
        <Route path="notifications" element={<RequesterNotificationsPage />} />
      </Route>

      {/* Requester Portal */}
      <Route
        path="/requester"
        element={
          <ProtectedRoute allowedRoles={['requester', 'admin']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<RequesterDashboard />} />
        <Route path="create-request" element={<CreateRequestPage />} />
        <Route path="my-requests" element={<MyRequestsPage />} />
        <Route path="requests/:id" element={<RequestDetailPage />} />
        <Route path="requests/:id/matches" element={<RequestMatchesPage />} />
        <Route path="notifications" element={<RequesterNotificationsPage />} />
        <Route path="profile" element={<RequesterProfilePage />} />
        <Route path="camps" element={<CampsPage base="/requester/camps" />} />
        <Route path="camps/:id" element={<CampDetailPage base="/requester/camps" />} />
      </Route>

      {/* Donor Portal */}
      <Route
        path="/donor"
        element={
          <ProtectedRoute allowedRoles={['donor', 'admin']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<DonorDashboard />} />
        <Route path="profile" element={<DonorProfilePage />} />
        <Route path="requests" element={<DonorRelevantRequestsPage />} />
        <Route path="alerts/:id" element={<DonorAlertDetailPage />} />
        <Route path="history" element={<DonorHistoryPage />} />
        <Route path="notifications" element={<DonorNotificationsPage />} />
        <Route path="camps" element={<CampsPage base="/donor/camps" />} />
        <Route path="camps/:id" element={<CampDetailPage base="/donor/camps" />} />
      </Route>

      {/* Administrator Portal */}
      <Route
        path="/admin-portal"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="command-center" element={<CommandCenterPage />} />
        <Route path="outreach" element={<OutreachEscalationPage />} />
        <Route path="outreach/:caseId" element={<OutreachEscalationPage />} />
        <Route path="simulator" element={<SimulatorPage />} />
        <Route path="strategy-comparison" element={<StrategyComparisonPage />} />
        <Route path="escalation-settings" element={<EscalationSettingsPage />} />
        <Route path="verification-queue" element={<VerificationQueuePage />} />
        <Route path="requests" element={<RequestManagementPage />} />
        <Route path="donors" element={<DonorManagementPage />} />
        <Route path="users" element={<UserManagementPage />} />
        <Route path="matching" element={<MatchingResultsPage />} />
        <Route path="stock" element={<BloodBankStockPage />} />
        <Route path="low-stock" element={<LowStockAlertsPage />} />
        <Route path="notifications" element={<NotificationManagementPage />} />
        <Route path="camps" element={<CampApplicationsPage />} />
        <Route path="camps/:id" element={<CampApplicationDetailPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
      </Route>

      {/* Fallback to Home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
