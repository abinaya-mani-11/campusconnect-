# Fix Vercel Deployment 404 Issues

## Problem
Frontend has hardcoded `http://localhost:5000` URLs that work in development but fail in production on Vercel.

## Solution
Replace all hardcoded localhost URLs with relative paths that work with Vercel's routing.

## Tasks
- [ ] Update fetchWithAuth.js API_REFRESH_URL to use '/api/auth/refresh-token'
- [ ] Update Login.jsx to use relative paths
- [ ] Update FacultyRegistration.jsx to use relative paths
- [ ] Update Dashboard.jsx to use relative paths
- [ ] Update BookingForm.jsx to use relative paths
- [ ] Update AdminDashboard.jsx to use relative paths
- [ ] Update ProtectedRoute.jsx to use relative paths
- [ ] Test deployment after changes
