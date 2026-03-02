import { Routes, Route, Navigate } from 'react-router-dom'
import Signup from './pages/Signup'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import FindMate from './pages/FindMate'
import Rooms from './pages/Rooms'
import RoomDetail from './pages/RoomDetail'
import Sessions from './pages/Sessions'
import SessionRoom from './pages/SessionRoom'
import Messages from './pages/Messages'
import Profile from './pages/Profile'
import MainLayout from './components/layout/MainLayout'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import ErrorBoundary from './components/layout/ErrorBoundary'

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
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<Onboarding />} />

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
      </Route>
    </Routes>
  )
}

export default App
