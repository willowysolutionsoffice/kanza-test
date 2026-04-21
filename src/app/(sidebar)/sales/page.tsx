export const dynamic = "force-dynamic";

import { SalesTableWrapper } from "@/components/sales/sales-table-wrapper";
import { SalesFormModal } from "@/components/sales/sales-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, CoinsIcon } from "lucide-react";
import { Sales } from "@/types/sales";
import { headers, cookies } from "next/headers";
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';


export default async function SalesPage() {
    const hdrs = await headers();
    const host = hdrs.get("host");
    const proto = hdrs.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
    const cookie = (await cookies()).toString();
    
    // Get session to check user role and branch
    const session = await auth.api.getSession({
      headers: hdrs,
    });

    if (!session) {
      redirect('/login');
    }

    const isAdmin = (session.user.role ?? '').toLowerCase() === 'admin' || (session.user.role ?? '').toLowerCase() === 'gm';
    const isGm = (session.user.role ?? '').toLowerCase() === 'gm';
    const userBranchId = typeof session.user.branch === 'string' ? session.user.branch : undefined;
    
    // Fetch sales and branches with pagination
    const [salesRes, branchesRes] = await Promise.all([
      fetch(`${proto}://${host}/api/sales?limit=50`, {
        cache: "no-store",
        headers: { cookie },
      }),
      fetch(`${proto}://${host}/api/branch`, {
        cache: "no-store",
        headers: { cookie },
      })
    ]);
    
    const { sales } = await salesRes.json();
    const { data: allBranches } = await branchesRes.json();

    // Filter branches based on user role
    const visibleBranches = isAdmin ? allBranches : allBranches.filter((b: { id: string; name: string }) => b.id === (userBranchId ?? ''));

    // Group sales by visible branches only
    const salesByBranch = visibleBranches.map((branch: { id: string; name: string }) => ({
      branchId: branch.id,
      branchName: branch.name,
      sales: sales.filter((sale: Sales) => sale.branchId === branch.id)
    }));

  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Sales Management</h1>
              <p className="text-muted-foreground">Track and manage fuel sales transactions by branch</p>
            </div>
            {
              !isGm && <SalesFormModal 
              userRole={session.user.role || undefined}
              userBranchId={userBranchId}
            />
            }
          </div>

          <Tabs defaultValue={visibleBranches[0]?.id} className="w-full">
            <TabsList className="mb-4 flex flex-wrap gap-2 w-full">
              {visibleBranches.map((branch: { id: string; name: string }) => (
                <TabsTrigger className="data-[state=active]:bg-secondary min-w-[120px] flex-1 data-[state=active]:text-white" key={branch.id} value={branch.id}>
                  {branch.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {salesByBranch.map(({ branchId, branchName, sales }: { branchId: string; branchName: string; sales: Sales[] }) => {
              const xpDieselTotal = sales.reduce((sum: number, sale: Sales) => sum + (sale.xgDieselTotal || 0), 0);
              const hsdDieselTotal = sales.reduce((sum: number, sale: Sales) => sum + (sale.hsdDieselTotal || 0), 0);
              const msPetrolTotal = sales.reduce((sum: number, sale: Sales) => sum + (sale.msPetrolTotal || 0), 0);
              const totalSale = sales.reduce((sum: number, sale: Sales) => sum + sale.rate, 0);

              return (
                <TabsContent key={branchId} value={branchId}>
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold">{branchName} Sales</h2>
                    <p className="text-sm text-muted-foreground">
                      {sales.length} sale{sales.length !== 1 ? 's' : ''} in this branch
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4 mb-6">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">XG Diesel Sold</CardTitle>
                        <Coins className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-900">
                            ₹{xpDieselTotal}
                        </div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">HS Diesel Sold</CardTitle>
                        <Coins className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-900">
                            ₹{hsdDieselTotal}
                        </div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">MS Petrol Sold</CardTitle>
                        <CoinsIcon className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-900">
                            ₹{msPetrolTotal}
                        </div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Sold</CardTitle>
                        <Coins className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-700">
                            ₹{totalSale}
                        </div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                      </CardContent>
                    </Card>
                  </div>

                  <SalesTableWrapper 
                    data={sales} 
                    userRole={session.user.role || undefined} 
                    canEdit={session.user.canEdit || false}
                    branchId={branchId}
                  />
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
