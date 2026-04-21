export const dynamic = "force-dynamic";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Purchase } from "@/types/purchase";
import { PurchaseOrder } from "@/types/purchase-order";
import PurchaseManagement from "@/components/purchase/purchase-management";
import { PurchaseSummaryCards } from "@/components/purchase/purchase-summary-cards";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PurchasePage() {
  const hdrs = await headers();
  const host = hdrs.get("host");
  const proto =
    hdrs.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const cookie = (await cookies()).toString();

  // Get session to check user role and branch
  const session = await auth.api.getSession({
    headers: hdrs,
  });

  if (!session) {
    redirect("/login");
  }

  const userRole = session.user?.role ?? undefined;
  const userBranchId =
    typeof session.user?.branch === "string" ? session.user.branch : undefined;
  const isAdmin =
    userRole?.toLowerCase() === "admin" || userRole?.toLowerCase() === "gm";
  const isGm = userRole?.toLowerCase() === "gm";

  // Fetch purchase orders and branches (purchases will be fetched by table with pagination)
  const [orderRes, branchesRes] = await Promise.all([
    fetch(`${proto}://${host}/api/purchase-order`, {
      cache: "no-store",
      headers: { cookie },
    }),
    fetch(`${proto}://${host}/api/branch`, {
      cache: "no-store",
      headers: { cookie },
    }),
  ]);

  const { purchaseOrder } = await orderRes.json();
  const { data: allBranches } = await branchesRes.json();

  // Filter branches based on user role
  const visibleBranches = isAdmin
    ? allBranches
    : allBranches.filter(
        (b: { id: string; name: string }) => b.id === (userBranchId ?? ""),
      );

  // Group purchase orders by visible branches only
  // Purchases will be fetched by the table component with pagination
  const purchasesByBranch = visibleBranches.map(
    (branch: { id: string; name: string }) => ({
      branchId: branch.id,
      branchName: branch.name,
      purchases: [] as Purchase[], // Empty array - table will fetch its own data
      purchaseOrders: purchaseOrder.filter(
        (po: PurchaseOrder) => po.branchId === branch.id,
      ),
    }),
  );

  return (
    <div className="flex flex-1 flex-col">
      <Tabs defaultValue={visibleBranches[0]?.id} className="w-full">
        <TabsList className="mb-4 flex w-full flex-wrap gap-2">
          {visibleBranches.map((branch: { id: string; name: string }) => (
            <TabsTrigger className="data-[state=active]:bg-secondary min-w-[120px] flex-1 data-[state=active]:text-white" key={branch.id} value={branch.id}>
              {branch.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {purchasesByBranch.map(
          ({
            branchId,
            branchName,
            purchases,
            purchaseOrders,
          }: {
            branchId: string;
            branchName: string;
            purchases: Purchase[];
            purchaseOrders: PurchaseOrder[];
          }) => {
            return (
              <TabsContent key={branchId} value={branchId}>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">
                    {branchName} Purchases
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    View all purchases in this branch
                  </p>
                </div>

                <PurchaseSummaryCards branchId={branchId} />

                <PurchaseManagement
                  isGm={isGm}
                  purchase={purchases}
                  purchaseOrder={purchaseOrders}
                  userRole={session.user.role || undefined}
                  canEdit={session.user.canEdit || false}
                  userBranchId={userBranchId}
                  branchId={branchId}
                />
              </TabsContent>
            );
          },
        )}
      </Tabs>
    </div>
  );
}
