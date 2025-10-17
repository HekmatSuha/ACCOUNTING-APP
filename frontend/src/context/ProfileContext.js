import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import axiosInstance from '../utils/axiosInstance';

const ProfileContext = createContext({
  profile: null,
  loading: true,
  error: null,
  refreshProfile: () => Promise.resolve(),
});

export function hasAdminAccess(profile) {
  if (!profile) {
    return false;
  }

  return Boolean(profile.is_staff || profile.is_superuser);
}

function persistProfile(profile) {
  if (profile) {
    localStorage.setItem('userProfile', JSON.stringify(profile));
    localStorage.setItem('isAdmin', hasAdminAccess(profile) ? 'true' : 'false');
  } else {
    localStorage.removeItem('userProfile');
    localStorage.removeItem('isAdmin');
  }
}

export function ProfileProvider({ children, initialProfile = null }) {
  const storedProfile = useMemo(() => {
    if (initialProfile) {
      return initialProfile;
    }
    try {
      const cached = localStorage.getItem('userProfile');
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('Unable to parse cached profile', error);
      return null;
    }
  }, [initialProfile]);

  const [profile, setProfile] = useState(() => {
    if (!storedProfile) {
      return null;
    }
    const normalized = {
      ...storedProfile,
      isAdmin: hasAdminAccess(storedProfile),
    };
    persistProfile(normalized);
    return normalized;
  });
  const [loading, setLoading] = useState(!storedProfile);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axiosInstance.get('/user/profile/');
      const nextProfile = {
        ...response.data,
        isAdmin: hasAdminAccess(response.data),
      };
      setProfile(nextProfile);
      persistProfile(nextProfile);
      return nextProfile;
    } catch (requestError) {
      console.error('Failed to fetch profile', requestError);
      setError('Unable to load profile information.');
      setProfile(null);
      persistProfile(null);
      throw requestError;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!storedProfile && !initialProfile) {
      loadProfile().catch(() => {});
    }
  }, [initialProfile, loadProfile, storedProfile]);

  const value = useMemo(
    () => ({
      profile,
      loading,
      error,
      refreshProfile: loadProfile,
    }),
    [profile, loading, error, loadProfile],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  return useContext(ProfileContext);
}

export default ProfileContext;
