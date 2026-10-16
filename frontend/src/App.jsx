import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, lazy, Suspense } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/authStore'
import { useAuthInit } from './hooks/useAuthInit'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { fetchCsrfToken } from './services/api'
import ErrorBoundary from './components/ErrorBoundary'
import SessionExpiryWarning from './components/SessionExpiryWarning'
import Layout from './components/layout/Layout'

const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const OAuthCallback = lazy(() => import('./pages/OAuthCallback'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Profile = lazy(() => import('./pages/Profile'))
const Problems = lazy(() => import('./pages/Problems'))
const Submissions = lazy(() => import('./pages/Submissions'))
const AICoach = lazy(() => import('./pages/AICoach'))
const WeakTopics = lazy(() => import('./pages/WeakTopics'))
const RevisionPlan = lazy(() => import('./pages/RevisionPlan'))
const GitHubRepos = lazy(() => import('./pages/GitHubRepos'))
const Settings = lazy(() => import('./pages/Settings'))
const CodeGraph = lazy(() => import('./pages/CodeGraph'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const NotFound = lazy(() => import('./pages/NotFound'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/login" />
}

function OnboardingRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  if (!isAuthenticated) return <Navigate to="/login" />
  if (user?.onboardingCompleted) return <Navigate to="/dashboard" />
  return children
}

function RequireOnboarding({ children }) {
  const user = useAuthStore((s) => s.user)
  if (user && !user.onboardingCompleted) return <Navigate to="/onboarding" replace />
  return children
}

function PublicRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Navigate to="/dashboard" /> : children
}

function AuthLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-dark-400 text-sm">Loading...</p>
      </div>
    </div>
  )
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function AppRoutes() {
  useKeyboardShortcuts()
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="/onboarding" element={<OnboardingRoute><Onboarding /></OnboardingRoute>} />
        <Route path="/" element={<ProtectedRoute><RequireOnboarding><Layout /></RequireOnboarding></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />
          <Route path="problems" element={<Problems />} />
          <Route path="submissions" element={<Submissions />} />
          <Route path="ai-coach" element={<AICoach />} />
          <Route path="weak-topics" element={<WeakTopics />} />
          <Route path="revision-plan" element={<RevisionPlan />} />
          <Route path="github" element={<GitHubRepos />} />
          <Route path="settings" element={<Settings />} />
          <Route path="code-graph" element={<CodeGraph />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  const authLoading = useAuthInit()

  useEffect(() => {
    fetchCsrfToken()
  }, [])

  if (authLoading) return <AuthLoader />

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router>
          <AppRoutes />
        </Router>
        <Toaster position="top-right" toastOptions={{ className: 'bg-dark-800 text-dark-100 border border-dark-700' }} />
        <SessionExpiryWarning />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
