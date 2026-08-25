import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore.ts';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { Layout } from './components/Layout.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { MfaPage } from './pages/MfaPage.tsx';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage.tsx';
import { ResetPasswordPage } from './pages/ResetPasswordPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { DeliveryFormPage } from './pages/DeliveryFormPage.tsx';
import { OnboardingPage } from './pages/OnboardingPage.tsx';
import { AdminPage } from './pages/admin/AdminPage.tsx';
import { SetupPage } from './pages/SetupPage.tsx';
import { getSetupStatus } from './services/api.ts';

export function App() {
  const { initialize, initialized, user } = useAuthStore();
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    Promise.all([
      initialize(),
      getSetupStatus()
        .then((res) => setIsConfigured(res.configured))
        .catch(() => setIsConfigured(true)), // If check fails, assume configured to not block
    ]);
  }, [initialize]);

  // Show loader while checking setup status OR auth
  if (isConfigured === null || !initialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-rs-red border-t-transparent mx-auto mb-3" />
          <p className="text-sm text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  // Show setup wizard if not configured
  if (isConfigured === false) {
    return (
      <>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { borderRadius: '10px', background: '#1a1a1a', color: '#fff', fontSize: '14px' },
            success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
            error: { iconTheme: { primary: '#e40000', secondary: '#fff' } },
          }}
        />
        <SetupPage onComplete={() => setIsConfigured(true)} />
      </>
    );
  }

  return (
    <>
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: { borderRadius: '10px', background: '#1a1a1a', color: '#fff', fontSize: '14px' },
        success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
        error: { iconTheme: { primary: '#e40000', secondary: '#fff' } },
      }}
    />
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/mfa" element={user ? <Navigate to="/" replace /> : <MfaPage />} />
      <Route
        path="/forgot-password"
        element={user ? <Navigate to="/" replace /> : <ForgotPasswordPage />}
      />
      <Route
        path="/reset-password"
        element={<ResetPasswordPage />}
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/livrer"
        element={
          <ProtectedRoute>
            <Layout>
              <DeliveryFormPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/livrer/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <DeliveryFormPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <Layout>
              <AdminPage />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
