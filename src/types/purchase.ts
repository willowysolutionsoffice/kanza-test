import { Purchase as PrismaPurchase } from "@prisma/client";
import { ColumnDef } from "@tanstack/react-table";


export interface Purchase extends PrismaPurchase {
  supplier: { name: string };
  branch: { name: string };
}

export interface PurchaseTableProps<TValue> {
  columns: ColumnDef<Purchase, TValue>[];
  data: Purchase[];
  canEdit?: boolean;
  userRole?: string;
}