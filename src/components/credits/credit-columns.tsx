"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Credit } from "@/types/credits";
import { CreditFormDialog } from "./credit-form";
import { CreditDeleteDialog } from "./credit-delete-dailog";
import { formatCurrency, formatDate } from "@/lib/utils";

export const creditColumns = (userRole?: string, canEdit?: boolean): ColumnDef<Credit>[] => {
  const isAdmin = userRole?.toLowerCase() === "admin";
  const hasEditAccess = isAdmin || !!canEdit;
  
  const columns: ColumnDef<Credit>[] = [
    {
      accessorFn: (row) => row.customer?.name ?? "",
      id: "customerName",
      header: "Customer",
      cell: ({ getValue }) => <div>{getValue<string>()}</div>,
    },
    {
      accessorKey: "fuelType",
      header: "Fuel Type",
    },
    {
      accessorKey: "quantity",
      header: "Quantity",
      cell: ({ row }) => <div className="px-3">{row.getValue("quantity") ?? "..."}</div>,
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => {
        const amount = row.getValue("amount") as number;
        return <span>{formatCurrency(amount)}</span>;
      },
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => {
        const date = row.original.date;
        return <div>{formatDate(date)}</div>;
      },
    },
  ];

  // Only add Actions column for admin users or users with edit access
  if (hasEditAccess) {
    columns.push({
      id: "actions",
      header: "Actions",
      cell: ({ row }) =>
        row.original && <CreditInlineActions credit={row.original} userRole={userRole} canEdit={canEdit} />,
    });
  }

  return columns;
};

export const CreditInlineActions = ({
  credit,
  userRole,
  canEdit,
}: {
  credit: Credit;
  userRole?: string;
  canEdit?: boolean;
}) => {
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  const isAdmin = userRole?.toLowerCase() === "admin";
  if (!isAdmin && !canEdit) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Edit Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpenEdit(true)}
        className="h-8 w-8 text-blue-600 hover:text-blue-800"
      >
        <Edit2 className="h-4 w-4" />
      </Button>

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpenDelete(true)}
        className="h-8 w-8 text-destructive hover:text-red-700"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {/* Edit Dialog */}
      <CreditFormDialog open={openEdit} openChange={setOpenEdit} credits={credit} />

      {/* Delete Dialog */}
      <CreditDeleteDialog
        credits={credit}
        open={openDelete}
        setOpen={setOpenDelete}
      />
    </div>
  );
};
