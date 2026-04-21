import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ViewLogDetails } from "@/components/admin/activity-log/view-log-details";

// Helper to make log details human-readable
function formatLogDetails(log: any) {
  if (!log.details) return "-";
  
  try {
    const details = JSON.parse(log.details);
    const action = log.action;
    const module = log.module || "";

    if (action === "LOGIN") return "Successfully signed in to the system";
    if (action === "LOGOUT") return "Signed out from the system";

    if (module === "Sales") {
      if (action === "CREATE") return `New Sale: ₹${details.cashPayment || 0} (${details.date ? new Date(details.date).toLocaleDateString() : ""})`;
      if (action === "UPDATE") return `Updated Sale #${details.id?.slice(-4) || ""}`;
      if (action === "DELETE") return `Deleted Sale from ${details.deletedData?.date ? new Date(details.deletedData.date).toLocaleDateString() : "unknown date"}`;
    }

    if (module === "Expenses") {
      if (action === "CREATE") return `New Expense: ${details.description || "No description"} (₹${details.amount || 0})`;
      if (action === "UPDATE") return `Updated Expense: ${details.changes?.description || "details updated"}`;
      if (action === "DELETE") return `Deleted Expense: ${details.deletedData?.description || ""} (₹${details.deletedData?.amount || 0})`;
    }

    if (module === "Users") {
      if (action === "UPDATE") {
        const changes = details.changes || {};
        const parts = [];
        if (changes.canEdit !== undefined) parts.push(`Edit Access: ${changes.canEdit ? "Enabled" : "Disabled"}`);
        if (changes.role) parts.push(`Role changed to ${changes.role}`);
        return parts.length > 0 ? `Updated User: ${parts.join(", ")}` : "User updated";
      }
    }

    if (module === "MeterReadings") {
      if (action === "CREATE") return `Recorded ${details.count || 0} nozzle readings for ${details.shift || ""} shift`;
    }

    // Default formatting for others
    return log.details;
  } catch (e) {
    return log.details;
  }
}

export default async function ActivityLogPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role?.toLowerCase() !== "admin") {
    redirect("/");
  }

  const logs = await prisma.activityLog.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case "CREATE":
        return <Badge className="bg-green-500 hover:bg-green-600 border-none">CREATE</Badge>;
      case "UPDATE":
        return <Badge className="bg-blue-500 hover:bg-blue-600 border-none">UPDATE</Badge>;
      case "DELETE":
        return <Badge className="bg-destructive hover:bg-destructive/90 border-none">DELETE</Badge>;
      case "LOGIN":
        return <Badge className="bg-purple-500 hover:bg-purple-600 border-none">LOGIN</Badge>;
      case "LOGOUT":
        return <Badge className="bg-orange-500 hover:bg-orange-600 border-none">LOGOUT</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 @container">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-primary">Activity Log</h1>
        <p className="text-muted-foreground">Monitor all system activities and user changes in real-time</p>
      </div>

      <Card className="border-none shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-semibold">System Audit Trail</CardTitle>
          <CardDescription>Comprehensive history of administrative and operational actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border bg-background overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-bold">Time</TableHead>
                  <TableHead className="font-bold">User</TableHead>
                  <TableHead className="font-bold text-center">Action</TableHead>
                  <TableHead className="font-bold">Module</TableHead>
                  <TableHead className="font-bold">Activity Details</TableHead>
                  <TableHead className="font-bold text-right">IP Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic">
                      No activity logs found. Try performing some actions in the system.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => {
                    const summary = formatLogDetails(log);
                    return (
                      <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="whitespace-nowrap font-medium text-sm">
                          {formatDateTime(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-semibold text-sm">{log.userName || "System"}</span>
                            <span className="text-[10px] text-muted-foreground leading-tight">{log.userEmail}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {getActionBadge(log.action)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] uppercase tracking-wider font-bold h-5">
                            {log.module || "SYSTEM"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="flex items-center justify-between gap-4">
                            <div className="text-sm font-medium text-foreground py-1 truncate">
                              {summary}
                            </div>
                            <ViewLogDetails log={log} summary={summary} />
                          </div>
                        </TableCell>
                        <TableCell className="text-[10px] font-mono text-muted-foreground text-right">
                          {log.ipAddress || "Local"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
