"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, History } from "lucide-react";
import { CustomerFormDialog } from "./customer-form";
import { CustomerDeleteDialog } from "./customer-delete-dailog";
import { CustomerHistoryModal } from "./customer-history-modal";
import { Customer } from "@/types/customer";

export const customerColumns = (userRole?: string, userBranchId?: string, canEdit?: boolean): ColumnDef<Customer>[] => [
  {
    accessorKey: "name",
    header: "Name",
    cell: function NameCell({ row }) {
      const customer = row.original;
      const [openHistory, setOpenHistory] = useState(false);

      return (
        <>
          <button
            className="text-blue-600 hover:underline cursor-pointer"
            onClick={() => setOpenHistory(true)}
          >
            {customer.name}
          </button>

          <CustomerHistoryModal
            customerId={customer.id}
            open={openHistory}
            onOpenChange={setOpenHistory}
          />
        </>
      );
    },
  },
  {
    accessorKey: "limit",
    header: "Limit",
  },
  {
    accessorKey: "openingBalance",
    header: "Opening",
    cell: ({ row }) => {
      const customer = row.original;
      // Use calculatedOpeningBalance if available (for current month), otherwise use base openingBalance
      const openingBalance = (customer as { calculatedOpeningBalance?: number }).calculatedOpeningBalance ?? customer.openingBalance;
      return (
        <div className="px-3">
          {openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      );
    },
  },
  {
    accessorKey: "outstandingPayments",
    header: "Pending",
    cell: ({ row }) => {
      const customer = row.original;
      const pendingAmount = customer.outstandingPayments;
      const limit = (customer as { limit?: number }).limit;
      const exceedsLimit = limit && pendingAmount > limit;

      return (
        <div className={`px-3 ${exceedsLimit ? 'text-red-600 font-semibold' : ''}`}>
          {pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      );
    },
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => <div className="px-3">{row.getValue("email") || "..."}</div>,
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ row }) => <div className="px-3">{row.getValue("phone") || "..."}</div>,
  },
  {
    accessorKey: "address",
    header: "Address",
    cell: ({ row }) => <div className="px-3">{row.getValue("address") || "..."}</div>,
  },
  // Only add Actions column for admin users or users with edit access
  ...(userRole?.toLowerCase() === "admin" || !!canEdit ? [{
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <CustomerActions customer={row.original} userRole={userRole} userBranchId={userBranchId} canEdit={canEdit} />,
  } as ColumnDef<Customer>] : []),
];

const CustomerActions = ({ customer, userRole, userBranchId, canEdit }: { customer: Customer; userRole?: string; userBranchId?: string; canEdit?: boolean }) => {
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);

  return (
    <div className="flex gap-2">
      {/* History Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpenHistory(true)}
        className="text-gray-600 hover:text-gray-800"
      >
        <History className="h-4 w-4" />
      </Button>

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

      {/* Modals */}
      <CustomerFormDialog
        open={openEdit}
        openChange={setOpenEdit}
        customers={customer}
        userRole={userRole}
        userBranchId={userBranchId}
      />

      <CustomerDeleteDialog
        customers={customer}
        open={openDelete}
        setOpen={setOpenDelete}
      />

      <CustomerHistoryModal
        customerId={customer.id}
        open={openHistory}
        onOpenChange={setOpenHistory}
      />
    </div>
  );
};
