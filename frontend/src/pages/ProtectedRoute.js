// frontend/src/components/ProtectedRoute.js

import React from 'react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }) {
  // Check for the access token in localStorage
  const token = localStorage.getItem('accessToken');

  // If token exists, allow access to the component's children (the actual page)
  if (token) {
    return children;
  } else {
    // If no token, redirect to the login page
    return <Navigate to="/login" />;
  }
}

export default ProtectedRoute;