import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import fetchWithAuth from '../utils/fetchWithAuth';

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const [isValidSession, setIsValidSession] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Synchronous, quick checks to avoid unnecessary redirects (helps with OAuth race)
  const isAuthenticatedLocal = localStorage.getItem("isAuthenticated") === "true";
  const sessionFaculty = sessionStorage.getItem("currentFacultyData");
  const params = new URLSearchParams(location.search);
  const loginError = params.get("error");
  const hasUserDataInUrl = location.search.includes("userData=");

  // If Google OAuth redirected with invalid-email, send back to login with the error
  if (loginError === "invalid-email") {
    return <Navigate to="/login?error=invalid-email" replace />;
  }

  // If any quick auth indicator exists, allow access immediately
  if (isAuthenticatedLocal || sessionFaculty || hasUserDataInUrl) {
    return children;
  }

  useEffect(() => {
    let mounted = true;
    const validateSession = async () => {
      try {
        // Validate session by calling a protected endpoint; fetchWithAuth will attempt refresh if needed
        const resp = await fetchWithAuth('/api/auth/profile', { method: 'GET' });
        if (!resp.ok) {
          throw new Error('Session invalid');
        }
        // success
        if (mounted) setIsValidSession(true);
      } catch (error) {
        console.error("Session validation failed:", error);
        if (mounted) setIsValidSession(false);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("tokenExpiry");
        localStorage.removeItem("isAuthenticated");
      } finally {
        if (mounted) setIsChecking(false);
      }
    };

    validateSession();
    return () => { mounted = false; };
  }, [location.pathname]);

  if (isChecking) return <div>Loading...</div>;

  if (!isValidSession) {
    const currentPath = location.pathname + location.search;
    if (currentPath !== "/login") sessionStorage.setItem("redirectAfterLogin", currentPath);
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;

