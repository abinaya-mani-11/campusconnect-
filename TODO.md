# Token Error Resolution Plan

## Information Gathered
- Multiple files handle JWT tokens with inconsistent fallback secrets
- Dashboard.jsx has undefined `userEmail` variable in fallback API call
- Frontend components don't handle token expiry gracefully (no refresh attempts)
- Token storage uses both localStorage and sessionStorage inconsistently

## Plan
1. **Standardize JWT_SECRET across server files**
   - Update all JWT_SECRET fallbacks to use a consistent value
   - Ensure environment variable takes precedence

2. **Fix undefined userEmail in Dashboard.jsx**
   - Replace undefined `userEmail` with `facultyData.email` in fallback fetch

3. **Improve token expiry handling in frontend**
   - Add token refresh logic before redirecting to login on auth failures
   - Update Dashboard.jsx to handle 401 responses by attempting refresh

4. **Ensure consistent token retrieval**
   - Create a utility function for token retrieval across components

## Dependent Files
- server/middleware/auth.js
- server/utils/auth.js
- server/index-enhanced.js
- src/components/Dashboard.jsx
- src/components/ProtectedRoute.jsx (already has some refresh logic)

## Followup Steps
- Test authentication flow after changes
- Verify token refresh works on expiry
- Check that all API calls handle 401 responses properly
