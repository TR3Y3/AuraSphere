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
import { LoadsPage } from './features/loads/LoadsPage'
import { QuotesPage } from './features/loads/QuotesPage'
import { LoadDetailPage } from './features/loads/LoadDetailPage'
import { ProspectsPage } from './features/prospects/ProspectsPage'
import { CarriersPage } from './features/carriers/CarriersPage'
import { CarrierDetailPage } from './features/carriers/CarrierDetailPage'

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
              <Route path="/carriers" element={<CarriersPage />} />
              <Route path="/carriers/:id" element={<CarrierDetailPage />} />
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/contacts/:id" element={<ContactDetailPage />} />
              <Route path="/loads" element={<LoadsPage />} />
              <Route path="/loads/:id" element={<LoadDetailPage />} />
              <Route path="/quotes" element={<QuotesPage />} />
              <Route path="/prospects" element={<ProspectsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
