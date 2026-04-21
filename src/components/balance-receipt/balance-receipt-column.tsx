"use client";
import { ColumnDef } from "@tanstack/react-table";
import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { format, isSameDay } from "date-fns";
import { BalanceReceipt } from "@/types/balance-receipt";
import { BalanceReceiptFormDialog } from "./balance-receipt-form";
import { BalanceReceiptDeleteDialog } from "./balance-receipt-delete-dialog";
import { formatCurrency } from "@/lib/utils";

export const balanceReceiptColumn = (userRole?: string, canEdit?: boolean): ColumnDef<BalanceReceipt>[] => {
  const isAdmin = userRole?.toLowerCase() === "admin";
  const isGm = userRole?.toLowerCase() === "gm";
  const hasEditAccess = (isAdmin || !!canEdit) && !isGm;

  const columns: ColumnDef<BalanceReceipt>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => {
        const d = new Date(row.getValue("date"));
        return <span>{format(d, "PP")}</span>;
      },
      filterFn: (row, id, value) => {
        if (!value) return true;
        const rowDate = new Date(row.getValue(id) as string | Date);
        const filterDate = new Date(value as string | Date);
        return isSameDay(rowDate, filterDate);
      },
      enableColumnFilter: true,
    },
    {
      accessorKey: "branch",
      header: "Branch",
      cell: ({ row }) => {
        const branch = row.original.branch;
        return <div>{branch?.name || "Unknown"}</div>;
      },
    },
    {
      accessorKey: "amount",
      header: "Balance Amount",
      cell: ({ row }) => {
        const amount = row.getValue("amount") as number;
        return <span>{formatCurrency(amount)}</span>;
      },
    },
  ];

  // Only add Actions column for admin users or users with edit access (not GM)
  if (hasEditAccess) {
    columns.push({
      id: "actions",
      header: "Actions",
      cell: ({ row }) =>
        row.original && <BalanceReceiptInlineActions balanceReceipt={row.original} userRole={userRole} canEdit={canEdit} />,
    });
  }

  return columns;
};

export const BalanceReceiptInlineActions = ({
  balanceReceipt,
  userRole,
  canEdit,
}: {
  balanceReceipt: BalanceReceipt;
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
      <BalanceReceiptFormDialog
        balanceReceipt={balanceReceipt}
        open={openEdit}
        openChange={setOpenEdit}
        userRole={userRole}
      />

      {/* Delete Dialog */}
      <BalanceReceiptDeleteDialog
        balanceReceipt={balanceReceipt}
        open={openDelete}
        setOpen={setOpenDelete}
      />
    </div>
  );
};
