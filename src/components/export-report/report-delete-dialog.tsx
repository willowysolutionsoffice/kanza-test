"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { FC, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";

export const ReportDeleteDialog: FC<{
  date: Date | string;
  branchId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  onSuccess?: () => void;
}> = ({ date, branchId, open, setOpen, onSuccess }) => {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
      setIsDeleting(true);
      try {
          // Convert date to YYYY-MM-DD format for API using IST timezone
          let dateString: string;
          if (date instanceof Date) {
            dateString = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          } else {
            const dateObj = new Date(date);
            dateString = dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          }

          const response = await fetch(`/api/reports/${dateString}?branchId=${branchId}`, {
              method: "DELETE"
          });
          
          if (response.ok) {
            toast.success(`Report for ${formatDate(date)} and all related records deleted.`)
            setOpen(false)
            if (onSuccess) {
              onSuccess();
            }
            router.refresh()
          } else {
            const data = await response.json();
            toast.error(data.error || "Failed to delete report.")
          }
      } catch (error) {
          toast.error("Failed to delete report.")
          console.error(error, "Error on deleting report");
      } finally {
          setIsDeleting(false);
      }
    }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the report for{" "}
            <span className="font-bold">{formatDate(date)}</span> and <span className="font-bold text-destructive">ALL records</span> (Sales, Meter Readings, Expenses, Credits, etc.) associated with this date and branch.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button 
                variant="destructive" 
                onClick={(e) => {
                    e.preventDefault();
                    handleDelete();
                }} 
                disabled={isDeleting}
            >
                {isDeleting ? "Deleting..." : "Delete All Records"}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
