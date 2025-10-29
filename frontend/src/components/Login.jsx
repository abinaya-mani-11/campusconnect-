import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/google-login.css';

const Login = () => {
  useEffect(() => {
    document.title = 'CampusConnect - Sign In';
  }, []);

  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [adminCredentials, setAdminCredentials] = useState({ id: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // Check if redirected from Google OAuth with an error
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const loginError = params.get('error');
    if (loginError === 'invalid-email') {
      setError('Google sign-in is restricted to NEC emails only.');
    }
  }, [location.search]);

  const handleGoogleLogin = () => {
    window.location.href = '/auth/google';
  };

  // ---------------- User Login ----------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!credentials.username.toLowerCase().endsWith('@nec.edu.in')) {
        setError('Please use your college email (ending with @nec.edu.in)');
        setIsLoading(false);
        return;
      }

  // Server uses /auth/login in the development server (index.js)
  const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: credentials.username, password: credentials.password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Authentication failed');
      }

      const payload = await response.json();
      const userData = payload.user || payload;
      const token = payload.accessToken || payload.token;
      const refreshToken = payload.refreshToken;

      if (token) {
        try {
          // Store both tokens
          localStorage.setItem('accessToken', token);
          // keep backward-compatible key used in other parts of the app
          localStorage.setItem('jwtToken', token);
          if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken);
          }
          localStorage.setItem('tokenExpiry', new Date(Date.now() + 24*60*60*1000).toISOString()); // 24 hours

          // Also set sessionStorage keys that other components expect
          try {
            sessionStorage.setItem('accessToken', token);
            sessionStorage.setItem('jwtToken', token);
            sessionStorage.setItem('currentFacultyData', JSON.stringify(userData));
          } catch (se) {
            console.warn('Could not set session storage for login:', se);
          }
        } catch (e) {
          console.warn('Could not persist tokens', e);
        }
      }

      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('user', userData.email ? userData.email.split('@')[0] : '');
      localStorage.setItem('userEmail', userData.email || '');
      
      if (userData.email === '2315002@nec.edu.in') {
        localStorage.setItem('isAdmin', 'true');
      }

      // First redirect to faculty registration if not registered
      if (!userData.isRegistered) {
        navigate('/faculty-registration', { replace: true });
      } else {
        // Otherwise go to dashboard
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------- Admin Login ----------------
  const handleAdminLogin = (e) => {
    e.preventDefault();
    setError('');

    // Static admin credentials
    const ADMIN_ID = "admin";
    const ADMIN_PASS = "admin123";

    if (adminCredentials.id === ADMIN_ID && adminCredentials.password === ADMIN_PASS) {
      localStorage.setItem('isAdmin', 'true');
      // mark as authenticated so ProtectedRoute recognizes admin sessions
      localStorage.setItem('isAuthenticated', 'true');
      navigate('/admin/bookings', { replace: true });
    } else {
      setError('Invalid admin credentials.');
    }
  };

  return (
    <div className="login-container">
      {!showAdminLogin ? (
        <form className="login-form" onSubmit={handleSubmit}>
          <h2>CampusConnect</h2>
          <p className="login-subtitle">Sign in to manage venue bookings</p>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">Email</label>
            <input
              type="email"
              id="username"
              name="username"
              placeholder="yourname@nec.edu.in"
              pattern=".+@nec\.edu\.in$"
              title="Please use your college email address (ending with @nec.edu.in)"
              value={credentials.username}
              onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
              required
            />
            <small className="input-helper">Must be a valid college email (@nec.edu.in)</small>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={credentials.password}
              onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
              required
              disabled={isLoading}
            />
          </div>

          <button type="submit" disabled={isLoading} className={isLoading ? 'loading' : ''}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>

          <div className="divider"><span>or</span></div>

          <button type="button" className="google-login-button" onClick={handleGoogleLogin}>
            <img src="/google.svg" alt="Google Logo" />
            Sign in with Google
          </button>

          <div className="admin-link">
            <button type="button" className="admin-login-button" onClick={() => setShowAdminLogin(true)}>
              Admin Login
            </button>
          </div>
        </form>
      ) : (
        <form className="login-form" onSubmit={handleAdminLogin}>
          <h2>Admin Login</h2>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="adminId">Admin ID</label>
            <input
              type="text"
              id="adminId"
              name="adminId"
              value={adminCredentials.id}
              onChange={(e) => setAdminCredentials(prev => ({ ...prev, id: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="adminPassword">Password</label>
            <input
              type="password"
              id="adminPassword"
              name="adminPassword"
              value={adminCredentials.password}
              onChange={(e) => setAdminCredentials(prev => ({ ...prev, password: e.target.value }))}
              required
            />
          </div>

          <div className="admin-actions">
            <button type="submit">Login as Admin</button>
            <button type="button" onClick={() => setShowAdminLogin(false)} className="back-btn">
              Back to User Login
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default Login;
