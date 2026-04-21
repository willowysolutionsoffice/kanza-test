'use client';

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Edit2, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { PurchaseOrderFormModal } from "./purchase-order-form";
import { PurchaseOrderDeleteDialog } from "./purchase-order-delete-dialog";
import { PurchaseOrder } from "@/types/purchase-order";
import { formatDateTime } from "@/lib/utils";

export const purchaseOrderColumns: ColumnDef<PurchaseOrder>[] = [
  {
    accessorKey: "supplier",
    header: "Supplier",
    cell: ({row}) => {
      const supplier = row.original.supplier?.name

      return (
        <span>
          {supplier}
        </span>
      )
    }
  },
  {
    accessorKey: "productType",
    header: "Product",
    cell: ({ row }) => {
    const productType = row.original.productType;

    const productTypeColorMap: Record<string, string> = {
      Petrol: "bg-green-100 text-green-800",
      Diesel: "bg-blue-100 text-blue-800",
      Cng: "bg-yellow-100 text-yellow-800",
      Power: "bg-red-100 text-red-800",
    };

        const colorClasses = productTypeColorMap[productType] || "bg-gray-100 text-gray-800";

        return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${colorClasses}`}>
            {productType}
        </span>
        );
    },
    enableColumnFilter:true,
  },
  {
    accessorKey: "quantity",
    header: "Quantity",
  },
  {
    accessorKey: "orderDate",
    header: "Order Date",
    cell:({row}) => {
      const dateTime = row.original.createdAt
      return (
        <div>{formatDateTime(dateTime)}</div>
      )
    }
  }, 
  {
    id: "actions",
    cell: ({ row }) => <PurchaseOrderActions purchaseOrder={row.original} />,
  },
];

// Function to get columns based on user role and canEdit permission
export const getPurchaseOrderColumns = (userRole?: string, canEdit?: boolean): ColumnDef<PurchaseOrder>[] => {
  const isAdmin = userRole?.toLowerCase() === "admin";
  const hasEditAccess = isAdmin || !!canEdit;
  
  if (!hasEditAccess) {
    return purchaseOrderColumns.filter(col => col.id !== "actions");
  }
  return purchaseOrderColumns;
};

const PurchaseOrderActions = ({ purchaseOrder }: { purchaseOrder: PurchaseOrder }) => {
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false); 

  return (
    <>
      <div className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setOpenEdit(true)}>
              <Edit2 className="size-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setOpenDelete(!openDelete)}
            className="text-destructive">
              <Trash2 className="size-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <PurchaseOrderFormModal open={openEdit} openChange={setOpenEdit} purchaseOrder={purchaseOrder}/>

      <PurchaseOrderDeleteDialog 
        purchaseOrder={purchaseOrder}
        open={openDelete}
        setOpen={setOpenDelete}/>
    </>
  );
};
