import { PurchaseOrder as PrismaPurchaseOrder } from "@prisma/client";
import { ColumnDef } from "@tanstack/react-table";


export interface PurchaseOrder extends PrismaPurchaseOrder {
  supplier: { name: string };
}

export interface PurchaseOrderTableProps<TValue> {
  columns: ColumnDef<PurchaseOrder, TValue>[];
  data: PurchaseOrder[];
  canEdit?: boolean;
  userRole?: string;
}