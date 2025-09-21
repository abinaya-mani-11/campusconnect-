import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  useEffect(() => {
    document.title = 'CampusConnect - Sign In';
  }, []);
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Simulate API call with setTimeout
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('Attempting login with:', credentials);
      
      // Check if email ends with nec.edu.in
      if (!credentials.username.toLowerCase().endsWith('@nec.edu.in')) {
        setError('Please use your college email (ending with @nec.edu.in)');
        return;
      }

      // Validate credentials
      if (credentials.password === 'admin') {
        // Store the email without the domain part for display
        const displayName = credentials.username.split('@')[0];
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('user', displayName);
        navigate('/', { replace: true });
      } else {
        setError('Invalid password. Please use password: "admin"');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>CampusConnect</h2>
        <p className="login-subtitle">Sign in to manage venue bookings</p>
        {error && <div className="error-message">{error}</div>}
        <div className="form-group">
          <label htmlFor="username">College Email</label>
          <input
            type="email"
            id="username"
            name="username"
            placeholder="yourname@nec.edu.in"
            pattern=".+@nec\.edu\.in$"
            title="Please use your college email address (ending with @nec.edu.in)"
            value={credentials.username}
            onChange={handleChange}
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
            onChange={handleChange}
            required
            disabled={isLoading}
          />
        </div>
        <button type="submit" disabled={isLoading} className={isLoading ? 'loading' : ''}>
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
};

export default Login;
