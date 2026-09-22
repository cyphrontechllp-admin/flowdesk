import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./components/Shell";
import { Skeleton } from "./components/ui";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Workspace from "./pages/Workspace";

const Intake = lazy(() => import("./pages/Intake"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));

const fallback = (
  <div className="page">
    <Skeleton rows={5} />
  </div>
);

export default function App() {
  return (
    <Suspense fallback={fallback}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Navigate to="/workspace" replace />} />
          <Route path="/workspace" element={<Workspace />} />
          <Route path="/workspace/:id" element={<Workspace />} />
          <Route path="/intake" element={<Intake />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
