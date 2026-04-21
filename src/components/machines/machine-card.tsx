"use client"
import { Edit2, Settings, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useState } from "react";
import { MachineFormModal } from "./machine-form";
import { MachineDeleteDialog } from "./machine-delete-dialog";
import { Machine } from "@/types/machine";

type Props = {
  data: Machine[];
  userRole?: string;
  canEdit?: boolean;
}

export function Machinecard({ data, userRole, canEdit }: Props) {
  const isAdmin = userRole?.toLowerCase() === "admin";
  const isGm = userRole?.toLowerCase() === "gm";
  const hasEditAccess = isAdmin || !!canEdit;

  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false); 
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        {data && data.length > 0 ? (
          data.map((machine) => (
            <Card key={machine.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Settings className="mr-2 h-5 w-5" />
                    {machine.machineName}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Connected Tank</p>
                    <p className="font-medium">
                      {machine?.machineTanks
                      ?.map(mt => `${mt.tank?.tankName} (${mt.tank?.fuelType})`).join(" , ") ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Nozzles</p>
                    <p className="font-medium">{machine.noOfNozzles}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Branch</p>
                    <p className="font-medium">{machine?.branch?.name ? machine?.branch?.name : "..."}</p>
                  </div>
                </div>

                {hasEditAccess && (
                  <div className="flex justify-end space-x-2 pt-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end">

                        <DropdownMenuItem 
                            onSelect={() => {
                            setSelectedMachine(machine)
                            setOpenEdit(true)}}>
                            <Edit2 className="size-4 mr-2" /> Edit
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onSelect={() => {
                            setSelectedMachine(machine);
                            setOpenDelete(true);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="size-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="col-span-full text-center text-muted-foreground">
            No machines yet
          </p>
        )}
      </div>

      {/* Edit Dialog */}
      {selectedMachine && (
        <MachineFormModal
          open={openEdit}
          openChange={(open) => {
            setOpenEdit(open)
            if (!open) setSelectedMachine(null)
          }}
          machine={selectedMachine}
        />
      )}

      {selectedMachine && (
        <MachineDeleteDialog
          machine={selectedMachine}
          open={openDelete}
          setOpen={(open) => {
            setOpenDelete(open);
            if (!open) setSelectedMachine(null); 
          }}
        />
        )}
    </>
    
  );
}
