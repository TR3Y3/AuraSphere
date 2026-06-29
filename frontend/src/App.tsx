import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { CompaniesPage } from './features/companies/CompaniesPage'
import { CompanyDetailPage } from './features/companies/CompanyDetailPage'
import { ContactsPage } from './features/contacts/ContactsPage'
import { ContactDetailPage } from './features/contacts/ContactDetailPage'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/companies" element={<CompaniesPage />} />
              <Route path="/companies/:id" element={<CompanyDetailPage />} />
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/contacts/:id" element={<ContactDetailPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
