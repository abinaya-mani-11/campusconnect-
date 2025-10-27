import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const FacultyRegistration = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [facultyData, setFacultyData] = useState({
    name: "",
    email: "",
    department: "",
    designation: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const departments = [
    { value: "cse", label: "Computer Science and Engineering" },
    { value: "it", label: "Information Technology" },
    { value: "aids", label: "AI & Data Science" },
    { value: "ece", label: "Electronics and Communication Engineering" },
    { value: "eee", label: "Electrical and Electronics Engineering" },
    { value: "civil", label: "Civil Engineering" },
    { value: "mech", label: "Mechanical Engineering" }
  ];

  const designations = [
    "Professor",
    "Associate Professor",
    "Assistant Professor",
    "Head of Department",
    "Lab Instructor"
  ];

  // Parse JWT from URL (Google OAuth) or use existing session token
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const userDataParam = params.get('userData');
    const tokenParam = params.get('token');

    // If token present, save it and fetch profile
    if (tokenParam) {
      try {
        // store token in session and local so other components can use it
  // store both accessToken (preferred) and jwtToken for compatibility
  sessionStorage.setItem('accessToken', tokenParam);
  sessionStorage.setItem('jwtToken', tokenParam);
  localStorage.setItem('accessToken', tokenParam);
  localStorage.setItem('jwtToken', tokenParam);

        // fetch profile
        (async () => {
          try {
            const resp = await fetch('http://localhost:5000/api/auth/profile', {
              headers: { Authorization: `Bearer ${tokenParam}` }
            });
            if (resp.ok) {
              const json = await resp.json();
              const user = json.user || {};
              setFacultyData(prev => ({ ...prev, name: user.name || '', email: user.email || '' }));
              const userData = { name: user.name || '', email: user.email || '' };
              sessionStorage.setItem('currentFacultyData', JSON.stringify(userData));
              try {
                localStorage.setItem('user', user.email ? user.email.split('@')[0] : '');
                localStorage.setItem('userEmail', user.email || '');
              } catch (e) {
                console.warn('Could not set localStorage user data', e);
              }
            } else {
              console.warn('Profile fetch failed after token redirect');
            }
          } catch (err) {
            console.error('Error fetching profile with token:', err);
          }
        })();

        // Clean URL
        navigate('/faculty-registration', { replace: true });
        return;
      } catch (err) {
        console.error('Error handling token param:', err);
      }
    }

    if (userDataParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userDataParam));
        setFacultyData(prev => ({
          ...prev,
          name: userData.name || '',
          email: userData.email || ''
        }));

        // Store in sessionStorage so ProtectedRoute sees it
        sessionStorage.setItem('currentFacultyData', JSON.stringify(userData));

        // Also store localStorage keys used by Dashboard
        try {
          localStorage.setItem('user', userData.email ? userData.email.split('@')[0] : '');
          localStorage.setItem('userEmail', userData.email || '');
        } catch (e) {
          console.warn('Could not set localStorage user data', e);
        }

        // Clean URL without reloading
        navigate('/faculty-registration', { replace: true });
      } catch (err) {
        console.error('Error parsing userData from URL:', err);
      }
    }
}, [location.search, navigate]);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFacultyData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      if (!facultyData.name || !facultyData.email || !facultyData.department || !facultyData.designation) {
        throw new Error("Please fill in all required fields");
      }

  // prefer accessToken, fall back to legacy jwtToken
  const token = sessionStorage.getItem('accessToken') || sessionStorage.getItem("jwtToken") || localStorage.getItem('jwtToken');
      const response = await fetch("http://localhost:5000/api/faculty/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` })
        },
        body: JSON.stringify(facultyData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Registration failed");
      }

      // Save session data
      sessionStorage.setItem("currentFacultyData", JSON.stringify({
        ...facultyData,
        timestamp: new Date().toISOString()
      }));

      // also set localStorage keys used by Dashboard fetch
      try {
        localStorage.setItem('user', facultyData.email ? facultyData.email.split('@')[0] : '');
        localStorage.setItem('userEmail', facultyData.email || '');
      } catch (e) {
        console.warn('Could not set localStorage user data', e);
      }

      // Navigate to dashboard
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="faculty-registration-container">
      <form className="faculty-form" onSubmit={handleSubmit}>
        <h2>Faculty Profile</h2>
        <p className="form-subtitle">Please complete your profile to continue</p>
        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={facultyData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={facultyData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="department">Department</label>
          <select
            id="department"
            name="department"
            value={facultyData.department}
            onChange={handleChange}
            required
          >
            <option value="">Select Department</option>
            {departments.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="designation">Designation</label>
          <select
            id="designation"
            name="designation"
            value={facultyData.designation}
            onChange={handleChange}
            required
          >
            <option value="">Select Designation</option>
            {designations.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Submit"}
        </button>
      </form>
    </div>
  );
};

export default FacultyRegistration;





