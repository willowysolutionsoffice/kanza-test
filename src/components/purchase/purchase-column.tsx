'use client';

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "../ui/button";
import { Edit2, Trash2 } from "lucide-react";
import { PurchaseFormModal } from "./purchase-form";
import { PurchaseDeleteDialog } from "./purchase-delete-dialog";
import { Purchase } from "@/types/purchase";
import { formatCurrency, formatDate } from "@/lib/utils";

export const purchaseColumns: ColumnDef<Purchase>[] = [
  {
    accessorKey: "date",
    header: "Date & Time",
    cell: ({ row }) => <div>{formatDate(row.original.date)}</div>,
  },
  {
    accessorKey: "supplier",
    header: "Supplier",
    cell: ({ row }) => <span>{row.original.supplier?.name}</span>,
  },
  {
    accessorKey: "productType",
    header: "Product",
    cell: ({ row }) => {
      const productType = row.original.productType;
      const productTypeColorMap: Record<string, string> = {
        'XP-DIESEL': "bg-green-100 text-green-800",
        'HSD-DIESEL': "bg-blue-100 text-blue-800",
        'MS-PETROL': "bg-red-100 text-red-800",
      };
      const colorClasses = productTypeColorMap[productType] || "bg-gray-100 text-gray-800";
      return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${colorClasses}`}>
          {productType}
        </span>
      );
    },
    enableColumnFilter: true,
  },
  {
    accessorKey: "quantity",
    header: "Quantity",
  },
  {
    accessorKey: "purchasePrice",
    header: "Amount",
    cell: ({ row }) => <div>{formatCurrency(row.original.purchasePrice)}</div>,
  },
  {
    accessorKey: "paidAmount",
    header: "Amount Paid",
    cell: ({ row }) => <div>{formatCurrency(row.original.paidAmount)}</div>,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <PurchaseActions purchase={row.original} />,
  },
];

// Function to get columns based on user role and canEdit permission
export const getPurchaseColumns = (userRole?: string, canEdit?: boolean): ColumnDef<Purchase>[] => {
  const isAdmin = userRole?.toLowerCase() === "admin";
  const hasEditAccess = isAdmin || !!canEdit;
  
  if (!hasEditAccess) {
    return purchaseColumns.filter(col => col.id !== "actions");
  }
  return purchaseColumns;
};

const PurchaseActions = ({ purchase }: { purchase: Purchase }) => {
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  return (
    <div className="flex gap-2">
      {/* Edit Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpenEdit(true)}
        className="text-blue-600 hover:text-blue-700"
      >
        <Edit2 className="h-4 w-4" />
      </Button>

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpenDelete(true)}
        className="text-red-600 hover:text-red-700"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {/* Edit Modal */}
      <PurchaseFormModal open={openEdit} openChange={setOpenEdit} purchase={purchase} />

      {/* Delete Dialog */}
      <PurchaseDeleteDialog open={openDelete} setOpen={setOpenDelete} purchase={purchase} />
    </div>
  );
};
