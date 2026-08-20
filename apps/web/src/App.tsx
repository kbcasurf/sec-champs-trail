import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AdminRoute } from "./auth/AdminRoute";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { AssessmentForm } from "./pages/AssessmentForm";
import { ChecklistLibrary } from "./pages/ChecklistLibrary";
import { ActionPlanPage } from "./pages/ActionPlan";
import { TrainingTrackPage } from "./pages/TrainingTrack";
import { ExecutiveReportPage } from "./pages/ExecutiveReport";
import { TrainingTrackPrintPage } from "./pages/TrainingTrackPrint";
import { ExecutiveReportPrintPage } from "./pages/ExecutiveReportPrint";
import { TeamsAdmin } from "./pages/TeamsAdmin";
import { NotFound } from "./pages/NotFound";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/assessment/new" element={<AssessmentForm />} />
            <Route path="/checklist" element={<ChecklistLibrary />} />
            <Route path="/action-plan" element={<ActionPlanPage />} />
            <Route path="/training-tracks" element={<TrainingTrackPage />} />
            <Route path="/training-tracks/:id/print" element={<TrainingTrackPrintPage />} />
            <Route element={<AdminRoute />}>
              <Route path="/executive-reports" element={<ExecutiveReportPage />} />
              <Route path="/executive-reports/:id/print" element={<ExecutiveReportPrintPage />} />
              <Route path="/teams" element={<TeamsAdmin />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
