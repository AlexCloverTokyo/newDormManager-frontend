import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { MainLayout } from '@/layout/MainLayout'
import { useAuth } from '@/contexts/AuthContext'
import Dashboard from '@/views/Dashboard'
import Login from '@/views/Login'
import DormList from '@/views/dorms/DormList'
import DormDetail from '@/views/dorms/DormDetail'
import RoomDetail from '@/views/rooms/RoomDetail'
import AlertList from '@/views/alerts/AlertList'
import StayList from '@/views/stays/StayList'
import StayDetail from '@/views/stays/StayDetail'
import NewStay from '@/views/stays/NewStay'
import EmployeeList from '@/views/employees/EmployeeList'
import FeeList from '@/views/fees/FeeList'
import ImportPage from '@/views/import/ImportPage'
import UserList from '@/views/admin/UserList'
import SystemSettings from '@/views/admin/SystemSettings'
import MasterSettings from '@/views/admin/MasterSettings'
import OperationLogs from '@/views/admin/OperationLogs'
import CalendarView from '@/views/calendar/CalendarView'
import AnalyticsPage from '@/views/analytics/AnalyticsPage'

function RequireAuth() {
  const { user, isLoading } = useAuth()
  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    )
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function NotFoundRedirect() {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  return <Navigate to={user ? '/' : '/login'} replace />
}

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { index: true, element: <CalendarView /> },
          { path: 'dashboard', element: <Dashboard /> },
          { path: 'analytics', element: <AnalyticsPage /> },
          { path: 'dorms', element: <DormList /> },
          { path: 'dorms/:id', element: <DormDetail /> },
          { path: 'dorms/:id/rooms/:roomId', element: <RoomDetail /> },
          { path: 'employees', element: <EmployeeList /> },
          { path: 'stays', element: <StayList /> },
          { path: 'stays/new', element: <NewStay /> },
          { path: 'stays/:id', element: <StayDetail /> },
          { path: 'fees', element: <FeeList /> },
          { path: 'alerts', element: <AlertList /> },
          { path: 'import', element: <ImportPage /> },
          { path: 'admin/users', element: <UserList /> },
          { path: 'admin/settings', element: <SystemSettings /> },
          { path: 'admin/masters', element: <MasterSettings /> },
          { path: 'admin/logs', element: <OperationLogs /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundRedirect /> },
])
