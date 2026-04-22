"use client";

import { useState, useEffect, useMemo } from "react";

interface UseNextAllowedDateProps {
  userRole?: string;
  branchId?: string;
  isEditMode?: boolean;
}

export function useNextAllowedDate({ 
  userRole, 
  branchId, 
  isEditMode = false 
}: UseNextAllowedDateProps) {
  const [lastSaleDate, setLastSaleDate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(prev => prev + 1);

  const isBranchManager = userRole?.toLowerCase() === "branch";
  const shouldRestrict = isBranchManager && !isEditMode && branchId;

  useEffect(() => {
    if (!shouldRestrict) {
      setLastSaleDate(null);
      return;
    }

    const fetchLastSaleDate = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/sales/last-date?branchId=${branchId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.lastDate) {
            setLastSaleDate(new Date(data.lastDate));
          } else {
            // If no sales exist, set to yesterday so next date is today
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            setLastSaleDate(yesterday);
          }
        }
      } catch (error) {
        console.error("Error fetching last sale date:", error);
        // On error, set to yesterday so next date is today
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        setLastSaleDate(yesterday);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLastSaleDate();
  }, [shouldRestrict, branchId, refreshKey]);

  const nextAllowedDate = useMemo(() => {
    if (!shouldRestrict || !lastSaleDate) {
      return null;
    }

    // Calculate next date (last date + 1 day)
    const nextDate = new Date(lastSaleDate);
    nextDate.setDate(nextDate.getDate() + 1);
    // Set to start of day
    nextDate.setHours(0, 0, 0, 0);
    return nextDate;
  }, [shouldRestrict, lastSaleDate]);

  return {
    nextAllowedDate,
    isDateRestricted: shouldRestrict,
    isLoading,
    refresh,
  };
}

