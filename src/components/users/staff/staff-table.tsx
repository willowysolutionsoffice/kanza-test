// src/components/users-table.tsx
'use client';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { IconSearch, IconDotsVertical, IconTrash, IconPencil } from '@tabler/icons-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import type { UsersTableProps } from '@/types/user';
import { authClient } from '@/lib/auth-client';
import { User } from '@/types/user';
import { StaffForm } from './staff-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function StaffTable({ users, roles, branches }: UsersTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;

    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.role && user.role.toLowerCase().includes(query)));
  }, [users,searchQuery]);

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      await authClient.admin.removeUser({
        userId: userToDelete.id,
      });

      toast.success(`User ${userToDelete.name} deleted successfully`);
      setShowDeleteDialog(false);
      setUserToDelete(null);
      router.refresh();
    } catch (error) {
      console.error('Delete user error:', error);
      toast.error('Failed to delete user. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false);
    setUserToDelete(null);
  };

  const handleEditClick = (user: User) => {
  setEditingUser(user);
  setShowEditDialog(true);
  };


    const handleRoleUpdate = async (userId: string, newRole: string, currentRole: string) => {
    if (newRole === currentRole) return;

    setUpdatingRoleUserId(userId);
    try {
      await authClient.admin.setRole({
        userId,
        role: newRole as 'admin' | 'user',
      });

      toast.success(`User role updated to ${newRole.toUpperCase()}`);
      router.refresh();
    } catch (error) {
      console.error('Update role error:', error);
      toast.error('Failed to update user role. Please try again.');
    } finally {
      setUpdatingRoleUserId(null);
    }
  };

  const RoleSelect = ({ user }: { user: User }) => {
    const isUpdating = updatingRoleUserId === user.id;
    const currentRole = user.role || '';

    const getRoleDisplayText = (roleValue: string | null) => {
      if (!roleValue) return 'No Role';
      const role = roles.find((r) => r.value === roleValue);
      return role ? role.name : 'Unknown Role';
    }

    const getRoleColor = (roleValue: string | null) => {
      if (!roleValue) return 'text-muted-foreground';
      switch (roleValue.toLowerCase()) {
        case 'branch':
          return 'text-blue-600 dark:text-blue-400';
        case 'staff':
          return 'text-green-600 dark:text-green-400';
        default:
          return 'text-gray-600 dark:text-gray-400';
      }
    };

    return (
      <div className="flex items-center gap-2">
        <Select
          value={currentRole}
          onValueChange={(newRole) => handleRoleUpdate(user.id, newRole, currentRole)}
          disabled={isUpdating}
        >
          <SelectTrigger className="w-36 h-8 border-none shadow-none p-2 hover:bg-muted/50 focus:ring-1 focus:ring-ring">
            <SelectValue>
              <span className={`text-sm font-medium  ${getRoleColor(currentRole)}`}>
                {getRoleDisplayText(currentRole)}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.value} className="cursor-pointer">
                <div className="flex flex-col">
                  <span className={`font-medium text-sm ${getRoleColor(role.value)}`}>
                    {getRoleDisplayText(role.value)}
                  </span>
                  {role.description && (
                    <span className="text-xs text-muted-foreground">{role.description}</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isUpdating && (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        )}
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>System Staffs</CardTitle>
          <CardDescription>
            Manage stafs accounts and permissions. Total staffs: {users.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <IconSearch className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search staffs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4">
                        No users found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <RoleSelect user={user} />
                        </TableCell>
                        <TableCell>{formatDate(user.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <IconDotsVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditClick(user)}>
                                <IconPencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteClick(user)}
                              >
                                <IconTrash className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {editingUser && (
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>

            <StaffForm
              initialData={editingUser}
              roles={roles}
              branches={branches}
              isEdit={true}
              onSuccess={() => {
                setShowEditDialog(false);
                setEditingUser(null);
                router.refresh();
              }}
            />
          </DialogContent>
        </Dialog>
      )}


      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user{' '}
              <span className="font-semibold">{userToDelete?.name}</span> and remove their data from
              our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Deleting...
                </>
              ) : (
                'Delete User'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
