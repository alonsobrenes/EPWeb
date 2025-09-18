// src/App.jsx
import { useRoutes, Navigate } from "react-router-dom"
import { Suspense, lazy } from "react"
import RequireAuth from "./auth/RequireAuth"
import Dashboard from "./pages/Dashboard"
import LoginBlock from "./pages/LoginBlock"
import SignupBlock from "./pages/SignupBlock"
import Landing from "./pages/Landing"
import Forbidden from "./pages/Forbidden"
import Pricing from "./pages/Pricing"
import SearchResultsPage from "./pages/search/SearchResultsPage"
import AppShellSidebarCollapsible from "./components/AppShellSidebarCollapsible"
import ErrorBoundary from "./components/ErrorBoundary"
import { ROLES } from "./auth/roles"

// ===== Lazy pages (admin) =====
const DisciplinesPage    = lazy(() => import("./pages/disciplines/DisciplinesPage"))
const CategoriesPage     = lazy(() => import("./pages/categories/CategoriesPage"))
const SubcategoriesPage  = lazy(() => import("./pages/subcategories/SubcategoriesPage"))
const TestsPage          = lazy(() => import("./pages/admin/TestsPage"))
const TestEditorPage     = lazy(() => import("./pages/admin/TestEditorPage"))

// ===== Lazy pages (perfil / clínica) =====
const ProfilePage             = lazy(() => import("./pages/profile/ProfilePage"))
const PatientsPage            = lazy(() => import("./pages/clinic/PatientsPage"))
const ClinicAssessmentsPage   = lazy(() => import("./pages/clinic/ClinicAssessmentsPage"))
const ReviewSacksPage         = lazy(() => import("./pages/clinic/ReviewSacksPage"))
const ReviewSacksReadOnly     = lazy(() => import("./pages/clinic/ReviewSacksReadOnly"))
const ReviewSimpleReadOnly    = lazy(() => import("./pages/clinic/ReviewSimpleReadOnly"))
const InterviewPage    = lazy(() => import("./pages/clinic/InterviewPage"))

const Fallback = <div style={{ padding: 16 }}>Cargando…</div>

export default function App() {
  return useRoutes([
    { path: "/", element: <Landing /> },

    // Zona autenticada
    {
      path: "/app",
      element: (
        <RequireAuth>
          <ErrorBoundary>
            <AppShellSidebarCollapsible />
          </ErrorBoundary>
        </RequireAuth>
      ),
      children: [
        { index: true, element: <Dashboard /> },
        {
          path: "search",
          element: (
            <Suspense fallback={Fallback}>
              <SearchResultsPage />
            </Suspense>
          ),
        },
        // Perfil (cualquier autenticado)
        {
          path: "perfil",
          element: (
            <Suspense fallback={Fallback}>
              <ProfilePage />
            </Suspense>
          ),
        },

        // ===== Clínica (profesionales) =====
        {
          path: "clinic/pacientes",
          element: (
            <RequireAuth allowedRoles={[ROLES.EDITOR, ROLES.ADMIN]}>
              <Suspense fallback={Fallback}>
                <PatientsPage />
              </Suspense>
            </RequireAuth>
          ),
        },
        {
          path: "clinic/evaluaciones",
          element: (
            <RequireAuth allowedRoles={[ROLES.EDITOR, ROLES.ADMIN]}>
              <Suspense fallback={Fallback}>
                <ClinicAssessmentsPage />
              </Suspense>
            </RequireAuth>
          ),
        },
        {
          path: "clinic/entrevista",
          element: (
            <RequireAuth allowedRoles={[ROLES.EDITOR, ROLES.ADMIN]}>
              <Suspense fallback={Fallback}>
                <InterviewPage />
              </Suspense>
            </RequireAuth>
          ),
        },

        // === RUTAS ÚNICAS (sin duplicados) ===
        // SACKS editable
        {
          path: "clinic/review/:attemptId",
          element: (
            <RequireAuth allowedRoles={[ROLES.EDITOR, ROLES.ADMIN]}>
              <Suspense fallback={Fallback}>
                <ReviewSacksPage />
              </Suspense>
            </RequireAuth>
          ),
        },
        // SACKS read-only
        {
          path: "clinic/review/:attemptId/read",
          element: (
            <RequireAuth allowedRoles={[ROLES.EDITOR, ROLES.ADMIN]}>
              <Suspense fallback={Fallback}>
                <ReviewSacksReadOnly />
              </Suspense>
            </RequireAuth>
          ),
        },
        // NO-SACKS read-only (tabla)
        {
          path: "clinic/review/:attemptId/simple",
          element: (
            <RequireAuth allowedRoles={[ROLES.EDITOR, ROLES.ADMIN]}>
              <Suspense fallback={Fallback}>
                <ReviewSimpleReadOnly />
              </Suspense>
            </RequireAuth>
          ),
        },

        // ===== Gestión (solo admin) =====
        {
          path: "disciplines",
          element: (
            <RequireAuth allowedRoles={[ROLES.ADMIN]}>
              <Suspense fallback={Fallback}>
                <DisciplinesPage />
              </Suspense>
            </RequireAuth>
          ),
        },
        {
          path: "categories",
          element: (
            <RequireAuth allowedRoles={[ROLES.ADMIN]}>
              <Suspense fallback={Fallback}>
                <CategoriesPage />
              </Suspense>
            </RequireAuth>
          ),
        },
        {
          path: "subcategories",
          element: (
            <RequireAuth allowedRoles={[ROLES.ADMIN]}>
              <Suspense fallback={Fallback}>
                <SubcategoriesPage />
              </Suspense>
            </RequireAuth>
          ),
        },
        {
          path: "tests",
          element: (
            <RequireAuth allowedRoles={[ROLES.ADMIN]}>
              <Suspense fallback={Fallback}>
                <TestsPage />
              </Suspense>
            </RequireAuth>
          ),
        },
        {
          path: "tests/:id",
          element: (
            <RequireAuth allowedRoles={[ROLES.ADMIN]}>
              <Suspense fallback={Fallback}>
                <TestEditorPage />
              </Suspense>
            </RequireAuth>
          ),
        },
      ],
    },
    { path: "/403", element: <Forbidden /> },
    { path: "/pricing", element: <Pricing /> },
    { path: "/login", element: <LoginBlock /> },
    { path: "/signup", element: <SignupBlock /> },
    { path: "*", element: <Navigate to="/" replace /> },
  ])
}
