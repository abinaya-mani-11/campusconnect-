// Authentication functions
function requireLogin() {
  const user = getUser();
  if (!user || !user.email || user.role !== 'Faculty') {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function getUser() {
  const userData = localStorage.getItem('necUser');
  if (userData) {
    try {
      return JSON.parse(userData);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function logout() {
  localStorage.removeItem('necUser');
  localStorage.removeItem('necBookings');
  window.location.href = 'login.html';
}

// Dashboard functions
function renderUserInfo() {
  const user = getUser();
  if (!user) return;

  const userInfoContainer = document.getElementById('userInfo');
  if (!userInfoContainer) return;

  userInfoContainer.innerHTML = `
    <div class="user-info-item">
      <span class="user-info-label">Name:</span>
      <span class="user-info-value">${user.name}</span>
    </div>
    <div class="user-info-item">
      <span class="user-info-label">Email:</span>
      <span class="user-info-value">${user.email}</span>
    </div>
    <div class="user-info-item">
      <span class="user-info-label">Role:</span>
      <span class="user-info-value">${user.role}</span>
    </div>
    <div class="user-info-item">
      <span class="user-info-label">Department:</span>
      <span class="user-info-value">${user.department}</span>
    </div>
  `;
}

// Halls functions
function renderHalls() {
  const halls = [
    { name: 'Auditorium', image: 'assets/auditorium.png', description: 'Large capacity venue for major events' },
    { name: 'Assembly hall', image: 'assets/assembly.png', description: 'Traditional assembly and meeting space' },
    { name: 'Tech park', image: 'assets/techpark.png', description: 'Modern technology-enabled venue' },
    { name: 'Alumini chamber', image: 'assets/alumini.png', description: 'Exclusive space for alumni events' },
    { name: 'Library-Av hall', image: 'assets/libraryav.png', description: 'Audio-visual equipped learning space' }
  ];

  const hallsGrid = document.getElementById('hallsGrid');
  if (!hallsGrid) return;

  hallsGrid.innerHTML = halls.map(hall => `
    <a href="hall-details.html?hall=${encodeURIComponent(hall.name)}" class="hall-card">
      <div class="hall-image">
        ${hall.name[0]}
      </div>
      <div class="hall-info">
        <h3 class="hall-name">${hall.name}</h3>
        <p class="hall-description">${hall.description}</p>
      </div>
    </a>
  `).join('');
}

// Hall details and booking functions
function getHallFacilities(hallName) {
  const facilities = {
    'Auditorium': ['Speakers', 'Chair arrangement', 'Projector', 'Yoga mat'],
    'Assembly hall': ['Speaker', 'Projector'],
    'Tech park': ['Speakers', 'Chair arrangement', 'Projector'],
    'Alumini chamber': ['Speakers', 'Projector'],
    'Library-Av hall': ['Projector', 'Speakers']
  };
  return facilities[hallName] || [];
}

function renderHallForm(hallName) {
  const hallContent = document.getElementById('hallContent');
  if (!hallContent) return;

  const facilities = getHallFacilities(hallName);
  const events = ['NSS', 'NCC', 'Reader park', 'Fine arts', 'Yoga', 'Special programs'];

  const today = new Date().toISOString().split('T')[0];

  hallContent.innerHTML = `
    <div class="hall-details-header">
      <h1>${hallName}</h1>
      <p>Fill out the form below to book this hall</p>
    </div>

    <form id="bookingForm" class="booking-form">
      <div class="form-section">
        <h3>Required Facilities</h3>
        <div class="checkbox-grid">
          ${facilities.map(facility => `
            <div class="checkbox-item">
              <input type="checkbox" id="facility-${facility}" name="facilities" value="${facility}">
              <label for="facility-${facility}">${facility}</label>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="form-section">
        <h3>Event/Purpose</h3>
        <div class="checkbox-grid">
          ${events.map(event => `
            <div class="checkbox-item">
              <input type="checkbox" id="event-${event}" name="events" value="${event}">
              <label for="event-${event}">${event}</label>
            </div>
          `).join('')}
        </div>
        <div class="form-group mt-16">
          <label for="customPurpose">Other (enter event name/purpose)</label>
          <input type="text" id="customPurpose" name="customPurpose" placeholder="e.g., Conduct cls">
        </div>
      </div>

      <div class="form-section">
        <h3>Booking Details</h3>
        <div class="form-group">
          <label for="date">Date*</label>
          <input type="date" id="date" name="date" min="${today}" required>
          <div id="dateError" class="error-message"></div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="startTime">Start Time*</label>
            <input type="time" id="startTime" name="startTime" required>
            <div id="startTimeError" class="error-message"></div>
          </div>
          <div class="form-group">
            <label for="endTime">End Time*</label>
            <input type="time" id="endTime" name="endTime" required>
            <div id="endTimeError" class="error-message"></div>
          </div>
        </div>

        <div class="form-group">
          <label for="attendees">Expected Number of Attendees*</label>
          <input type="number" id="attendees" name="attendees" min="1" required>
          <div id="attendeesError" class="error-message"></div>
        </div>

        <div class="form-group">
          <label for="notes">Additional Notes</label>
          <textarea id="notes" name="notes" rows="3" placeholder="Any special requirements or notes..."></textarea>
        </div>
      </div>

      <div class="form-actions">
        <a href="halls.html" class="btn-secondary">Back to Halls</a>
        <button type="submit" class="btn-primary">Book Hall</button>
      </div>
    </form>
  `;

  // Add form submission handler
  document.getElementById('bookingForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const booking = {
      hallName: hallName,
      user: getUser(),
      facilities: formData.getAll('facilities'),
      events: formData.getAll('events'),
      customPurpose: formData.get('customPurpose'),
      date: formData.get('date'),
      startTime: formData.get('startTime'),
      endTime: formData.get('endTime'),
      attendees: formData.get('attendees'),
      notes: formData.get('notes'),
      bookingId: Date.now().toString(),
      createdAt: new Date().toISOString()
    };

    if (validateBooking(booking)) {
      saveBooking(booking);
      showConfirmation(booking);
    }
  });
}

function validateBooking(booking) {
  // Clear previous errors
  document.querySelectorAll('.error-message').forEach(el => el.textContent = '');

  let hasError = false;

  // Validate date
  const bookingDate = new Date(booking.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (bookingDate < today) {
    document.getElementById('dateError').textContent = 'Date cannot be in the past.';
    hasError = true;
  }

  // Validate times
  if (booking.startTime && booking.endTime) {
    const startTime = new Date(`1970-01-01T${booking.startTime}`);
    const endTime = new Date(`1970-01-01T${booking.endTime}`);
    
    if (startTime >= endTime) {
      document.getElementById('endTimeError').textContent = 'End time must be after start time.';
      hasError = true;
    }
  }

  // Validate attendees
  if (!booking.attendees || booking.attendees < 1) {
    document.getElementById('attendeesError').textContent = 'Please enter expected number of attendees.';
    hasError = true;
  }

  // Validate at least one facility or event
  if (booking.facilities.length === 0 && booking.events.length === 0 && !booking.customPurpose) {
    document.getElementById('dateError').textContent = 'Please select at least one facility, event, or specify a custom purpose.';
    hasError = true;
  }

  return !hasError;
}

function saveBooking(booking) {
  const existingBookings = localStorage.getItem('necBookings');
  const bookings = existingBookings ? JSON.parse(existingBookings) : [];
  
  bookings.push(booking);
  localStorage.setItem('necBookings', JSON.stringify(bookings));
}

function showConfirmation(booking) {
  const modal = document.getElementById('confirmationModal');
  const details = document.getElementById('confirmationDetails');
  
  const facilitiesText = booking.facilities.length > 0 ? booking.facilities.join(', ') : 'None';
  const eventsText = booking.events.length > 0 ? booking.events.join(', ') : 'None';
  const purposeText = booking.customPurpose || 'None specified';

  details.innerHTML = `
    <div class="confirmation-item">
      <span class="confirmation-label">Hall:</span>
      <span class="confirmation-value">${booking.hallName}</span>
    </div>
    <div class="confirmation-item">
      <span class="confirmation-label">Date:</span>
      <span class="confirmation-value">${new Date(booking.date).toLocaleDateString()}</span>
    </div>
    <div class="confirmation-item">
      <span class="confirmation-label">Time:</span>
      <span class="confirmation-value">${booking.startTime} - ${booking.endTime}</span>
    </div>
    <div class="confirmation-item">
      <span class="confirmation-label">Attendees:</span>
      <span class="confirmation-value">${booking.attendees}</span>
    </div>
    <div class="confirmation-item">
      <span class="confirmation-label">Facilities:</span>
      <span class="confirmation-value">${facilitiesText}</span>
    </div>
    <div class="confirmation-item">
      <span class="confirmation-label">Events:</span>
      <span class="confirmation-value">${eventsText}</span>
    </div>
    <div class="confirmation-item">
      <span class="confirmation-label">Custom Purpose:</span>
      <span class="confirmation-value">${purposeText}</span>
    </div>
    ${booking.notes ? `
    <div class="confirmation-item">
      <span class="confirmation-label">Notes:</span>
      <span class="confirmation-value">${booking.notes}</span>
    </div>
    ` : ''}
    <div class="confirmation-item">
      <span class="confirmation-label">Booked by:</span>
      <span class="confirmation-value">${booking.user.name} (${booking.user.department})</span>
    </div>
  `;

  modal.style.display = 'flex';
}

function renderBookings() {
  const bookingsList = document.getElementById('bookingsList');
  if (!bookingsList) return;

  const user = getUser();
  const existingBookings = localStorage.getItem('necBookings');
  const allBookings = existingBookings ? JSON.parse(existingBookings) : [];
  
  // Filter bookings for current user
  const userBookings = allBookings.filter(booking => 
    booking.user && booking.user.email === user.email
  );

  if (userBookings.length === 0) {
    bookingsList.innerHTML = `
      <div class="no-bookings">
        <p>You haven't made any bookings yet.</p>
        <a href="halls.html" class="btn-primary mt-16">Book Your First Hall</a>
      </div>
    `;
    return;
  }

  // Sort bookings by date (newest first)
  userBookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  bookingsList.innerHTML = userBookings.map(booking => {
    const facilitiesText = booking.facilities && booking.facilities.length > 0 
      ? booking.facilities.join(', ') 
      : 'None';
    
    const eventsText = booking.events && booking.events.length > 0 
      ? booking.events.join(', ') 
      : 'None';

    const purposeText = booking.customPurpose || 'Standard booking';
    
    return `
      <div class="booking-item">
        <div class="booking-header">
          <div class="booking-hall">${booking.hallName}</div>
          <div class="booking-date">${new Date(booking.date).toLocaleDateString()}</div>
        </div>
        <div class="booking-details">
          <strong>Time:</strong> ${booking.startTime} - ${booking.endTime}<br>
          <strong>Attendees:</strong> ${booking.attendees}<br>
          <strong>Facilities:</strong> ${facilitiesText}<br>
          <strong>Events:</strong> ${eventsText}<br>
          <strong>Purpose:</strong> ${purposeText}
          ${booking.notes ? `<br><strong>Notes:</strong> ${booking.notes}` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Utility functions
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function formatTime(timeString) {
  const time = new Date(`1970-01-01T${timeString}`);
  return time.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

// Initialize page-specific functionality
document.addEventListener('DOMContentLoaded', function() {
  // Set active nav link based on current page
  const currentPage = window.location.pathname.split('/').pop();
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(link => {
    link.classList.remove('active');
    const href = link.getAttribute('href');
    if (href && href.includes(currentPage)) {
      link.classList.add('active');
    }
  });

  // Close modal when clicking outside
  const modal = document.getElementById('confirmationModal');
  if (modal) {
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }

  // Handle hash navigation for bookings
  if (window.location.hash === '#bookings') {
    setTimeout(() => {
      const bookingsSection = document.getElementById('bookings');
      if (bookingsSection) {
        bookingsSection.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  }
});