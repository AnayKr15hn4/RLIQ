import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/Dashboard";
import QuizBuilder from "@/pages/QuizBuilder";
import QuizPlayer from "@/pages/QuizPlayer";
import Results from "@/pages/Results";
import VerifyEmail from "@/pages/VerifyEmail";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import LoadingRule from "@/components/LoadingRule";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingRule />;
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="App">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/quizzes/new"
              element={
                <PrivateRoute>
                  <QuizBuilder />
                </PrivateRoute>
              }
            />
            <Route
              path="/quizzes/:id/edit"
              element={
                <PrivateRoute>
                  <QuizBuilder edit />
                </PrivateRoute>
              }
            />
            <Route
              path="/quizzes/:id/play"
              element={
                <PrivateRoute>
                  <QuizPlayer />
                </PrivateRoute>
              }
            />
            <Route
              path="/quizzes/:id/results/:attemptId"
              element={
                <PrivateRoute>
                  <Results />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster theme="dark" position="top-right" />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
