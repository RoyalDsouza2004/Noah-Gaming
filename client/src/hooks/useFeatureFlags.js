import { useState, useEffect, useCallback } from 'react';
import {
  FEATURE_FLAGS,
  fetchFeatureFlags,
  subscribeFeatureFlags,
} from '../utils/featureFlags.js';

export function useFeatureFlags() {
  const [flags, setFlags] = useState({ ...FEATURE_FLAGS });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchFeatureFlags();
    setFlags({ ...FEATURE_FLAGS });
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const unsubscribe = subscribeFeatureFlags((updated) => {
      setFlags(updated);
    });
    return unsubscribe;
  }, [refresh]);

  return {
    enableOnlinePayments: flags.ENABLE_ONLINE_PAYMENTS,
    enableMembershipPurchases: flags.ENABLE_MEMBERSHIP_PURCHASES,
    loading,
    refreshFeatures: refresh,
  };
}
