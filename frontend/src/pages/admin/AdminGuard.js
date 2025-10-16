import React from 'react';
import { Navigate } from 'react-router-dom';
import { hasAdminAccess, useProfile } from '../../context/ProfileContext';

function AdminGuard({ children, redirectTo = '/dashboard' }) {
  const { profile, loading, error } = useProfile();

  if (loading) {
    return <div className="py-5 text-center">Loading admin console…</div>;
  }

  if (error) {
    return (
      <div role="alert" className="alert alert-danger">
        {error}
      </div>
    );
  }

  if (!hasAdminAccess(profile)) {
    return <Navigate to={redirectTo} replace />;
  }

  return children;
}

export default AdminGuard;
