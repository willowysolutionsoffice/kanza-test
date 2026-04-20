"use client";

import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface BranchSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  userRole?: string;
  userBranchId?: string;
  className?: string;
  isEditMode?: boolean;
}

export function BranchSelector({ 
  value, 
  onValueChange, 
  userRole, 
  userBranchId, 
  className,
  isEditMode = false
}: BranchSelectorProps) {
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = (userRole?.toLowerCase() === 'admin') || (userRole?.toLowerCase() === 'gm');
  
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch('/api/branch');
        if (response.ok) {
          const data = await response.json();
          setBranches(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching branches:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBranches();
  }, []);

  // For non-admin users, automatically set their branch
  useEffect(() => {
    if (!isAdmin && userBranchId && !value) {
      onValueChange(userBranchId);
    }
  }, [isAdmin, userBranchId, value, onValueChange]);

  if (!isAdmin && !isEditMode) {
    // For non-admin users in create mode, show a disabled field with their branch name
    const userBranch = branches.find(branch => branch.id === userBranchId);
    return (
      <div className={className}>
        <Label htmlFor="branch-selector">Branch</Label>
        <Select value={userBranchId} disabled>
          <SelectTrigger className="bg-muted cursor-not-allowed">
            <SelectValue placeholder={loading ? "Loading..." : userBranch?.name || "Select branch"} />
          </SelectTrigger>
        </Select>
        {userBranch && (
          <p className="text-sm text-muted-foreground mt-1">
            {userBranch.name} (Your assigned branch)
          </p>
        )}
      </div>
    );
  }

  // Find the selected branch name
  const selectedBranch = branches.find(branch => branch.id === value);

  return (
    <div className={className}>
      <Label htmlFor="branch-selector">Branch *</Label>
      <Select value={value} onValueChange={onValueChange} required>
        <SelectTrigger>
          <SelectValue placeholder={loading ? "Loading branches..." : selectedBranch?.name || "Select a branch"} />
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
