// PurchaseManagement.tsx (Client Component)
"use client";

import { useState } from "react";
import { PurchaseTable } from "@/components/purchase/purchase-table";
import { PurchaseFormModal } from "@/components/purchase/purchase-form";
// import { PurchaseOrderFormModal } from "@/components/purchase/purchase-form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { purchaseColumns, getPurchaseColumns } from "@/components/purchase/purchase-column";
import { Purchase } from "@/types/purchase";
import { PurchaseOrderTable } from "../purchase-order/purchase-order-table";
import { purchaseOrderColumns, getPurchaseOrderColumns } from "../purchase-order/purchase-order-column";
import { PurchaseOrder } from "@/types/purchase-order";
import { PurchaseOrderFormModal } from "../purchase-order/purchase-order-form";

type PurchaseManagementProps = {
  purchase: Purchase[];
  purchaseOrder: PurchaseOrder[];
  userRole?: string;
  canEdit?: boolean;
  userBranchId?: string;
  branchId?: string;
  isGm?: boolean;
};

export default function PurchaseManagement({ purchase, purchaseOrder, userRole, canEdit, userBranchId, branchId , isGm }: PurchaseManagementProps) {
  const [activeTab, setActiveTab] = useState("purchase");

  const tablePurchaseColumns = getPurchaseColumns(userRole, canEdit);
  const tablePurchaseOrderColumns = getPurchaseOrderColumns(userRole, canEdit);

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Purchase Management</h1>
            <p className="text-muted-foreground">Manage fuel and inventory purchases</p>
          </div>
          {activeTab === "purchase" ? (
            <PurchaseFormModal 
              userRole={userRole}
              canEdit={canEdit}
              userBranchId={userBranchId}
            />
          ) : (
            <PurchaseOrderFormModal />
          )}
        </div>

        <Tabs
          defaultValue="purchase"
          className="w-full "
          onValueChange={(value) => setActiveTab(value)}
        >
          <TabsList>
            <TabsTrigger value="purchase">Purchase List</TabsTrigger>
            <TabsTrigger value="ordered">Purchase Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="purchase">
            <PurchaseTable data={purchase} columns={tablePurchaseColumns} branchId={branchId} canEdit={canEdit} userRole={userRole} />
          </TabsContent>

          <TabsContent value="ordered">
            <PurchaseOrderTable data={purchaseOrder} columns={tablePurchaseOrderColumns} userRole={userRole} canEdit={canEdit} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
