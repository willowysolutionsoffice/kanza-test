'use client';

import { useState, useEffect, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Edit2, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { SalesFormModal } from "./sales-form";
import { SalesDeleteDialog } from "./sales-delete-dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Sales } from "@/types/sales";

// Hook to get dynamic columns based on branch products
export const useSalesColumns = (userRole?: string, branchId?: string, canEdit?: boolean): ColumnDef<Sales>[] => {
  const isAdmin = userRole?.toLowerCase() === "admin";
  const hasEditAccess = isAdmin || !!canEdit;
  const [branchProducts, setBranchProducts] = useState<Array<{ productName: string }>>([]);
  
  // Fetch branch products to determine which columns to show
  useEffect(() => {
    if (!branchId) return;
    
    const fetchProducts = async () => {
      try {
        const res = await fetch(`/api/products?branchId=${branchId}`);
        const json = await res.json();
        const products = json.data || [];
        
        // Filter only FUEL category products
        const fuelProducts = products.filter(
          (p: { productCategory?: string; branchId?: string | null }) => 
            p.productCategory === "FUEL" && p.branchId === branchId
        );
        
        // Get unique product names
        const uniqueProducts = Array.from(
          new Set(fuelProducts.map((p: { productName: string }) => p.productName))
        ).map((name) => ({ productName: name as string }));
        
        setBranchProducts(uniqueProducts);
      } catch (error) {
        console.error("Failed to fetch branch products:", error);
      }
    };
    
    fetchProducts();
  }, [branchId]);
  
  // Determine which fuel products the branch has
  const hasXgDiesel = useMemo(() => {
    return branchProducts.some((p) => p.productName.toUpperCase() === "XG-DIESEL");
  }, [branchProducts]);
  
  const hasPowerPetrol = useMemo(() => {
    return branchProducts.some(
      (p) =>
        p.productName.toUpperCase() === "POWER PETROL" ||
        p.productName.toUpperCase() === "XP 95 PETROL"
    );
  }, [branchProducts]);
  
  const columns: ColumnDef<Sales>[] = useMemo(() => [
    {
      accessorKey: "date",
      header: "Date & Time",
      cell: ({ row }) => {
        const dateTime = row.original.date;
        return <div>{formatDate(dateTime)}</div>;
      },
    },
    {
      accessorKey: "cashPayment",
      header: "Cash Payment",
      cell: ({ row }) => <div>{formatCurrency(row.original.cashPayment)}</div>,
    },
    {
      accessorKey: "atmPayment",
      header: "ATM Payment",
      cell: ({ row }) => <div>{formatCurrency(row.original.atmPayment ?? 0)}</div>,
    },
    {
      accessorKey: "paytmPayment",
      header: "Paytm Payment",
      cell: ({ row }) => <div>{formatCurrency(row.original.paytmPayment ?? 0)}</div>,
    },
    {
      accessorKey: "fleetPayment",
      header: "Fleet Payment",
      cell: ({ row }) => <div>{formatCurrency(row.original.fleetPayment ?? 0)}</div>,
    },
    {
      accessorKey: "hsdDieselTotal",
      header: "HSD-DIESEL",
      cell: ({ row }) => {
        const fuelTotals = typeof row.original.fuelTotals === 'object' && row.original.fuelTotals
          ? row.original.fuelTotals as Record<string, number>
          : {};
        const value = fuelTotals["HSD-DIESEL"] ?? row.original.hsdDieselTotal ?? 0;
        return (
          <div className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800">
            {formatCurrency(value)}
          </div>
        );
      },
    },
    // Conditionally show XG-DIESEL or POWER PETROL based on branch products
    ...(hasXgDiesel ? [{
      accessorKey: "xgDieselTotal",
      header: "XG-DIESEL",
      cell: ({ row }) => {
        const fuelTotals = typeof row.original.fuelTotals === 'object' && row.original.fuelTotals
          ? row.original.fuelTotals as Record<string, number>
          : {};
        const value = fuelTotals["XG-DIESEL"] ?? row.original.xgDieselTotal ?? 0;
        return (
          <div className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-medium text-green-800">
            {formatCurrency(value)}
          </div>
        );
      },
    } as ColumnDef<Sales>] : []),
    ...(!hasXgDiesel && hasPowerPetrol ? [{
      accessorKey: "powerPetrolTotal",
      header: "POWER PETROL",
      cell: ({ row }) => {
        const fuelTotals = typeof row.original.fuelTotals === 'object' && row.original.fuelTotals
          ? row.original.fuelTotals as Record<string, number>
          : {};
        const value = fuelTotals["POWER PETROL"] ?? fuelTotals["XP 95 PETROL"] ?? row.original.powerPetrolTotal ?? 0;
        return (
          <div className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-sm font-medium text-purple-800">
            {formatCurrency(value)}
          </div>
        );
      },
    } as ColumnDef<Sales>] : []),
    {
      accessorKey: "msPetrolTotal",
      header: "MS-PETROL",
      cell: ({ row }) => {
        const fuelTotals = typeof row.original.fuelTotals === 'object' && row.original.fuelTotals
          ? row.original.fuelTotals as Record<string, number>
          : {};
        const value = fuelTotals["MS-PETROL"] ?? row.original.msPetrolTotal ?? 0;
        return (
          <div className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-medium text-red-800">
            {formatCurrency(value)}
          </div>
        );
      },
    },
    {
      accessorKey: "rate",
      header: "Total Amount",
      cell: ({ row }) => <div>{formatCurrency(row.original.rate)}</div>,
    },
    // Only add Actions column for admin users or users with edit access
    ...(hasEditAccess ? [{
      id: "actions",
      header: "Actions",
      cell: ({ row }) => <SalesActions sales={row.original} userRole={userRole} canEdit={canEdit} />,
    } as ColumnDef<Sales>] : []),
  ], [hasXgDiesel, hasPowerPetrol, hasEditAccess, userRole, canEdit]);

  return columns;
};

// Legacy function for backward compatibility (returns static columns)
export const salesColumns = (userRole?: string): ColumnDef<Sales>[] => {
  const isAdmin = userRole?.toLowerCase() === "admin";
  
  const columns: ColumnDef<Sales>[] = [
    {
      accessorKey: "date",
      header: "Date & Time",
      cell: ({ row }) => {
        const dateTime = row.original.date;
        return <div>{formatDate(dateTime)}</div>;
      },
    },
    {
      accessorKey: "cashPayment",
      header: "Cash Payment",
      cell: ({ row }) => <div>{formatCurrency(row.original.cashPayment)}</div>,
    },
    {
      accessorKey: "atmPayment",
      header: "ATM Payment",
      cell: ({ row }) => <div>{formatCurrency(row.original.atmPayment ?? 0)}</div>,
    },
    {
      accessorKey: "paytmPayment",
      header: "Paytm Payment",
      cell: ({ row }) => <div>{formatCurrency(row.original.paytmPayment ?? 0)}</div>,
    },
    {
      accessorKey: "fleetPayment",
      header: "Fleet Payment",
      cell: ({ row }) => <div>{formatCurrency(row.original.fleetPayment ?? 0)}</div>,
    },
    {
      accessorKey: "hsdDieselTotal",
      header: "HSD-DIESEL",
      cell: ({ row }) => (
        <div className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-sm font-medium text-blue-800">
          {formatCurrency(row.original.hsdDieselTotal || 0)}
        </div>
      ),
    },
    {
      accessorKey: "xgDieselTotal",
      header: "XG-DIESEL",
      cell: ({ row }) => (
        <div className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-medium text-green-800">
          {formatCurrency(row.original.xgDieselTotal || 0)}
        </div>
      ),
    },
    {
      accessorKey: "msPetrolTotal",
      header: "MS-PETROL",
      cell: ({ row }) => (
        <div className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-sm font-medium text-red-800">
          {formatCurrency(row.original.msPetrolTotal || 0)}
        </div>
      ),
    },
    {
      accessorKey: "rate",
      header: "Total Amount",
      cell: ({ row }) => <div>{formatCurrency(row.original.rate)}</div>,
    },
  ];

  if (isAdmin) {
    columns.push({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => <SalesActions sales={row.original} userRole={userRole} />,
    });
  }

  return columns;
};

const SalesActions = ({
  sales,
  userRole,
  canEdit,
}: {
  sales: Sales;
  userRole?: string;
  canEdit?: boolean;
}) => {
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  const isAdmin = userRole?.toLowerCase() === "admin";
  if (!isAdmin && !canEdit) return null;

  return (
    <>
      <div className="flex justify-end items-center gap-2">
        {/* Edit Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setOpenEdit(true)}
          title="Edit Sale"
          className="h-8 w-8"
        >
          <Edit2 className="h-4 w-4" />
        </Button>

        {/* Delete Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setOpenDelete(true)}
          title="Delete Sale"
          className="h-8 w-8 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Edit Modal */}
      <SalesFormModal open={openEdit} openChange={setOpenEdit} sales={sales} />

      {/* Delete Modal */}
      <SalesDeleteDialog
        sales={sales}
        open={openDelete}
        setOpen={setOpenDelete}
      />
    </>
  );
};
