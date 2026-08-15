import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { AssessmentForm } from "./pages/AssessmentForm";
import { ChecklistLibrary } from "./pages/ChecklistLibrary";
import { ActionPlanPage } from "./pages/ActionPlan";
import { TeamsAdmin } from "./pages/TeamsAdmin";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/assessment/new" element={<AssessmentForm />} />
            <Route path="/checklist" element={<ChecklistLibrary />} />
            <Route path="/action-plan" element={<ActionPlanPage />} />
            <Route path="/teams" element={<TeamsAdmin />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
