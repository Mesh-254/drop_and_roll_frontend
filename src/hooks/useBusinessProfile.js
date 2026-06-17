/**
 * useBusinessProfile — Custom hook for business profile management
 *
 * The Django BusinessProfile model does NOT have a `status` string field.
 * Approval state is encoded as:
 *   is_approved  (boolean)  — true once admin approves
 *   approved_at  (datetime) — set when approved
 *
 * We derive three convenience booleans from those fields:
 *   isApproved  — is_approved === true
 *   isPending   — profile exists but is_approved === false
 *   isRejected  — reserved for future use; false for now
 *
 * Provides:
 *   businessProfile  Current profile object or null
 *   loading          Whether profile is being fetched
 *   error            Any error string or null
 *   refetch          Function to refresh the profile
 *   hasProfile       Boolean — profile exists
 *   isApproved       Boolean — admin has approved
 *   isPending        Boolean — exists but not yet approved
 *   isRejected       Boolean — always false (reserved)
 */

import { useState, useEffect, useCallback } from 'react';
import BusinessApi from '../api/BusinessApi';

export function useBusinessProfile() {
  const [businessProfile, setBusinessProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // getProfile() returns null on 404 (no profile yet) — never throws on 404
      const profile = await BusinessApi.getProfile();
      setBusinessProfile(profile);
    } catch (err) {
      console.error('[useBusinessProfile] Failed to fetch profile:', err);
      setError(err.message || 'Failed to fetch business profile');
      setBusinessProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const refetch = useCallback(() => fetchProfile(), [fetchProfile]);

  // ── Derived booleans based on the actual Django model fields ──────────────
  // The model has:  is_approved (bool),  approved_at (datetime | null)
  // There is NO "status" string field — deriving from is_approved is correct.
  const hasProfile = !!businessProfile;
  const isApproved = hasProfile && businessProfile.is_approved === true;
  const isPending  = hasProfile && businessProfile.is_approved === false;
  const isRejected = false; // not implemented in backend yet
  const packageTier = hasProfile ? (businessProfile.package_tier ?? 'none') : 'none';
  const hasNetTerms = hasProfile && businessProfile.payment_terms !== 'prepaid';

  return {
    businessProfile,
    loading,
    error,
    refetch,
    hasProfile,
    isApproved,
    isPending,
    isRejected,
    packageTier,
    hasNetTerms,
  };
}

export default useBusinessProfile;
  