'use client'

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Edit2, Trash2} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MeterReadingDeleteDialog } from "./meter-delete-dialog";
import { MeterReading } from "@/types/meter-reading";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MeterReadingUpdateForm } from "./meter-reading-update-form";

export const meterReadinColumns = (userRole?: string, canEdit?: boolean): ColumnDef<MeterReading>[] => {
  const isAdmin = userRole?.toLowerCase() === "admin";
  const hasEditAccess = isAdmin || !!canEdit;
  
  const columns: ColumnDef<MeterReading>[] = [
    {
      accessorKey: "date",
      header: "Date & Time",
      cell: ({ row }) => {
        const dateTime = row.original.date;
        return <div>{formatDate(dateTime)}</div>;
      },
    },
    {
      accessorKey: "nozzleId",
      header: "Nozzle",
      cell: ({ row }) => {
        const nozzle = row.original.nozzle.nozzleNumber;
        return <span>{nozzle}</span>;
      },
    },
    {
      accessorKey: "fuelType",
      header: "Fuel Type",
      cell: ({ row }) => {
        const fuelType = row.original.fuelType;

        const fuelTypeColorMap: Record<string, string> = {
          "MS-PETROL": "bg-red-100 text-red-800",
          "HSD-DIESEL": "bg-blue-100 text-blue-800",
          "XG-DIESEL": "bg-green-100 text-green-800",
        };

        const colorClasses = fuelTypeColorMap[fuelType] || "bg-gray-100 text-gray-800";

        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${colorClasses}`}
          >
            {fuelType}
          </span>
        );
      },
      enableColumnFilter: true,
    },
    {
      accessorKey: "openingReading",
      header: "Opening",
    },
    {
      accessorKey: "closingReading",
      header: "Closing",
    },
    {
      accessorKey: "difference",
      header: "Difference",
      cell: ({ row }) => {
        const difference = row.original.difference;
        return <div>{difference?.toFixed(2)}</div>;
      },
    },
    {
      accessorKey: "totalAmount",
      header: "Total Sold",
      cell: ({ row }) => {
        const soldAmount = row.original.totalAmount;
        return <div>{formatCurrency(soldAmount)}</div>;
      },
    },
  ];

  // Only add Actions column for admin users or users with edit access
  if (hasEditAccess) {
    columns.push({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => <MeterReadingActions meterReading={row.original} canEdit={canEdit} userRole={userRole} />,
    });
  }

  return columns;
};

const MeterReadingActions = ({ meterReading, canEdit, userRole }: { meterReading: MeterReading; canEdit?: boolean; userRole?: string }) => {
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {/* Edit Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpenEdit(true)}
        className="h-8 w-8 p-0"
      >
        <Edit2 className="h-4 w-4" />
      </Button>

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpenDelete(true)}
        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {/* Edit Form */}
      <MeterReadingUpdateForm
        open={openEdit}
        openChange={setOpenEdit}
        meterReading={meterReading}
      />

      {/* Delete Dialog */}
      <MeterReadingDeleteDialog
        meterReading={meterReading}
        open={openDelete}
        setOpen={setOpenDelete}
      />
    </div>
  );
};
