"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { IconEye } from "@tabler/icons-react";

interface ViewLogDetailsProps {
    log: any;
    summary: string;
}

export function ViewLogDetails({ log, summary }: ViewLogDetailsProps) {
    let detailsObj = {};
    try {
        detailsObj = log.details ? JSON.parse(log.details) : {};
    } catch (e) {
        detailsObj = { error: "Failed to parse details", raw: log.details };
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-primary/10">
                    <IconEye className="h-4 w-4 text-primary" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Activity Details</DialogTitle>
                    <DialogDescription>
                        Detailed information for log entry from {new Date(log.createdAt).toLocaleString()}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                            <span className="text-muted-foreground block">User</span>
                            <span className="font-semibold">{log.userName} ({log.userEmail})</span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-muted-foreground block">Action / Module</span>
                            <span className="font-semibold uppercase">{log.action} | {log.module || "SYSTEM"}</span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-muted-foreground block">Summary</span>
                            <span className="font-medium text-primary">{summary}</span>
                        </div>
                        <div className="space-y-1">
                            <span className="text-muted-foreground block">IP Address</span>
                            <span className="font-mono text-xs">{log.ipAddress || "Local"}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <span className="text-sm font-semibold block">Full Data Snapshot</span>
                        <div className="bg-muted p-4 rounded-lg overflow-x-auto">
                            <pre className="text-xs font-mono whitespace-pre-wrap">
                                {JSON.stringify(detailsObj, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
