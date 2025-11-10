// src/App.jsx

import { useRoutes, Navigate } from "react-router-dom"
import { Suspense, lazy, useEffect, useState } from "react"
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
import { OrgProvider } from "./context/OrgContext";
import { getCurrentOrgSummary } from "./api/orgsApi";
import { useAuth } from "./auth/AuthProvider"   // <-- NUEVO

// ===== Lazy pages (admin) =====
const DisciplinesPage    = lazy(() => import("./pages/disciplines/DisciplinesPage"))
const CategoriesPage     = lazy(() => import("./pages/categories/CategoriesPage"))
const SubcategoriesPage  = lazy(() => import("./pages/subcategories/SubcategoriesPage"))
const TestsPage          = lazy(() => import("./pages/admin/TestsPage"))
const TestEditorPage     = lazy(() => import("./pages/admin/TestEditorPage"))

// ===== Lazy pages (perfil / clínica) =====
const ProfilePage             = lazy(() => import("./pages/profile/ProfilePage"))
const UserSettings            = lazy(() => import("./pages/profile/UserSettings"))
const PatientsPage            = lazy(() => import("./pages/clinic/PatientsPage"))
const ClinicAssessmentsPage   = lazy(() => import("./pages/clinic/ClinicAssessmentsPage"))
const ReviewSacksPage         = lazy(() => import("./pages/clinic/ReviewSacksPage"))
const ReviewSacksReadOnly     = lazy(() => import("./pages/clinic/ReviewSacksReadOnly"))
const ReviewSimpleReadOnly    = lazy(() => import("./pages/clinic/ReviewSimpleReadOnly"))
const InterviewPage           = lazy(() => import("./pages/clinic/InterviewPage"))
const ProfessionalsPage       = lazy(() => import("./pages/clinic/ProfessionalsPage"))
const InviteAcceptPage        = lazy(() => import("./pages/public/InviteAcceptPage"))
const BillingPage             =  lazy(() => import("./pages/account/BillingPage"))
const BillingReturn           =  lazy(() => import("./pages/account/BillingReturn"))
const PmReturnPage           =  lazy(() => import("./pages/account/PmReturnPage"))

const Fallback = <div style={{ padding: 16 }}>Cargando…</div>

export default function App() {
  const [orgSummary, setOrgSummary] = useState(null);
  const { token, isAuthenticated } = useAuth()

  useEffect(() => {
    let mounted = true;
    // si NO hay sesión, reset a defaults y no llames al endpoint
    if (!isAuthenticated) {
      if (mounted) setOrgSummary({ planCode: "solo", status: "none", seats: 1, kind: "solo" });
      return () => { mounted = false };
    }

    (async () => {
      try {
        const data = await getCurrentOrgSummary();
        if (mounted) setOrgSummary(data);
      } catch (e) {
        // fallback seguro para no romper el flujo "solo"
        if (mounted) setOrgSummary({ planCode: "solo", status: "none", seats: 1, kind: "solo" });
      }
    })();

    return () => { mounted = false; };
  }, [token, isAuthenticated]);

  const routesElement = useRoutes([
    { path: "/", element: <Landing /> },
    {
      path: "/invite/accept",
      element: (
        <Suspense fallback={Fallback}>
          <InviteAcceptPage />
        </Suspense>
      ),
    },

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
        {
          path: "usersettings",
          element: (
            <Suspense fallback={Fallback}>
              <UserSettings />
            </Suspense>
          ),
        },
        {
          path: "account/billing",
          element: (
            <Suspense fallback={Fallback}>
              <BillingPage  />
            </Suspense>
          ),
        },
        // ===== Clínica (profesionales) =====
        {
          path: "clinic/profesionales",
          element: (
            <RequireAuth allowedRoles={[ROLES.EDITOR, ROLES.ADMIN]}>
              <Suspense fallback={Fallback}>
                {(() => {
                  // Guard simple por orgKind: si es "solo", redirige
                  // Nota: el hook useOrgKind solo puede usarse dentro de Provider,
                  // por eso este guard está en línea dentro del árbol /app (ya envuelto abajo)
                  const Guard = () => {
                    // para evitar hook en toplevel aquí, hacemos un lazy guard en ProfessionalsPage si prefieres
                    // pero si ya tienes useOrgKind, puedes mantener el guard en el propio componente de página
                    return <ProfessionalsPage />
                  }
                  return <Guard />
                })()}
              </Suspense>
            </RequireAuth>
          ),
        },

        // ===== Clínica (resto) =====
        {
          path: "clinic/pacientes",
          element: (
            <RequireAuth allowedRoles={[ROLES.EDITOR, ROLES.ADMIN, ROLES.VIEWER]}>
              <Suspense fallback={Fallback}>
                <PatientsPage />
              </Suspense>
            </RequireAuth>
          ),
        },
        {
          path: "clinic/evaluaciones",
          element: (
            <RequireAuth allowedRoles={[ROLES.EDITOR, ROLES.ADMIN, ROLES.VIEWER]}>
              <Suspense fallback={Fallback}>
                <ClinicAssessmentsPage />
              </Suspense>
            </RequireAuth>
          ),
        },
        {
          path: "clinic/entrevista",
          element: (
            <RequireAuth allowedRoles={[ROLES.EDITOR, ROLES.ADMIN, ROLES.VIEWER]}>
              <Suspense fallback={Fallback}>
                <InterviewPage />
              </Suspense>
            </RequireAuth>
          ),
        },

        // === RUTAS ÚNICAS (sin duplicados) ===
        {
          path: "clinic/review/:attemptId",
          element: (
            <RequireAuth allowedRoles={[ROLES.EDITOR, ROLES.ADMIN, ROLES.VIEWER]}>
              <Suspense fallback={Fallback}>
                <ReviewSacksPage />
              </Suspense>
            </RequireAuth>
          ),
        },
        {
          path: "clinic/review/:attemptId/read",
          element: (
            <RequireAuth allowedRoles={[ROLES.EDITOR, ROLES.ADMIN, ROLES.VIEWER]}>
              <Suspense fallback={Fallback}>
                <ReviewSacksReadOnly />
              </Suspense>
            </RequireAuth>
          ),
        },
        {
          path: "clinic/review/:attemptId/simple",
          element: (
            <RequireAuth allowedRoles={[ROLES.EDITOR, ROLES.ADMIN, ROLES.VIEWER]}>
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
    { path: "/account/billing/return", element:<BillingReturn />},
    { path: "/account/billing/pm-return", element:<PmReturnPage />},
    { path: "/403", element: <Forbidden /> },
    { path: "/pricing", element: <Pricing /> },
    { path: "/login", element: <LoginBlock /> },
    { path: "/signup", element: <SignupBlock /> },
    { path: "*", element: <Navigate to="/" replace /> },
  ])

  return (
    <OrgProvider key={orgSummary ? `${orgSummary.planCode}:${orgSummary.seats}:${orgSummary.kind}` : 'init'}
      initialSummary={
        orgSummary
          ? {
              planCode: orgSummary.planCode,
              status: orgSummary.status,
              seats: orgSummary.seats,
              orgKind: orgSummary.kind,
            }
          : undefined
      }
    >
      {routesElement}
    </OrgProvider>
  )
}
