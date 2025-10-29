import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const tokenExpiry = params.get('tokenExpiry');
    const userDataStr = params.get('userData');

    console.log('OAuthCallback (standalone) params:', { accessToken: !!accessToken, refreshToken: !!refreshToken, hasUserData: !!userDataStr });

    if (accessToken && refreshToken && userDataStr) {
      try {
        let userData;
        try {
          userData = JSON.parse(userDataStr);
        } catch (parseErr) {
          userData = JSON.parse(decodeURIComponent(userDataStr));
        }

        // Persist tokens (both modern and legacy keys) and user info
        localStorage.setItem('accessToken', accessToken);
  // prefer storing new accessToken key, keep jwtToken for compatibility
  localStorage.setItem('jwtToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('tokenExpiry', tokenExpiry);
        localStorage.setItem('userData', JSON.stringify(userData));
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('user', userData.email ? userData.email.split('@')[0] : '');
        localStorage.setItem('userEmail', userData.email || '');
        if (userData.email === '2315002@nec.edu.in') {
          localStorage.setItem('isAdmin', 'true');
        }

        try {
          sessionStorage.setItem('accessToken', accessToken);
          sessionStorage.setItem('jwtToken', accessToken);
          sessionStorage.setItem('currentFacultyData', JSON.stringify(userData));
        } catch (e) {
          console.warn('Could not set session storage for tokens/user:', e);
        }

        const redirectUrl = sessionStorage.getItem('redirectAfterLogin') || '/faculty-registration';
        sessionStorage.removeItem('redirectAfterLogin');

        // small delay to ensure storage is available to other components and ProtectedRoute checks
        // increase slightly to avoid race where ProtectedRoute runs before storage is visible
        setTimeout(() => {
          console.log('OAuthCallback stored tokens, navigating to:', redirectUrl, {
            accessToken: !!localStorage.getItem('accessToken'),
            jwtTokenLocal: !!localStorage.getItem('jwtToken'),
            jwtTokenSession: !!sessionStorage.getItem('jwtToken'),
            currentFacultyData: !!sessionStorage.getItem('currentFacultyData')
          });
          navigate(redirectUrl, { replace: true });
        }, 250);
      } catch (err) {
        console.error('Error handling OAuth redirect:', err);
        navigate('/login?error=auth_error', { replace: true });
      }
    } else {
      navigate('/login?error=missing_tokens', { replace: true });
    }
  }, [location.search, navigate]);

  return <div>Processing OAuth login...</div>;
};

export default OAuthCallback;
