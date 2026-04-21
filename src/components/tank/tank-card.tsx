'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Droplets, Container, Settings, Edit2, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { TankFormDialog } from './tank-form'
import { DeleteTankDialog } from './tank-delete-dialog'
import { RefillTankFormDialog } from './refill-form'
import { Tank } from '@/types/tank'
import { Progress } from '../ui/progress'

interface TankCardProps {
  tanks: Tank[]
  userRole?: string
  canEdit?: boolean
}

export function TankCard({ tanks, userRole, canEdit }: TankCardProps) {
  const isAdmin = userRole?.toLowerCase() === "admin";
  const isGm = userRole?.toLowerCase() === "gm";
  const hasEditAccess = isAdmin || !!canEdit;
  const [openEdit, setOpenEdit] = useState(false)
  const [openDelete, setOpenDelete] = useState(false)
  const [openRefill, setOpenRefill] = useState(false)
  const [selectedTank, setSelectedTank] = useState<Tank | null>(null)

  const getFuelColor = (fuelType: string) => {
    switch (fuelType) {
      case "XP-DIESEL":
        return "text-green-600";
      case "HSD-DIESEL":
        return "text-blue-600";
      case "MS-PETROL":
        return "text-red-600";
      default:
        return "text-muted-foreground";
    }
  };


  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
        {tanks.map((tank) => {
          const percentage = (tank.currentLevel / tank.capacity) * 100;
          return (
            <Card
              key={tank.id}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center">
                    <Container className="mr-2 h-5 w-5" />
                    {tank.tankName}
                  </CardTitle>
                </div>
                <CardDescription className={`flex items-center ${getFuelColor(tank.fuelType)}`}>
                  <Droplets className="mr-1 h-3 w-3" />
                  {tank.fuelType}
                </CardDescription>
              </CardHeader>


              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Current Level</span>
                    <span className="font-medium">{tank.currentLevel.toLocaleString()}L / {tank.capacity.toLocaleString()}L</span>
                  </div>
                  <Progress value={percentage} className="h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{percentage.toFixed(1)}% Full</span>
                    <span>Min: {tank.minLevel.toLocaleString()}L</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Last Filled</p>
                    <p className="font-medium">{formatDate(tank?.lastFilled)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Branch</p>
                    <p className="font-medium">{tank?.branch?.name ? tank?.branch?.name : "..."}</p>
                  </div>
                </div>

                <div className="flex space-x-2 pt-2">
                  {hasEditAccess && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setSelectedTank(tank)
                        setOpenRefill(true)
                      }}

                    >
                      <Droplets className="mr-1 h-3 w-3" />
                      Refill
                    </Button>
                  )}
                  {!isGm && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">

                        <DropdownMenuItem 
                          onSelect={() => {
                          setSelectedTank(tank) ;
                          setOpenEdit(true);}}>
                          <Edit2 className="size-4 mr-2" /> Edit
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onSelect={() => {
                            setSelectedTank(tank);
                            setOpenDelete(true);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="size-4 mr-2" /> Delete
                        </DropdownMenuItem>

                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Edit Dialog */}
      {selectedTank && (
        <TankFormDialog
          open={openEdit}
          openChange={(open) => {
            setOpenEdit(open)
            if (!open) setSelectedTank(null)
          }}
          tank={selectedTank}
        />
      )}

      {/* Delete Dialog */}
      {selectedTank && (
        <DeleteTankDialog
          open={openDelete}
          setOpen={(open) => {
            setOpenDelete(open)
            if (!open) setSelectedTank(null)
          }}
          tank={selectedTank}
        />
      )}

      {/* Refill Dialog */}
      {selectedTank && (
        <RefillTankFormDialog
          open={openRefill}
          openChange={(open) => {
            setOpenRefill(open)
            if (!open) setSelectedTank(null)
          }}
          tank={selectedTank}
        />
      )}
    </>
  )
}
