import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adminNotes, setAdminNotes] = useState({});
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    fetchBookings();
  }, []);

  // Poll for updates every 10 seconds so admin sees cancellations/bookings made by others
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBookings();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Listen for storage events so other tabs/windows can trigger immediate refresh
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'bookingsUpdatedAt') {
        fetchBookings();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Real-time updates via Server-Sent Events (SSE)
  useEffect(() => {
    let es;
    try {
      es = new EventSource('/events/bookings');
      es.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          if (payload && payload.type === 'bookings-updated') {
            fetchBookings();
          }
        } catch (e) {
          // ignore parse errors
          fetchBookings();
        }
      };
      es.onerror = (err) => {
        // if SSE fails, we'll keep polling as fallback
        console.warn('SSE error (bookings):', err);
        if (es) { es.close(); }
      };
    } catch (e) {
      console.warn('Failed to open EventSource for bookings:', e);
    }
    return () => { if (es) es.close(); };
  }, []);

  const navigate = useNavigate();

  const handleLogout = () => {
    // clear tokens and auth flags
    try {
  // remove both keys when logging out/clearing
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('jwtToken');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('jwtToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('tokenExpiry');
      localStorage.removeItem('isAdmin');
      localStorage.removeItem('isAuthenticated');
      sessionStorage.removeItem('currentFacultyData');
    } catch (e) {
      // ignore
    }
    navigate('/login', { replace: true });
  };

  const fetchBookings = async () => {
    try {
  // prefer accessToken, fall back to legacy jwtToken in session/local
  const token = localStorage.getItem('accessToken') || sessionStorage.getItem('jwtToken') || localStorage.getItem('jwtToken');
      // Try admin-specific route first (some server variants use /api/bookings/admin/all)
      let res = await fetch('/api/bookings/admin/all', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        // fallback to generic all route used by enhanced server
        res = await fetch('/api/bookings/all', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      }

      if (!res.ok) {
        throw new Error('Failed to fetch bookings from server');
      }

      const json = await res.json();
      // Support both { bookings: [] } and direct array responses
      setBookings(Array.isArray(json) ? json : (json.bookings || []));
    } catch (err) {
      // fallback to localStorage (dev mode)
      console.warn('Falling back to localStorage bookings:', err.message);
      try {
        const raw = localStorage.getItem('bookings');
        const list = raw ? JSON.parse(raw) : [];
        setBookings(list.map(b => ({ ...b, _id: b.id })));
        setError(null);
      } catch (e) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBookingStatus = async (bookingId, status, notes = '') => {
    try {
  const token = localStorage.getItem('accessToken') || sessionStorage.getItem('jwtToken') || localStorage.getItem('jwtToken');
      // Try admin-specific update route first, fallback to generic status update route
      let res = await fetch(`/api/bookings/admin/${bookingId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ status, admin_notes: notes })
      });

      if (!res.ok) {
        res = await fetch(`/api/bookings/${bookingId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ status, admin_notes: notes })
        });
      }

      if (!res.ok) {
        throw new Error('Failed to update status on server');
      }

      const json = await res.json();

      // If server returned updated booking, replace in UI
      if (json.booking) {
        setBookings(prev => prev.map(b => (String(b._id) === String(json.booking._id) ? json.booking : b)));
        return;
      }

      // otherwise refresh list
      fetchBookings();
    } catch (err) {
      // fallback: update localStorage
      console.warn('Server status update failed, falling back to localStorage:', err.message);
      try {
        const raw = localStorage.getItem('bookings');
        const list = raw ? JSON.parse(raw) : [];
        const idx = list.findIndex(x => String(x.id || x._id) === String(bookingId));
        if (idx !== -1) {
          list[idx].status = status;
          list[idx].admin_notes = notes;
          list[idx].updatedAt = new Date().toISOString();
          localStorage.setItem('bookings', JSON.stringify(list));
          setBookings(list.map(b => ({ ...b, _id: b.id })));
          return;
        }
      } catch (e) {
        console.error('Fallback local update failed', e);
      }

      alert('Error updating status: ' + err.message);
    }
  };

  const pendingBookings = bookings.filter(b => (b.status || 'pending') === 'pending');
  const approvedBookings = bookings.filter(b => (b.status || '').toLowerCase() === 'approved');
  const rejectedBookings = bookings.filter(b => (b.status || '').toLowerCase() === 'rejected');

  const filteredBookings = (() => {
    switch (activeTab) {
      case 'all':
        return bookings;
      case 'approved':
        return approvedBookings;
      case 'rejected':
        return rejectedBookings;
      case 'pending':
      default:
        return pendingBookings;
    }
  })();

  // Monthly statistics computed client-side
  const months = (() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return list;
  })();

  const statsByHallForSelectedMonth = (() => {
    // group bookings by hall_name (or roomType) and count statuses for bookings in the selected month
    const map = {};
    bookings.forEach(b => {
      const dateStr = b.date || b.checkInDate || b.createdAt || b.bookingDate;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (key !== selectedMonth) return;
      const hall = b.hall_name || b.roomType || 'Unknown Hall';
      if (!map[hall]) map[hall] = { total: 0, approved: 0, rejected: 0, pending: 0 };
      map[hall].total += 1;
      const st = (b.status || 'pending').toLowerCase();
      if (st === 'approved') map[hall].approved += 1;
      else if (st === 'rejected') map[hall].rejected += 1;
      else map[hall].pending += 1;
    });
    return map;
  })();

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-600">Manage hall bookings and view statistics</p>
        </div>
        <div className="flex items-center space-x-3">
            <span className="px-3 py-1 text-sm bg-green-50 text-green-700 rounded-full">Administrator</span>
            <button onClick={handleLogout} className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm">Logout</button>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total Halls</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">6</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Pending Bookings</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{pendingBookings.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Approved</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{approvedBookings.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Rejected</div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{rejectedBookings.length}</div>
        </div>
      </div>

      {/* Monthly statistics */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Monthly Hall Statistics</h3>
          <div className="flex items-center space-x-2">
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-3 py-1 border rounded">
              {months.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {Object.keys(statsByHallForSelectedMonth).length === 0 ? (
          <div className="text-gray-500">No bookings for the selected month.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-600">
                  <th className="px-3 py-2">Hall</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Approved</th>
                  <th className="px-3 py-2">Rejected</th>
                  <th className="px-3 py-2">Pending</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(statsByHallForSelectedMonth).map(([hall, counts]) => (
                  <tr key={hall} className="border-t">
                    <td className="px-3 py-2">{hall}</td>
                    <td className="px-3 py-2 font-medium">{counts.total}</td>
                    <td className="px-3 py-2 text-green-600">{counts.approved}</td>
                    <td className="px-3 py-2 text-red-600">{counts.rejected}</td>
                    <td className="px-3 py-2 text-yellow-600">{counts.pending}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">{activeTab === 'all' ? 'All Bookings' : `${activeTab[0].toUpperCase() + activeTab.slice(1)} Bookings`}</h3>
          <div className="space-x-2">
            <button onClick={() => setActiveTab('all')} className={`px-3 py-1 rounded ${activeTab === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}>All</button>
            <button onClick={() => setActiveTab('pending')} className={`px-3 py-1 rounded ${activeTab === 'pending' ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-800'}`}>Pending</button>
            <button onClick={() => setActiveTab('approved')} className={`px-3 py-1 rounded ${activeTab === 'approved' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'}`}>Approved</button>
            <button onClick={() => setActiveTab('rejected')} className={`px-3 py-1 rounded ${activeTab === 'rejected' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-800'}`}>Rejected</button>
          </div>
        </div>

        {filteredBookings.length === 0 ? (
          <div className="text-gray-500">No bookings to show</div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <div key={booking._id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900">{booking.hall_name || booking.roomType}</h4>
                    <p className="text-sm text-gray-600">{booking.user_name || booking.facultyEmail}</p>
                    <p className="text-sm text-gray-600">{booking.eventName || booking.event_type || ''}</p>
                  </div>
                  <div>
                    <span className={`inline-block px-2 py-1 text-xs rounded ${booking.status === 'approved' ? 'bg-green-100 text-green-800' : booking.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{(booking.status || 'pending').toUpperCase()}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm text-gray-600">
                  <div>
                    <div className="text-xs text-gray-500">Date</div>
                    <div className="font-medium">{booking.date || booking.checkInDate || ''}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Time</div>
                    <div className="font-medium">{booking.startTime ? `${booking.startTime} - ${booking.endTime}` : ''}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Participants</div>
                    <div className="font-medium">{booking.numAttendees || booking.numGuests || ''}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Facilities</div>
                    <div className="font-medium">{(booking.facilities_requested && booking.facilities_requested.length) || booking.mike || 0}</div>
                  </div>
                </div>

                {booking.status === 'pending' && (
                  <div className="flex justify-end space-x-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="Admin notes (optional)"
                        value={adminNotes[booking._id] || ''}
                        onChange={(e) => setAdminNotes(prev => ({ ...prev, [booking._id]: e.target.value }))}
                        className="px-2 py-1 border rounded"
                        style={{ minWidth: 280 }}
                      />
                      <button
                        className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                        onClick={() => handleUpdateBookingStatus(booking._id, 'approved', adminNotes[booking._id] || '')}
                      >
                        Approve
                      </button>
                      <button
                        className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        onClick={() => handleUpdateBookingStatus(booking._id, 'rejected', adminNotes[booking._id] || 'Rejected by admin')}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
                {/* show admin notes & decision if present */}
                {booking.admin_notes && (
                  <div className="mt-3 text-sm text-gray-700">
                    <strong>Admin notes:</strong> {booking.admin_notes}
                  </div>
                )}
                {booking.decision && (
                  <div className="mt-2 text-xs text-gray-500">
                    Decision by: {booking.decision.by || booking.updatedBy} at {booking.decision.at ? new Date(booking.decision.at).toLocaleString() : (booking.updatedAt ? new Date(booking.updatedAt).toLocaleString() : '')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
