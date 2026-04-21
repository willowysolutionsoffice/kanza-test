export const dynamic = "force-dynamic";

import { Machinecard } from "@/components/machines/machine-card";
import { MachineFormModal } from "@/components/machines/machine-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function MachinePage() {
  const hdrs = await headers();
  const host = hdrs.get("host");
  const proto =
    hdrs.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const cookie = (await cookies()).toString();
  
  // Get session to check user role
  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) {
    redirect('/login');
  }
  
   const userRole = session.user?.role ?? undefined;
  const canEdit = session.user?.canEdit ?? false;
  const isGm = (userRole?.toLowerCase() === "gm");
  
  // Fetch machines and branches
  const [machinesRes, branchesRes] = await Promise.all([
    fetch(`${proto}://${host}/api/machines`, {
      cache: "no-store",
      headers: { cookie },
    }),
    fetch(`${proto}://${host}/api/branch`, {
      cache: "no-store",
      headers: { cookie },
    })
  ]);
  
  const { data: machines } = await machinesRes.json();
  const { data: branches } = await branchesRes.json();

  // Group machines by branch
  const machinesByBranch = branches.map((branch: { id: string; name: string }) => ({
    branchId: branch.id,
    branchName: branch.name,
    machines: machines.filter((machine: { branchId: string | null }) => machine.branchId === branch.id)
  }));
  
  return (
    <div className="flex flex-1 flex-col">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Machine Management</h1>
              <p className="text-muted-foreground">Monitor and manage fuel dispensing machines by branch</p>
            </div>
            {(!isGm || canEdit) && <MachineFormModal />}
          </div>

          <Tabs defaultValue={branches[0]?.id} className="w-full">
            <TabsList className="mb-4 flex flex-wrap gap-2 w-full">
              {branches.map((branch: { id: string; name: string }) => (
                <TabsTrigger className="data-[state=active]:bg-secondary min-w-[120px] flex-1 data-[state=active]:text-white" key={branch.id} value={branch.id}>
                  {branch.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {machinesByBranch.map(({ branchId, branchName, machines }: { branchId: string; branchName: string; machines: any[] }) => (
              <TabsContent key={branchId} value={branchId}>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">{branchName} Machines</h2>
                  <p className="text-sm text-muted-foreground">
                    {machines.length} machine{machines.length !== 1 ? 's' : ''} in this branch
                  </p>
                </div>
                <Machinecard data={machines} userRole={userRole} canEdit={canEdit} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
