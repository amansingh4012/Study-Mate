import { Routes, Route, Navigate } from 'react-router-dom'
import Signup from './pages/Signup'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import AuthCallback from './pages/AuthCallback'
import VerifyEmail from './pages/VerifyEmail'
import Home from './pages/Home'
import FindMate from './pages/FindMate'
import Rooms from './pages/Rooms'
import RoomDetail from './pages/RoomDetail'
import Sessions from './pages/Sessions'
import SessionRoom from './pages/SessionRoom'
import Messages from './pages/Messages'
import Profile from './pages/Profile'
import Search from './pages/Search'
import Discover from './pages/Discover'
import AdminOverview from './pages/admin/AdminOverview'
import AdminUsers from './pages/admin/AdminUsers'
import AdminRooms from './pages/admin/AdminRooms'
import AdminReports from './pages/admin/AdminReports'
import AdminSessions from './pages/admin/AdminSessions'
import MainLayout from './components/layout/MainLayout'
import AdminLayout from './components/layout/AdminLayout'
import { ProtectedRoute, AdminRoute } from './components/layout/ProtectedRoute'
import ErrorBoundary from './components/layout/ErrorBoundary'
import Landing from './pages/Landing'

// Wrap pages in ErrorBoundary
const withErrorBoundary = (Component) => (
  <ErrorBoundary>
    <Component />
  </ErrorBoundary>
)

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/confirm" element={<AuthCallback />} />

      {/* Protected routes with MainLayout */}
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/home" element={withErrorBoundary(Home)} />
        <Route path="/find-mate" element={withErrorBoundary(FindMate)} />
        <Route path="/rooms" element={withErrorBoundary(Rooms)} />
        <Route path="/rooms/:roomId" element={withErrorBoundary(RoomDetail)} />
        <Route path="/sessions" element={withErrorBoundary(Sessions)} />
        <Route path="/sessions/:sessionId" element={withErrorBoundary(SessionRoom)} />
        <Route path="/messages" element={withErrorBoundary(Messages)} />
        <Route path="/profile" element={withErrorBoundary(Profile)} />
        <Route path="/profile/:userId" element={withErrorBoundary(Profile)} />
        <Route path="/search" element={withErrorBoundary(Search)} />
        <Route path="/discover" element={withErrorBoundary(Discover)} />
      </Route>

      {/* Admin routes */}
      <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route path="/admin" element={withErrorBoundary(AdminOverview)} />
        <Route path="/admin/users" element={withErrorBoundary(AdminUsers)} />
        <Route path="/admin/rooms" element={withErrorBoundary(AdminRooms)} />
        <Route path="/admin/reports" element={withErrorBoundary(AdminReports)} />
        <Route path="/admin/sessions" element={withErrorBoundary(AdminSessions)} />
      </Route>
    </Routes>
  )
}

export default App
