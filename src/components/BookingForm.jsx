import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const HALL_CAPACITIES = {
  alumni: 60,
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
          numComputers: '0',
          internetRequired: 'no',
          projector: 'no',
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
          checkOutDate: ''
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Get user email from storage
      const userEmail = localStorage.getItem('user');
      if (!userEmail) {
        throw new Error('Please log in first');
      }

      // Send booking request to API
      const response = await fetch('http://localhost:5000/api/bookings/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          roomType,
          facultyEmail: `${userEmail}@nec.edu.in`,
          status: 'pending'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create booking');
      }

      setMessage({ 
        text: 'Booking submitted successfully!', 
        type: 'success' 
      });
      
      // Clear form
      setFormData(getInitialFormData());
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (error) {
      setMessage({ 
        text: error.message || 'Failed to submit booking', 
        type: 'error' 
      });
    }
    // Check required fields based on room type
    if (roomType === 'delegate') {
      if (!formData.checkInDate || !formData.checkOutDate) {
        setMessage({
          text: 'Please fill in check-in and check-out dates',
          type: 'error'
        });
        return;
      }
      
      // Validate check-in and check-out dates
      const checkIn = new Date(formData.checkInDate);
      const checkOut = new Date(formData.checkOutDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (checkIn < today) {
        setMessage({
          text: 'Check-in date cannot be in the past',
          type: 'error'
        });
        return;
      }

      if (checkOut <= checkIn) {
        setMessage({
          text: 'Check-out date must be after check-in date',
          type: 'error'
        });
        return;
      }
    } else if (!formData.date || !formData.startTime || !formData.endTime) {
      setMessage({
        text: 'Please fill in all required fields',
        type: 'error'
      });
      return;
    }

    // Venue-specific validation
    if (roomType === 'techpark') {
      if (!formData.purpose || !formData.numAttendees) {
        setMessage({
          text: 'Please fill in all required fields for Tech Park booking',
          type: 'error'
        });
        return;
      }
      if (parseInt(formData.numAttendees) < 1 || parseInt(formData.numAttendees) > HALL_CAPACITIES.techpark) {
        setMessage({
          text: `Number of attendees must be between 1 and ${HALL_CAPACITIES.techpark}`,
          type: 'error'
        });
        return;
      }
    } else if (roomType === 'delegate') {
      if (!formData.guestName || !formData.guestDesignation || !formData.organization || !formData.purpose) {
        setMessage({
          text: 'Please fill in all required fields for Delegate Residence booking',
          type: 'error'
        });
        return;
      }
      if (parseInt(formData.numRooms) < 1 || parseInt(formData.numGuests) < 1) {
        setMessage({
          text: 'Number of rooms and guests must be at least 1',
          type: 'error'
        });
        return;
      }
      // Add guest limits per room validation
      if (parseInt(formData.numGuests) > parseInt(formData.numRooms) * 2) {
        setMessage({
          text: 'Maximum 2 guests per room allowed',
          type: 'error'
        });
        return;
      }
    } else {
      if (!formData.eventName || !formData.numAttendees) {
        setMessage({
          text: 'Please fill in event name and number of attendees',
          type: 'error'
        });
        return;
      }
      const capacity = HALL_CAPACITIES[roomType] || 50; // Default to 50 if not specified
      if (parseInt(formData.numAttendees) < 1 || parseInt(formData.numAttendees) > capacity) {
        setMessage({
          text: `Number of attendees must be between 1 and ${capacity}`,
          type: 'error'
        });
        return;
      }
    }

    // Here you would typically make an API call to check for conflicts
    // For now, we'll simulate a successful booking
    setMessage({
      text: `✅ ${roomType} booked successfully!`,
      type: 'success'
    });
    
    // Navigate back to dashboard after 1.5 seconds
    setTimeout(() => {
      navigate('/dashboard');
    }, 1500);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getCapacityInfo = () => {
    if (roomType === 'delegate') {
      return 'Each room can accommodate up to 2 guests';
    }
    const capacity = HALL_CAPACITIES[roomType] || 50;
    return `Maximum capacity: ${capacity} people`;
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
          </>
        ) : (
          <>
            <div className="form-group">
              <label htmlFor="date">Date *</label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="startTime">Start Time *</label>
              <input
                type="time"
                id="startTime"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="endTime">End Time *</label>
              <input
                type="time"
                id="endTime"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                required
              />
            </div>
          </>
        )}

        {roomType === 'techpark' ? (
          <>
            <div className="form-group">
              <label htmlFor="numComputers">Number of Computers Required</label>
              <input
                type="number"
                id="numComputers"
                name="numComputers"
                min="0"
                value={formData.numComputers}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="internetRequired">Internet Required?</label>
              <select
                id="internetRequired"
                name="internetRequired"
                value={formData.internetRequired}
                onChange={handleChange}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="projector">Need Projector?</label>
              <select
                id="projector"
                name="projector"
                value={formData.projector}
                onChange={handleChange}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="purpose">Purpose of Booking *</label>
              <input
                type="text"
                id="purpose"
                name="purpose"
                value={formData.purpose}
                onChange={handleChange}
                required
                placeholder="e.g., Technical Workshop, Training"
              />
            </div>

            <div className="form-group">
              <label htmlFor="numAttendees">Number of Attendees *</label>
              <input
                type="number"
                id="numAttendees"
                name="numAttendees"
                min="1"
                value={formData.numAttendees}
                onChange={handleChange}
                required
              />
            </div>
          </>
        ) : roomType === 'delegate' ? (
          <>
            <div className="form-group">
              <label htmlFor="numRooms">Number of Rooms Required * (Each room can accommodate up to 2 guests)</label>
              <input
                type="number"
                id="numRooms"
                name="numRooms"
                min="1"
                max="5"
                value={formData.numRooms}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="numGuests">Total Number of Guests * (Maximum 2 per room)</label>
              <input
                type="number"
                id="numGuests"
                name="numGuests"
                min="1"
                value={formData.numGuests}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="guestName">Primary Guest Name *</label>
              <input
                type="text"
                id="guestName"
                name="guestName"
                value={formData.guestName}
                onChange={handleChange}
                required
                placeholder="Enter primary guest's full name"
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
                required
                placeholder="e.g., Professor, Industry Expert"
              />
            </div>

            <div className="form-group">
              <label htmlFor="organization">Organization/Institution *</label>
              <input
                type="text"
                id="organization"
                name="organization"
                value={formData.organization}
                onChange={handleChange}
                required
                placeholder="Enter organization name"
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
                required
                placeholder="e.g., Guest Lecture, Workshop, Conference"
              />
            </div>

            <div className="form-group">
              <label htmlFor="duration">Duration of Stay (in days) *</label>
              <input
                type="number"
                id="duration"
                name="duration"
                min="1"
                value={formData.duration}
                onChange={handleChange}
                required
              />
            </div>
          </>
        ) : (
          <>
            <div className="form-group">
              <label htmlFor="eventName">Event Name *</label>
              <input
                type="text"
                id="eventName"
                name="eventName"
                value={formData.eventName}
                onChange={handleChange}
                required
                placeholder="Enter event name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="numAttendees">Number of Attendees *</label>
              <input
                type="number"
                id="numAttendees"
                name="numAttendees"
                min="1"
                value={formData.numAttendees}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="mike">Number of Mikes</label>
              <input
                type="number"
                id="mike"
                name="mike"
                min="0"
                value={formData.mike}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="projector">Need Projector?</label>
              <select
                id="projector"
                name="projector"
                value={formData.projector}
                onChange={handleChange}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
          </>
        )}

        <button type="submit">Book {roomType}</button>
        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}
      </form>
    </div>
  );
};

export default BookingForm;
