import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

const BookingModal = ({ isOpen, onClose, bookings, venueId, venueDisplayName, onRefresh }) => {
  if (!isOpen) return null;

  const filteredBookings = bookings.filter(
    (booking) => (booking.roomType || '').toLowerCase() === (venueId || '').toLowerCase()
  );

  const formatDateTime = (date, time = '') => {
    if (!date) return 'Not specified';
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    return time ? `${formattedDate}, ${time}` : formattedDate;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Bookings for {venueDisplayName || venueId}</h2>
          <button className="close-button" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          {filteredBookings.length === 0 ? (
            <p>No bookings found for this venue.</p>
          ) : (
            <div className="modal-bookings-list">
                {filteredBookings.map((booking, index) => (
                <div key={index} className="modal-booking-item">
                  {/* don't show status badge for pending bookings */}
                  {booking.status && booking.status.toLowerCase() !== 'pending' && (
                    <div className={`status-badge ${booking.status}`}>
                      {booking.status}
                    </div>
                  )}
                  {booking.roomType === 'delegate' ? (
                    <>
                      <p>
                        <strong>Check-in:</strong> {formatDateTime(booking.checkInDate)}
                      </p>
                      <p>
                        <strong>Check-out:</strong> {formatDateTime(booking.checkOutDate)}
                      </p>
                      <p>
                        <strong>Rooms:</strong> {booking.numRooms}
                      </p>
                      <p>
                        <strong>Guests:</strong> {booking.numGuests}
                      </p>
                      {booking.guestName && (
                        <p>
                          <strong>Guest Name:</strong> {booking.guestName}
                        </p>
                      )}
                      {booking.guestDesignation && (
                        <p>
                          <strong>Guest Designation:</strong> {booking.guestDesignation}
                        </p>
                      )}
                      {booking.organization && (
                        <p>
                          <strong>Organization:</strong> {booking.organization}
                        </p>
                      )}
                      {booking.refreshments && (
                        <p>
                          <strong>Refreshments:</strong> {booking.refreshments === 'yes' ? 'Required' : 'Not required'}
                        </p>
                      )}
                      {booking.specialRequests && (
                        <p>
                          <strong>Special Requests:</strong> {booking.specialRequests}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p>
                        <strong>Date:</strong> {formatDateTime(booking.date)}
                      </p>
                      <p>
                        <strong>Time:</strong> {booking.startTime} - {booking.endTime}
                      </p>
                      <p>
                        <strong>Event:</strong> {booking.eventName}
                      </p>
                      <p>
                        <strong>Attendees:</strong> {booking.numAttendees}
                      </p>
                      {/* Tech park has no special fields */}
                      {(booking.roomType === 'alumni' || booking.roomType === 'assembly' || booking.roomType === 'library' || booking.roomType === 'auditorium') && (
                        <>
                          {booking.mike && parseInt(booking.mike) > 0 && (
                            <p>
                              <strong>Mikes:</strong> {booking.mike}
                            </p>
                          )}
                          {booking.projector && booking.projector !== 'no' && (
                            <p>
                              <strong>Projector:</strong> {booking.projector === 'yes' ? 'Required' : 'Not required'}
                            </p>
                          )}
                        </>
                      )}
                      {booking.roomType === 'auditorium' && (
                        <>
                          {booking.yoga && booking.yoga !== 'no' && (
                            <p>
                              <strong>Yoga Mats:</strong> {booking.yoga === 'yes' ? 'Required' : 'Not required'}
                            </p>
                          )}
                          {booking.bed && booking.bed !== 'no' && (
                            <p>
                              <strong>Beds:</strong> {booking.bed === 'yes' ? 'Required' : 'Not required'}
                            </p>
                          )}
                          {booking.tableArrangement && booking.tableArrangement !== 'none' && (
                            <p>
                              <strong>Table Arrangement:</strong> {booking.tableArrangement === 'stage' ? 'Stage Only' : booking.tableArrangement === 'whole' ? 'Whole Auditorium' : 'No Arrangement'}
                            </p>
                          )}
                        </>
                      )}
                    </>
                  )}
                  {booking.purpose && (
                    <p>
                      <strong>Purpose:</strong> {booking.purpose}
                    </p>
                  )}
                  {/* Cancel button for owner or admin, only for pending bookings */}
                  {booking.status && booking.status.toLowerCase() === 'pending' && (() => {
                    try {
                      const storedUserEmail = localStorage.getItem('userEmail') || '';
                      const sessionUser = (() => {
                        const raw = sessionStorage.getItem('currentFacultyData');
                        return raw ? JSON.parse(raw) : null;
                      })();
                      const currentEmail = sessionUser?.email || storedUserEmail;
                      const isAdmin = localStorage.getItem('isAdmin') === 'true';
                      if (isAdmin || (currentEmail && booking.facultyEmail === currentEmail)) {
                        return (
                          <div style={{ marginTop: '0.75rem' }}>
                            <button
                              className="book-button"
                              onClick={async () => {
                                try {
                                  const token = sessionStorage.getItem('accessToken') || sessionStorage.getItem('jwtToken') || localStorage.getItem('jwtToken');
                                  // normalize booking id (supports {_id: ObjectId}, {_id: { $oid }}, or string id)
                                  const bookingId = booking._id?.toString?.() || booking.id || booking._id?.$oid || String(booking);

                                  if (!bookingId || bookingId === '[object Object]') {
                                    console.error('Invalid bookingId:', bookingId, booking);
                                    alert('Invalid booking ID — cannot cancel');
                                    return;
                                  }

                                  console.log('Cancelling booking id:', bookingId);
                                  const res = await fetch(`http://localhost:5000/api/bookings/${encodeURIComponent(bookingId)}/cancel`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      ...(token && { Authorization: `Bearer ${token}` })
                                    }
                                  });
                                  if (!res.ok) {
                                    let errBody = null;
                                    try {
                                      errBody = await res.json();
                                    } catch (e) {
                                      try { errBody = { error: await res.text() }; } catch (e2) { errBody = { error: 'Unknown error' }; }
                                    }
                                    console.error('Cancel failed', res.status, errBody);
                                    throw new Error(errBody.error || `Failed to cancel booking (status ${res.status})`);
                                  }
                                  // refresh bookings in parent
                                  if (typeof onRefresh === 'function') {
                                    await onRefresh();
                                  }
                                  alert('Booking cancelled successfully');
                                } catch (err) {
                                  console.error('Cancel booking error:', err);
                                  alert(err.message || 'Unable to cancel booking');
                                }
                              }}
                            >
                              Cancel Booking
                            </button>
                          </div>
                        );
                      }
                    } catch (e) {
                      console.warn('Error determining cancel authorization:', e);
                    }
                    return null;
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [facultyData, setFacultyData] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('currentFacultyData') || '{}');
    } catch (e) {
      console.error('Error parsing faculty data:', e);
      return {};
    }
  });

  useEffect(() => {
    // Check for authentication - prefer accessToken, fall back to jwtToken for compatibility
    const token = sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken') || sessionStorage.getItem('jwtToken') || localStorage.getItem('jwtToken');
    if (!token) {
      console.log('No authentication token found, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }

    // Verify token and fetch faculty data if needed
    const fetchFacultyData = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/faculty/profile', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          // If token is expired or invalid, try to refresh it
          if (response.status === 401) {
            const refreshToken = localStorage.getItem('refreshToken');
            if (refreshToken) {
              try {
                const refreshResponse = await fetch('http://localhost:5000/api/auth/refresh-token', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ refreshToken })
                });

                if (refreshResponse.ok) {
                  const refreshData = await refreshResponse.json();
                  // Update tokens in storage
                  localStorage.setItem('accessToken', refreshData.accessToken);
                  localStorage.setItem('jwtToken', refreshData.accessToken);
                  sessionStorage.setItem('accessToken', refreshData.accessToken);
                  sessionStorage.setItem('jwtToken', refreshData.accessToken);
                  if (refreshData.refreshToken) {
                    localStorage.setItem('refreshToken', refreshData.refreshToken);
                  }
                  localStorage.setItem('tokenExpiry', new Date(Date.now() + 24*60*60*1000).toISOString());

                  // Retry the original request with new token
                  const retryResponse = await fetch('http://localhost:5000/api/faculty/profile', {
                    headers: {
                      Authorization: `Bearer ${refreshData.accessToken}`
                    }
                  });

                  if (retryResponse.ok) {
                    const data = await retryResponse.json();
                    sessionStorage.setItem('currentFacultyData', JSON.stringify(data));
                    setFacultyData(data);
                    return;
                  }
                }
              } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
              }
            }
          }
          throw new Error('Failed to verify authentication');
        }

        const data = await response.json();
        sessionStorage.setItem('currentFacultyData', JSON.stringify(data));
        setFacultyData(data);
      } catch (error) {
        console.error('Authentication error:', error);
        navigate('/login', { replace: true });
      }
    };

    if (!facultyData.name) {
      fetchFacultyData();
    }
  }, [navigate, facultyData.name]);

  const handleLogout = () => {
    try {
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('jwtToken');
      sessionStorage.removeItem('currentFacultyData');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('jwtToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('tokenExpiry');
      localStorage.removeItem('isAdmin');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('user');
      localStorage.removeItem('userEmail');
    } catch (e) {}
    navigate('/login', { replace: true });
  };
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!facultyData.name) {
    return <Navigate to="/faculty-registration" replace />;
  }

  // make fetchBookings reusable so we can refresh before showing modal
  const fetchBookings = async () => {
    try {
      setLoading(true);
      const fetchWithAuth = (await import('../utils/fetchWithAuth')).default;

      // Try the newer endpoint first; fetchWithAuth will refresh tokens automatically when needed
      let response = await fetchWithAuth(`http://localhost:5000/api/bookings/user`, { method: 'GET' });

      // fallback to legacy endpoint if the newer one returns 404
      if (response.status === 404) {
        response = await fetchWithAuth(`http://localhost:5000/api/bookings/faculty/${encodeURIComponent(facultyData.email)}`, { method: 'GET' });
      }

      if (!response.ok) {
        let errBody = null;
        try { errBody = await response.json(); } catch (e) { errBody = { error: await response.text() }; }
        throw new Error(errBody.error || 'Failed to fetch bookings');
      }

      const data = await response.json();
      // newer endpoint returns { bookings: [...] }, legacy may return an array directly
      setBookings(Array.isArray(data) ? data : data.bookings || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const venues = [
    { id: 'alumni', name: 'Alumni Chamber' },
    { id: 'assembly', name: 'Assembly Hall' },
    { id: 'auditorium', name: 'Auditorium' },
    { id: 'library', name: 'Library' },
    { id: 'techpark', name: 'Tech Park' },
    { id: 'delegate', name: 'Delegate Residence' },
  ];

  useEffect(() => {
    // fetchBookings is declared below and used both on mount and when opening the modal
    fetchBookings();
  }, []);

  if (loading) return <p>Loading bookings...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="dashboard">
      <div className="dashboard-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1>Welcome, {facultyData.name}</h1>
          <p className="dashboard-subtitle">
            {facultyData.designation} - {facultyData.department?.toUpperCase()} Department
          </p>
        </div>
        <div>
          <button onClick={handleLogout} className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm">Logout</button>
        </div>
      </div>

      <div className="venue-grid">
        {venues.map((venue) => (
          <div key={venue.id} className="venue-card">
            <h2>{venue.name}</h2>
            <div className="venue-buttons">
              <Link to={`/book/${venue.id}`} className="book-button">
                Book Now
              </Link>
              <button
                className="view-bookings-button"
                onClick={async () => {
                  setSelectedVenue(venue.id);
                  // refresh bookings from server before opening modal so statuses are up-to-date
                  await fetchBookings();
                  setIsModalOpen(true);
                }}
              >
                View Bookings
              </button>
            </div>
          </div>
        ))}
      </div>

      <BookingModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedVenue(null);
        }}
        bookings={bookings}
        venueId={selectedVenue}
        venueDisplayName={venues.find(v => v.id === selectedVenue)?.name}
        onRefresh={fetchBookings}
      />
    </div>
  );
};

export default Dashboard;