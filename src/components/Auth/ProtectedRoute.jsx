import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className='flex min-h-[40vh] items-center justify-center bg-black text-white'>
        <span className='font-medium text-white/70'>Loading…</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to='/sign-in' state={{ from: location }} replace />;
  }

  return children;
}
