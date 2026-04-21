"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "../ui/button";
import { Edit2, Trash2 } from "lucide-react";
import { useState } from "react";
import { NozzleFormModal } from "./nozzle-form";
import { NozzleDeleteDialog } from "./nozzle-delete-dialog";
import { Nozzle } from "@/types/nozzle";

export const nozzleColumns: ColumnDef<Nozzle>[] = [
  {
    accessorKey: "nozzleNumber",
    header: "Nozzle#",
  },
  {
    accessorKey: "machine",
    header: "Machine",
    cell: ({ row }) => {
      const machine = row.original.machine?.machineName;
      return <span>{machine}</span>;
    },
  },
  {
    accessorKey: "fuelType",
    header: "Fuel Type",
    cell: ({ row }) => {
      const fuelType = row.original.fuelType;
      const fuelTypeColorMap: Record<string, string> = {
        "XG-DIESEL": "bg-green-100 text-green-800",
        "HSD-DIESEL": "bg-blue-100 text-blue-800",
        "MS-PETROL": "bg-red-100 text-red-800",
      };

      const colorClasses =
        fuelTypeColorMap[fuelType] || "bg-gray-100 text-gray-800";

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
    header: "Opening Reading",
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => <NozzleActions nozzle={row.original} />,
  },
];

// Function to get columns based on user role and canEdit permission
export const getNozzleColumns = (userRole?: string, canEdit?: boolean): ColumnDef<Nozzle>[] => {
  const isAdmin = userRole?.toLowerCase() === "admin";
  const hasEditAccess = isAdmin || !!canEdit;
  
  if (!hasEditAccess) {
    return nozzleColumns.filter(col => col.id !== "actions");
  }
  return nozzleColumns;
};

const NozzleActions = ({ nozzle }: { nozzle: Nozzle }) => {
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  return (
    <div className="flex justify-start items-center gap-2">
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
      <NozzleFormModal open={openEdit} openChange={setOpenEdit} nozzle={nozzle} />

      {/* Delete Dialog */}
      <NozzleDeleteDialog
        nozzle={nozzle}
        open={openDelete}
        setOpen={setOpenDelete}
      />
    </div>
  );
};
