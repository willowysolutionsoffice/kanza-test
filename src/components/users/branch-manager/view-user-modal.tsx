'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { User } from '@/types/user';
import { Label } from '@/components/ui/label';

interface ViewUserModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  branches: Array<{ id: string; name: string; address?: string }>;
  roles: Array<{ id: string; name: string; value: string }>;
}

export function ViewUserModal({
  user,
  isOpen,
  onClose,
  branches,
  roles,
}: ViewUserModalProps) {


  if (!user) return null;

  const branch = branches.find((b) => b.id === user.branch);
  const role = roles.find((r) => r.value === user.role);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Full Name
              </Label>
              <div className="text-sm font-medium">{user.name}</div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Email
              </Label>
              <div className="text-sm font-medium">{user.email}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Role
              </Label>
              <div className="text-sm font-medium">
                {role ? role.name : user.role || 'No Role'}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Branch
              </Label>
              <div className="text-sm font-medium">
                {branch ? branch.name : user.branch || 'No Branch'}
              </div>
              {branch?.address && (
                <div className="text-xs text-muted-foreground">
                  {branch.address}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
