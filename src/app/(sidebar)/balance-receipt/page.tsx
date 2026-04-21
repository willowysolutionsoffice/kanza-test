export const dynamic = "force-dynamic";

import { BalanceReceiptFormDialog } from "@/components/balance-receipt/balance-receipt-form";
import { BalanceReceiptTable } from "@/components/balance-receipt/balance-receipt-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from 'next/navigation';

export default async function BalanceReceiptPage() {
const hdrs = await headers();
const host = hdrs.get("host");
const proto = hdrs.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
const cookie = (await cookies()).toString();

// Get user session
const session = await auth.api.getSession({ headers: await headers() });
if (!session) {
  redirect('/login');
}

const userRole = session.user?.role ?? undefined;
const userBranchId = typeof session.user?.branch === 'string' ? session.user.branch : undefined;
const isAdmin = (userRole?.toLowerCase() === "admin") || (userRole?.toLowerCase() === "gm");
const isGm = (userRole?.toLowerCase() === "gm");

// Fetch balance receipts and branches
const [balanceReceiptsRes, branchesRes] = await Promise.all([
  fetch(`${proto}://${host}/api/balance-receipts`, {
    cache: "no-store",
    headers: { cookie },
  }),
  fetch(`${proto}://${host}/api/branch`, {
    cache: "no-store",
    headers: { cookie },
  })
]);

const { balanceReceipts } = await balanceReceiptsRes.json();
const { data: allBranches } = await branchesRes.json();

// Filter branches based on user role (admin sees all, branch user sees only their branch)
const visibleBranches = isAdmin ? allBranches : allBranches.filter((b: { id: string; name: string }) => b.id === (userBranchId ?? ''));

// Default to user's branch for branch managers, first branch for admins
const defaultBranchId = isAdmin ? visibleBranches[0]?.id : userBranchId || visibleBranches[0]?.id;

// Group balance receipts by visible branches only
const balanceReceiptsByBranch = visibleBranches.map((branch: { id: string; name: string }) => {
  // For branch managers, only show receipts for their branch
  // For admins, show all receipts for each branch
  const filteredReceipts = isAdmin
    ? balanceReceipts.filter((receipt: { branchId: string | null }) => receipt.branchId === branch.id)
    : balanceReceipts.filter(
        (receipt: { branchId: string | null }) => receipt.branchId === branch.id && receipt.branchId === userBranchId
      );

  return {
    branchId: branch.id,
    branchName: branch.name,
    balanceReceipts: filteredReceipts
  };
});

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Balance Receipt</h1>
              <p className="text-muted-foreground">Manage Balance Receipts by branch</p>
            </div>
            {!isGm && (
              <BalanceReceiptFormDialog 
                userRole={userRole}
                userBranchId={userBranchId}
              />
            )}
          </div>

          <Tabs defaultValue={defaultBranchId} className="w-full">
            <TabsList className="mb-4 flex flex-wrap gap-2 w-full">
              {visibleBranches.map((branch: { id: string; name: string }) => (
                <TabsTrigger className="data-[state=active]:bg-secondary min-w-[120px] flex-1 data-[state=active]:text-white" key={branch.id} value={branch.id}>
                  {branch.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {balanceReceiptsByBranch.map(({ branchId, branchName, balanceReceipts }: { branchId: string; branchName: string; balanceReceipts: any[] }) => (
              <TabsContent key={branchId} value={branchId}>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">{branchName} Balance Receipts</h2>
                  <p className="text-sm text-muted-foreground">
                    {balanceReceipts.length} receipt{balanceReceipts.length !== 1 ? 's' : ''} in this branch
                  </p>
                </div>
                <BalanceReceiptTable 
                  data={balanceReceipts} 
                  branchId={branchId}
                  userRole={userRole}
                  canEdit={session.user.canEdit || false}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
