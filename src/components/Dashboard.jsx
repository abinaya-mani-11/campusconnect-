import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const BookingModal = ({ isOpen, onClose, bookings, venueName }) => {
  if (!isOpen) return null;

  const filteredBookings = bookings.filter(booking => booking.roomType.toLowerCase() === venueName.toLowerCase());

  const formatDateTime = (date, time = '') => {
    if (!date) return 'Not specified';
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    return time ? `${formattedDate}, ${time}` : formattedDate;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Bookings for {venueName}</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {filteredBookings.length === 0 ? (
            <p>No bookings found for this venue.</p>
          ) : (
            <div className="modal-bookings-list">
              {filteredBookings.map((booking, index) => (
                <div key={index} className="modal-booking-item">
                  <div className={`status-badge ${booking.status}`}>
                    {booking.status}
                  </div>
                  {booking.roomType === 'delegate' ? (
                    <>
                      <p><strong>Check-in:</strong> {formatDateTime(booking.checkInDate)}</p>
                      <p><strong>Check-out:</strong> {formatDateTime(booking.checkOutDate)}</p>
                      <p><strong>Rooms:</strong> {booking.numRooms}</p>
                      <p><strong>Guests:</strong> {booking.numGuests}</p>
                    </>
                  ) : (
                    <>
                      <p><strong>Date:</strong> {formatDateTime(booking.date)}</p>
                      <p><strong>Time:</strong> {booking.startTime} - {booking.endTime}</p>
                      <p><strong>Event:</strong> {booking.eventName}</p>
                      <p><strong>Attendees:</strong> {booking.numAttendees}</p>
                    </>
                  )}
                  {booking.purpose && (
                    <p><strong>Purpose:</strong> {booking.purpose}</p>
                  )}
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
  const facultyData = JSON.parse(sessionStorage.getItem('currentFacultyData') || '{}');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Redirect to faculty registration if no session data
  if (!facultyData.name) {
    return <Navigate to="/faculty-registration" replace />;
  }

  const venues = [
    {
      id: 'alumni',
      name: 'Alumni Chamber',
    },
    {
      id: 'auditorium',
      name: 'Auditorium',
    },
    {
      id: 'library',
      name: 'Library',
    },
    {
      id: 'techpark',
      name: 'Tech Park',
    },
    {
      id: 'delegate',
      name: 'Delegate Residence',
    }
  ];

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const userEmail = localStorage.getItem('user');
        if (!userEmail) {
          setError('User not logged in');
          return;
        }

        const response = await fetch(`http://localhost:5000/api/bookings/faculty/${userEmail}@nec.edu.in`);
        if (!response.ok) {
          throw new Error('Failed to fetch bookings');
        }

        const data = await response.json();
        setBookings(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);



  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome, {facultyData.name}</h1>
        <p className="dashboard-subtitle">
          {facultyData.designation} - {facultyData.department?.toUpperCase()} Department
        </p>
      </div>
      
      <div className="venue-grid">
        {venues.map(venue => (
          <div key={venue.id} className="venue-card">
            <h2>{venue.name}</h2>
            <p>{venue.description}</p>
            <div className="venue-buttons">
              <Link to={`/book/${venue.id}`} className="book-button">
                Book Now
              </Link>
              <button
                className="view-bookings-button"
                onClick={() => {
                  setSelectedVenue(venue.name);
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
        venueName={selectedVenue}
      />
    </div>
  );
};

export default Dashboard;
