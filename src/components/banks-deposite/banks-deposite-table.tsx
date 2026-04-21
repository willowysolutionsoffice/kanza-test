"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useState, useEffect } from "react";
import { BankDepositeTableProps } from "@/types/bank-deposite";
import { bankDepositeColumns } from "./banks-deposite-colums";
import { Button } from "@/components/ui/button";

export function BankDepositeTable<TValue>({
  data: initialData,
  userRole,
  canEdit,
}: BankDepositeTableProps<TValue> & { userRole?: string; canEdit?: boolean }) {
  const columns = bankDepositeColumns(userRole, canEdit);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [data, setData] = useState(initialData);
  const [page, setPage] = useState(0);
  const pageSize = 15;

  // Use the passed data directly instead of making API calls
  useEffect(() => {
    setData(initialData);
    setPage(0);
  }, [initialData]);

  useEffect(() => {
    setPage(0);
  }, [globalFilter, sorting]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
      globalFilter,
    },
    globalFilterFn: (row, columnId, filterValue) => {
      const category = row.getValue("bank") as string;

      const filter = String(filterValue || "").toLowerCase();

      return (
        category?.toLowerCase().includes(filter)
      );
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-2">
            <CardTitle>Bank Deposites</CardTitle>
            <CardDescription>A list of all Bank Deposites</CardDescription>
          </div>

        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="bg-primary text-primary-foreground font-black"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table
                  .getRowModel()
                  .rows.slice(
                    page * pageSize,
                    page * pageSize + pageSize
                  )
                  .map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex flex-col gap-2 mt-4">
            <div className="text-sm text-muted-foreground">
              {table.getRowModel().rows.length > 0 ? (
                <>
                  Showing{" "}
                  {page * pageSize + 1}-
                  {Math.min(
                    (page + 1) * pageSize,
                    table.getRowModel().rows.length
                  )}{" "}
                  of {table.getRowModel().rows.length} record
                  {table.getRowModel().rows.length !== 1 ? "s" : ""}
                </>
              ) : (
                <>Showing 0 records</>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {table.getRowModel().rows.length === 0 ? 0 : page + 1} of{" "}
                {Math.max(
                  1,
                  Math.ceil(table.getRowModel().rows.length / pageSize)
                )}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((prev) =>
                    Math.min(
                      prev + 1,
                      Math.max(
                        0,
                        Math.ceil(table.getRowModel().rows.length / pageSize) - 1
                      )
                    )
                  )
                }
                disabled={
                  page >=
                  Math.max(
                    0,
                    Math.ceil(table.getRowModel().rows.length / pageSize) - 1
                  )
                }
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
