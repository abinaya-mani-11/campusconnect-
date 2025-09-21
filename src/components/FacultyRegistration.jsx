import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const FacultyRegistration = () => {
  const navigate = useNavigate();
  const userEmail = localStorage.getItem('user');
  const [facultyData, setFacultyData] = useState({
    name: '',
    department: '',
    designation: '',
    email: userEmail ? `${userEmail}@nec.edu.in` : ''
  });

  const departments = [
    { value: 'cse', label: 'Computer Science and Engineering' },
    { value: 'it', label: 'Information Technology' },
    { value: 'aids', label: 'AI & Data Science' },
    { value: 'ece', label: 'Electronics and Communication Engineering' },
    { value: 'eee', label: 'Electrical and Electronics Engineering' },
    { value: 'civil', label: 'Civil Engineering' },
    { value: 'mech', label: 'Mechanical Engineering' }
  ];

  const designations = [
    'Professor',
    'Associate Professor',
    'Assistant Professor',
    'Head of Department',
    'Lab Instructor'
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFacultyData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // Validate required fields
      if (!facultyData.name || !facultyData.department || !facultyData.designation) {
        throw new Error('Please fill in all required fields');
      }

      // Register faculty using API
      const response = await fetch('http://localhost:5000/api/faculty/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(facultyData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Registration failed');
      }
      
      // Store current session data
      sessionStorage.setItem('currentFacultyData', JSON.stringify({
        ...facultyData,
        timestamp: new Date().toISOString()
      }));
      
      // Navigate to the booking dashboard
      navigate('/dashboard', { replace: true });
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
            placeholder="Enter your full name"
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
            {departments.map(dept => (
              <option key={dept.value} value={dept.value}>
                {dept.label}
              </option>
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
            {designations.map(designation => (
              <option key={designation} value={designation}>
                {designation}
              </option>
            ))}
          </select>
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className={isSubmitting ? 'loading' : ''}
        >
          {isSubmitting ? 'Saving...' : 'Submit'}
        </button>
      </form>
    </div>
  );
};

export default FacultyRegistration;
