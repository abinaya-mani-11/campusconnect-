import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import BookingForm from './components/BookingForm';
import Login from './components/Login';
import FacultyRegistration from './components/FacultyRegistration';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Navigate to="/faculty-registration" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty-registration"
            element={
              <ProtectedRoute>
                <FacultyRegistration />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <>
                  <Navigation />
                  <main className="main-content">
                    <Dashboard />
                  </main>
                </>
              </ProtectedRoute>
            }
          />
          <Route
            path="/book/:roomType"
            element={
              <ProtectedRoute>
                <>
                  <Navigation />
                  <main className="main-content">
                    <BookingForm />
                  </main>
                </>
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
