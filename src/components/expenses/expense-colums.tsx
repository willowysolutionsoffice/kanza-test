"use client";

import { Expense } from "@/types/expense";
import { ExpenseFormDialog } from "./expense-form";
import { ExpenseDeleteDialog } from "./expense-delete-dailog";

import { ColumnDef } from "@tanstack/react-table";
import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";

export const expenseColumns = (userRole?: string, canEdit?: boolean): ColumnDef<Expense>[] => {
  const isAdmin = userRole?.toLowerCase() === "admin";
  const hasEditAccess = isAdmin || !!canEdit;
  
  const columns: ColumnDef<Expense>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => {
        const date = row.getValue("date") as string | Date;
        return <div>{date ? formatDate(date) : "-"}</div>;
      },
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => {
        const expenseCategory = row.original.category?.name || "Unknown";
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium bg-blue-100 text-blue-800">
            {expenseCategory}
          </span>
        );
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const description = row.getValue("description");
        return (
          <div className="px-3">
            {description ? String(description) : "..."}
          </div>
        );
      },
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const amount = row.getValue("amount") as number;
        return <div className="font-medium">{formatCurrency(amount)}</div>;
      },
    },
  ];

  // Only add Actions column for admin users or users with edit access
  if (hasEditAccess) {
    columns.push({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <ExpenseActions expense={row.original} userRole={userRole} canEdit={canEdit} />
      ),
    });
  }

  return columns;
};

const ExpenseActions = ({
  expense,
  userRole,
  canEdit,
}: {
  expense: Expense;
  userRole?: string;
  canEdit?: boolean;
}) => {
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  // Only allow admin users or users with edit access to see action buttons
  const isAdmin = userRole?.toLowerCase() === "admin";
  if (!isAdmin && !canEdit) return null;

  return (
    <>
      <div className="flex justify-start items-center gap-2">
        {/* Edit Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setOpenEdit(true)}
          title="Edit Expense"
          className="h-8 w-8"
        >
          <Edit2 className="h-4 w-4" />
        </Button>

        {/* Delete Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setOpenDelete(true)}
          title="Delete Expense"
          className="h-8 w-8 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Edit Dialog */}
      <ExpenseFormDialog
        open={openEdit}
        openChange={setOpenEdit}
        expense={expense}
      />

      {/* Delete Dialog */}
      <ExpenseDeleteDialog
        expense={expense}
        open={openDelete}
        setOpen={setOpenDelete}
      />
    </>
  );
};
