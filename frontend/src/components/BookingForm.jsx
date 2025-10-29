import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const HALL_CAPACITIES = {
  alumni: 60,
  assembly: 300,
  auditorium: 500,
  library: 50,
  techpark: 100,
  delegate: 1 // Delegate rooms are handled separately per room
};

const BookingForm = () => {
  const { roomType } = useParams();
  const navigate = useNavigate();

  const getInitialFormData = () => {
    const baseFields = {
      date: '',
      startTime: '',
      endTime: '',
      eventName: '',
      numAttendees: '0',
    };

    switch (roomType) {
      case 'techpark':
        return {
          ...baseFields,
          purpose: '',
          numAttendees: '0'
        };
      case 'delegate':
        return {
          numRooms: '1',
          numGuests: '1',
          guestName: '',
          guestDesignation: '',
          organization: '',
          purpose: '',
          checkInDate: '',
          checkOutDate: '',
          refreshments: 'no',
          specialRequests: ''
        };
      case 'auditorium':
        return {
          ...baseFields,
          mike: '0',
          projector: 'no',
          yoga: 'no',
          bed: 'no',
          tableArrangement: 'none'
        };
      case 'alumni':
      case 'assembly':
        return {
          ...baseFields,
          mike: '0',
          projector: 'no'
        };
      case 'library':
        return {
          ...baseFields,
          mike: '0',
          projector: 'no'
        };
      default:
        return {
          ...baseFields,
          mike: '0',
          projector: 'no'
        };
    }
  };

  const [formData, setFormData] = useState(getInitialFormData());
  const [message, setMessage] = useState({ text: '', type: '' });
  const [capacityError, setCapacityError] = useState('');
  const [bookingError, setBookingError] = useState('');

  const handleChange = async (e) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };
    setFormData(newFormData);

    // Clear booking error on date/time changes
    if (name === 'date' || name === 'startTime' || name === 'endTime') {
      setBookingError('');

      // Real-time availability check for non-delegate rooms
      if (roomType !== 'delegate' && newFormData.date && newFormData.startTime && newFormData.endTime) {
        try {
          const response = await fetch(`http://localhost:5000/api/bookings/check-availability?roomType=${roomType}&date=${newFormData.date}&startTime=${newFormData.startTime}&endTime=${newFormData.endTime}`);
          if (!response.ok) {
            throw new Error('Failed to check availability');
          }
          const data = await response.json();
          if (!data.available) {
            setBookingError('This time slot is already booked');
          }
        } catch (error) {
          console.error('Availability check failed:', error);
          // Don't set error on network failure to avoid false positives
        }
      }
    }

    // Real-time capacity validation for attendee counts
    if (name === 'numAttendees') {
      const capacity = HALL_CAPACITIES[roomType] || 50;
      const val = parseInt(value || '0', 10);
      if (val > capacity) {
        setCapacityError(`Number of attendees must be at most ${capacity}`);
      } else {
        setCapacityError('');
      }
    }

    // Delegate room validation: max 2 guests per room
    if (roomType === 'delegate' && (name === 'numGuests' || name === 'numRooms')) {
      const numRooms = parseInt((name === 'numRooms' ? value : formData.numRooms) || '0', 10);
      const numGuests = parseInt((name === 'numGuests' ? value : formData.numGuests) || '0', 10);
      if (numRooms >= 1 && numGuests > numRooms * 2) {
        setCapacityError('Maximum 2 guests per room allowed');
      } else {
        setCapacityError('');
      }
    }
  };

  

  const getCapacityInfo = () => {
    if (roomType === 'delegate') {
      return 'Each room can accommodate up to 2 guests';
    }
    const capacity = HALL_CAPACITIES[roomType] || 50;
    return `Maximum capacity: ${capacity} people`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const storedUser = localStorage.getItem('user');
      const storedUserEmail = localStorage.getItem('userEmail');
      const userEmail = storedUserEmail || (storedUser ? `${storedUser}@nec.edu.in` : null);
      if (!userEmail) {
        throw new Error('Please log in first');
      }

      // Venue-specific validation
      if (roomType === 'delegate') {
        if (!formData.checkInDate || !formData.checkOutDate) {
          setMessage({ text: 'Please fill in check-in and check-out dates', type: 'error' });
          return;
        }
        const checkIn = new Date(formData.checkInDate);
        const checkOut = new Date(formData.checkOutDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (checkIn < today) {
          setMessage({ text: 'Check-in date cannot be in the past', type: 'error' });
          return;
        }
        if (checkOut <= checkIn) {
          setMessage({ text: 'Check-out date must be after check-in date', type: 'error' });
          return;
        }
      } else if (!formData.date || !formData.startTime || !formData.endTime) {
        setMessage({ text: 'Please fill in all required fields', type: 'error' });
        return;
      }

      if (roomType === 'techpark') {
        if (!formData.purpose || !formData.numAttendees) {
          setMessage({ text: 'Please fill in all required fields for Tech Park booking', type: 'error' });
          return;
        }
        if (parseInt(formData.numAttendees) < 1 || parseInt(formData.numAttendees) > HALL_CAPACITIES.techpark) {
          setMessage({ text: `Number of attendees must be between 1 and ${HALL_CAPACITIES.techpark}`, type: 'error' });
          return;
        }
      } else if (roomType === 'delegate') {
        if (!formData.guestName || !formData.guestDesignation || !formData.organization || !formData.purpose) {
          setMessage({ text: 'Please fill in all required fields for Delegate Residence booking', type: 'error' });
          return;
        }
        if (parseInt(formData.numRooms) < 1 || parseInt(formData.numGuests) < 1) {
          setMessage({ text: 'Number of rooms and guests must be at least 1', type: 'error' });
          return;
        }
        if (parseInt(formData.numGuests) > parseInt(formData.numRooms) * 2) {
          setMessage({ text: 'Maximum 2 guests per room allowed', type: 'error' });
          return;
        }
        if (!formData.specialRequests.trim()) {
          setMessage({ text: 'Please provide special requests or requirements', type: 'error' });
          return;
        }
      } else {
        if (!formData.eventName || !formData.numAttendees) {
          setMessage({ text: 'Please fill in event name and number of attendees', type: 'error' });
          return;
        }
        const capacity = HALL_CAPACITIES[roomType] || 50;
        if (parseInt(formData.numAttendees) < 1 || parseInt(formData.numAttendees) > capacity) {
          setMessage({ text: `Number of attendees must be between 1 and ${capacity}`, type: 'error' });
          return;
        }
      }

      const response = await fetch('http://localhost:5000/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          roomType,
    facultyEmail: userEmail,
          status: 'pending'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create booking');
      }

      // Add booking to localStorage so admin dashboard (dev) can see it as pending
      try {
        const saved = await response.json();
        const bookingsRaw = localStorage.getItem('bookings');
        const bookings = bookingsRaw ? JSON.parse(bookingsRaw) : [];
        const newBooking = {
          id: saved.bookingId || `local-${Date.now()}`,
          roomType,
          hall_name: roomType,
          ...formData,
          facultyEmail: userEmail,
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        bookings.push(newBooking);
        localStorage.setItem('bookings', JSON.stringify(bookings));
      } catch (e) {
        console.warn('Could not save booking to localStorage', e);
      }

      setMessage({ text: `✅ ${roomType} booked successfully!`, type: 'success' });
      setFormData(getInitialFormData());
      setBookingError('');

      setTimeout(() => navigate('/dashboard'), 1500);

    } catch (error) {
      if (error.message === 'This time slot is already booked' && roomType !== 'delegate') {
        setBookingError(error.message);
        return;
      }
      setMessage({ text: error.message || 'Failed to submit booking', type: 'error' });
    }
  };

  return (
    <div className="form-container">
      <h2>Book {roomType}</h2>
      <p className="capacity-info">{getCapacityInfo()}</p>
      <form onSubmit={handleSubmit}>
        {roomType === 'delegate' ? (
          <>
            <div className="form-group">
              <label htmlFor="checkInDate">Check-in Date *</label>
              <input
                type="date"
                id="checkInDate"
                name="checkInDate"
                value={formData.checkInDate}
                onChange={handleChange}
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="form-group">
              <label htmlFor="checkOutDate">Check-out Date *</label>
              <input
                type="date"
                id="checkOutDate"
                name="checkOutDate"
                value={formData.checkOutDate}
                onChange={handleChange}
                required
                min={formData.checkInDate || new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="form-group">
              <label htmlFor="numRooms">Number of Rooms *</label>
              <input
                type="number"
                id="numRooms"
                name="numRooms"
                value={formData.numRooms}
                onChange={handleChange}
                min="1"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="numGuests">Number of Guests *</label>
              <input
                type="number"
                id="numGuests"
                name="numGuests"
                value={formData.numGuests}
                onChange={handleChange}
                min="1"
                max={parseInt(formData.numRooms) * 2 || 10}
                required
              />
              {capacityError && <div className="message error" style={{ marginTop: 6 }}>{capacityError}</div>}
            </div>
            <div className="form-group">
              <label htmlFor="guestName">Guest Name *</label>
              <input
                type="text"
                id="guestName"
                name="guestName"
                value={formData.guestName}
                onChange={handleChange}
                placeholder="Enter guest's full name"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="guestDesignation">Guest Designation *</label>
              <input
                type="text"
                id="guestDesignation"
                name="guestDesignation"
                value={formData.guestDesignation}
                onChange={handleChange}
                placeholder="Enter guest's designation"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="organization">Organization *</label>
              <input
                type="text"
                id="organization"
                name="organization"
                value={formData.organization}
                onChange={handleChange}
                placeholder="Enter guest's organization"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="purpose">Purpose of Visit *</label>
              <input
                type="text"
                id="purpose"
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                placeholder="Enter purpose of visit"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="refreshments">Need Refreshments?</label>
              <select
                id="refreshments"
                name="refreshments"
                value={formData.refreshments}
                onChange={handleChange}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
            <div className="form-group" style={{gridColumn: '1 / -1'}}>
              <label htmlFor="specialRequests">Special Requests *</label>
              <textarea
                id="specialRequests"
                name="specialRequests"
                value={formData.specialRequests}
                onChange={handleChange}
                placeholder="Enter any special requirements or requests..."
                rows="3"
                required
              />
            </div>
          </>
        ) : (
          <>
            <div className="form-group">
              <label htmlFor="date">Date *</label>
              <input type="date" id="date" name="date" value={formData.date} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="startTime">Start Time *</label>
              <input type="time" id="startTime" name="startTime" value={formData.startTime} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="endTime">End Time *</label>
              <input type="time" id="endTime" name="endTime" value={formData.endTime} onChange={handleChange} required />
              {bookingError && <div className="message error" style={{ marginTop: 6 }}>{bookingError}</div>}
            </div>
            <div className="form-group">
              <label htmlFor="eventName">Event Name *</label>
              <input type="text" id="eventName" name="eventName" value={formData.eventName} onChange={handleChange} placeholder="Enter event name" required />
            </div>
            <div className="form-group">
              <label htmlFor="numAttendees">Number of Attendees *</label>
              <input type="number" id="numAttendees" name="numAttendees" value={formData.numAttendees} onChange={handleChange} min="1" required />
              {capacityError && <div className="message error" style={{ marginTop: 6 }}>{capacityError}</div>}
            </div>
            {roomType === 'techpark' && (
              <>
                <div className="form-group">
                  <label htmlFor="purpose">Purpose *</label>
                  <input type="text" id="purpose" name="purpose" value={formData.purpose} onChange={handleChange} placeholder="Enter purpose" required />
                </div>
              </>
            )}
            {(roomType === 'alumni' || roomType === 'assembly' || roomType === 'library' || roomType === 'auditorium') && (
              <>
                <div className="form-group">
                  <label htmlFor="mike">Number of Mikes</label>
                  <input type="number" id="mike" name="mike" value={formData.mike} onChange={handleChange} min="0" />
                </div>
                <div className="form-group">
                  <label htmlFor="projector">Need Projector?</label>
                  <select id="projector" name="projector" value={formData.projector} onChange={handleChange}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
              </>
            )}
            {roomType === 'auditorium' && (
              <>
                <div className="form-group">
                  <label htmlFor="yoga">Need Yoga Mats?</label>
                  <select id="yoga" name="yoga" value={formData.yoga} onChange={handleChange}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="bed">Need Beds? (For Blood Donation)</label>
                  <select id="bed" name="bed" value={formData.bed} onChange={handleChange}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="tableArrangement">Table Arrangement</label>
                  <select id="tableArrangement" name="tableArrangement" value={formData.tableArrangement} onChange={handleChange}>
                    <option value="none">No Arrangement</option>
                    <option value="stage">Stage Only</option>
                    <option value="whole">Whole Auditorium</option>
                  </select>
                </div>
              </>
            )}
          </>
        )}

  <button type="submit">Book this Hall</button>
    {message.text && <div className={`message ${message.type}`}>{message.text}</div>}
      </form>
    </div>
  );
};

export default BookingForm;
