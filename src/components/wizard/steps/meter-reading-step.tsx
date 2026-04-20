"use client";

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bulkSchema } from '@/schemas/bulk-schema';
import { z } from 'zod';
import { useWizard } from '../form-wizard';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { ProductType } from '@/types/product';
import { PowerOff } from 'lucide-react';

type MachineWithNozzles = {
  id: string;
  machineName: string;
  branchId: string | null;
  nozzles: {
    id: string;
    nozzleNumber: string;
    openingReading: number;  
    fuelType: string;
  }[];
};

type BulkForm = z.infer<typeof bulkSchema>;

export const MeterReadingStep: React.FC = () => {
  const { selectedBranchId } = useWizard();
  const { markStepCompleted, markCurrentStepCompleted, currentStep, setOnSaveAndNext, setIsStepDisabled, isPumpClosed } = useWizard();
  const [machines, setMachines] = useState<MachineWithNozzles[]>([]);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<ProductType[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [tankLevels, setTankLevels] = useState<Record<string, { currentLevel: number; tankName: string; fuelType: string }>>({});
  // const [hasValidationErrors, setHasValidationErrors] = useState(false);
  const router = useRouter();
  const [branchFuelProducts, setBranchFuelProducts] = useState<{ productName: string }[]>([]);
  const [stockLevels, setStockLevels] = useState<Record<string, number>>({}); // fuelType -> stock quantity

  const { commonDate } = useWizard();

  const form = useForm<BulkForm>({
    resolver: zodResolver(bulkSchema),
    defaultValues: {
      date: commonDate,
      rows: [],
    },
  });

  const nozzleMap = useMemo(() => {
    const m = new Map<string, { fuelType: string }>();
    machines.forEach((mach) =>
      mach.nozzles.forEach((n) => m.set(n.id, { fuelType: n.fuelType }))
    );
    return m;
  }, [machines]);

  // Function to validate tank level
  const validateTankLevel = useCallback((nozzleId: string, closingValue: number, openingValue: number) => {
    const tankInfo = tankLevels[nozzleId];
    
    if (!tankInfo) {
      return {
        isValid: false,
        message: "insufficient level"
      };
    }

    const difference = closingValue - openingValue;
    if (difference < 0) return null; // Invalid reading (closing < opening)

    const remainingLevel = tankInfo.currentLevel - difference;
    
    if (remainingLevel < 0) {
      return {
        isValid: false,
        message: "insufficient level"
      };
    }

  }, [tankLevels]);

  // Function to get current stock for a fuel type
  const getCurrentStock = useCallback((fuelType: string) => {
    return stockLevels[fuelType] || 0;
  }, [stockLevels]);

  // Function to check if stock is negative for any fuel type
  const hasNegativeStock = useCallback((fuelType: string) => {
    const rows = form.getValues('rows');
    const totalSale = rows
      .filter(r => r.fuelType === fuelType && r.sale != null)
      .reduce((sum, r) => sum + (r.sale || 0), 0);
    return getCurrentStock(fuelType) - totalSale < 0;
  }, [form, getCurrentStock]);

  // Function to check if there are any validation errors
  const checkValidationErrors = useCallback(() => {
    const rows = form.getValues('rows');
    let hasErrors = false;

    // Check individual tank level validation
    for (const row of rows) {
      if (row.closing != null && row.opening != null) {
        const validation = validateTankLevel(row.nozzleId, row.closing, row.opening);
        if (validation && !validation.isValid) {
          hasErrors = true;
          break;
        }
      }
    }

    // Note: Stock validation is shown as warning but doesn't block saving
    // if (!hasErrors) {
    //   const stockIssues = validateStockAvailability();
    //   if (stockIssues.length > 0) {
    //     hasErrors = true;
    //   }
    // }

    // setHasValidationErrors(hasErrors);
    setIsStepDisabled(hasErrors);
  }, [form, validateTankLevel, setIsStepDisabled]);

  // Load data
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Fetch machines and tank levels in parallel
        const machinesUrl = selectedBranchId ? `/api/machines/with-nozzles?branchId=${selectedBranchId}` : '/api/machines/with-nozzles';
        const tankLevelsUrl = selectedBranchId ? `/api/tanks/current-levels?branchId=${selectedBranchId}` : '/api/tanks/current-levels';
        const [machinesRes, tankLevelsRes] = await Promise.all([
          fetch(machinesUrl),
          fetch(tankLevelsUrl)
        ]);

        const machinesJson = await machinesRes.json();
        const tankLevelsJson = await tankLevelsRes.json();

        const data: MachineWithNozzles[] = machinesJson.data ?? [];
        setMachines(data);
        setTankLevels(tankLevelsJson.data ?? {});

        // Create a map of branch-specific fuel rates
        const branchPriceMap = new Map<string, Map<string, number>>();
        products.forEach(p => {
          if (p.branchId) {
            if (!branchPriceMap.has(p.branchId)) {
              branchPriceMap.set(p.branchId, new Map());
            }
            branchPriceMap.get(p.branchId)!.set(p.productName, p.sellingPrice);
          }
        });

        const rows: BulkForm['rows'] = data.flatMap((m) =>
          m.nozzles.map((n) => {
            const opening = n.openingReading;   
            // Get fuel rate for the specific branch
            const branchPrices = m.branchId ? branchPriceMap.get(m.branchId) : null;
            const fuelRate = branchPrices?.get(n.fuelType) ?? undefined;

            return {
              nozzleId: n.id,
              fuelType: n.fuelType,
              opening,           
              closing: undefined, 
              fuelRate,
              quantity: undefined,
              totalAmount: undefined,
            };
          })
        );      

        form.reset({ 
          date: commonDate, 
          rows 
        });
        setIsInitialized(true);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load machines/nozzles');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [products, form, selectedBranchId, commonDate]);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products");
        const json = await res.json();
        setProducts(json.data || []);
      } catch (error) {
        console.error("Failed to fetch meter products", error);
      }
    };

    fetchProducts();
  }, []);

  // Fetch branch fuel products (FUEL category products for the selected branch)
  useEffect(() => {
    const fetchBranchFuelProducts = async () => {
      if (!selectedBranchId) {
        setBranchFuelProducts([]);
        return;
      }

      try {
        const res = await fetch("/api/products");
        const json = await res.json();
        
        // Filter: only FUEL category products for the selected branch
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fuelProducts = json.data?.filter((product: any) => {
          return product.productCategory === "FUEL" && product.branchId === selectedBranchId;
        }) || [];
        
        // Get unique product names
        const uniqueFuelProductNames = Array.from(
          new Set(fuelProducts.map((p: { productName: string }) => p.productName))
        ).map((name) => ({ productName: name as string }));
        
        setBranchFuelProducts(uniqueFuelProductNames);
      } catch (error) {
        console.error("Failed to fetch branch fuel products", error);
        setBranchFuelProducts([]);
      }
    };

    fetchBranchFuelProducts();
  }, [selectedBranchId]);

  // Fetch stock levels for the selected branch
  useEffect(() => {
    const fetchStockLevels = async () => {
      if (!selectedBranchId) {
        setStockLevels({});
        return;
      }

      try {
        const res = await fetch("/api/stocks");
        const json = await res.json();
        
        // Create a map of fuelType -> stock quantity for the selected branch
        const stockMap: Record<string, number> = {};
        json.data?.forEach((stock: { branchId?: string; item?: string; quantity?: number }) => {
          if (stock.branchId === selectedBranchId && stock.item) {
            stockMap[stock.item] = stock.quantity || 0;
          }
        });
        
        setStockLevels(stockMap);
      } catch (error) {
        console.error("Failed to fetch stock levels", error);
        setStockLevels({});
      }
    };

    fetchStockLevels();
  }, [selectedBranchId]);

  const rows = form.watch('rows');

  const getRowIndex = (nozzleId: string) =>
    rows.findIndex((r) => r.nozzleId === nozzleId);

  // Watch for changes in rows and check validation
  useEffect(() => {
    if (isInitialized) {
      checkValidationErrors();
    }
  }, [rows, isInitialized, checkValidationErrors]);

  // Submit function
  const submit = useCallback(async (values: BulkForm): Promise<boolean> => {
    try {
      // Note: Stock validation messages are shown but don't prevent saving
      // if (hasValidationErrors) {
      //   const stockIssues = validateStockAvailability();
      //   if (stockIssues.length > 0) {
      //     const fuelTypes = stockIssues.map(issue => issue.fuelType).join(', ');
      //     toast.error(`Cannot save: Insufficient stock for ${fuelTypes}. Please adjust your closing readings.`);
      //   } else {
      //     toast.error("Cannot save with insufficient stock levels. Please check your closing readings.");
      //   }
      //   return false;
      // }

      // ensure closing >= opening before saving
      const items = values.rows.map((r) => {
        const fuelType = nozzleMap.get(r.nozzleId)?.fuelType;
        const opening = typeof r.opening === "number" ? r.opening : null;
        let closing = typeof r.closing === "number" ? r.closing : null;

        // if closing is empty, set it to opening
        if (closing === null && opening !== null) {
          closing = opening;
        }

        // enforce rule only at save time
        if (closing !== null && opening !== null && closing < opening) {
          closing = opening;
        }

        const sale =
          opening !== null && closing !== null ? closing - opening : null;
        const totalAmount =
          sale !== null && r.fuelRate
            ? Number((sale * r.fuelRate).toFixed(2))
            : null;

        return {
          nozzleId: r.nozzleId,
          fuelType,
          date: values.date,
          openingReading: opening,
          closingReading: closing,
          fuelRate: typeof r.fuelRate === "number" ? r.fuelRate : null,
          sale,
          totalAmount,
        };
      });

      // Make sure at least one row has a value
      const hasAnyReading = items.some(
        (item) => item.openingReading !== null || item.closingReading !== null
      );
      if (!hasAnyReading) {
        toast.error("Enter at least one opening or closing reading.");
        return false;
      }

      const res = await fetch("/api/meterreadings/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, branchId: selectedBranchId }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error ?? "Failed to save meter readings");
        return false;
      }

      toast.success("Meter readings recorded");
      markStepCompleted(currentStep);
      router.refresh();
      return true;
    } catch (e) {
      console.error(e);
      toast.error("Unexpected error");
      return false;
    }
  }, [nozzleMap, markStepCompleted, currentStep, router, selectedBranchId]);

  // Set up the save handler only when initialized - but don't call it
  useEffect(() => {
    if (isInitialized) {
      setOnSaveAndNext(() => async () => {
        try {
          const values = form.getValues();
          const result = await submit(values);
          return result;
        } catch (error) {
          console.error("Error saving meter reading:", error);
          return false;
        }
      });
    }
  }, [isInitialized, form, submit, setOnSaveAndNext]);
  
  // Auto-complete step when pump is closed
  useEffect(() => {
    if (isPumpClosed) {
      markCurrentStepCompleted();
      setIsStepDisabled(false);
    }
  }, [isPumpClosed, markCurrentStepCompleted, setIsStepDisabled]);

  return (
    <FormProvider {...form}>
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Meter Reading Form</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Pump Closed Banner */}
          {isPumpClosed && (
            <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-4 text-red-700">
              <PowerOff className="w-5 h-5 shrink-0" />
              <div>
                <div className="font-semibold">Pump is closed on this date</div>
                <div className="text-sm text-red-600 mt-0.5">
                  No meter reading required. The opening reading for the next working day will carry forward automatically.
                </div>
              </div>
            </div>
          )}
          {/* Only show form when pump is open */}
          {!isPumpClosed && (
          <form className="flex h-full flex-col">
            {/* Global controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Button 
                        variant="outline" 
                        disabled
                        className="w-full text-left font-normal bg-muted cursor-not-allowed"
                      >
                        {field.value
                          ? new Date(field.value).toLocaleDateString("en-EG") 
                          : "Pick date"}
                      </Button>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Machines & nozzles */}
            <div className="mt-6 space-y-6">
              {loading && (
                <div className="text-sm text-muted-foreground">Loading…</div>
              )}
              {machines.map((machine) => (
                <div key={machine.id} className="rounded-2xl border p-4">
                  <div className="mb-3 text-base font-semibold">
                    {machine.machineName}
                  </div>

                  <div className="hidden sm:grid sm:grid-cols-20 gap-1 px-2 text-xs text-muted-foreground">
                    <div className="col-span-4">Nozzle</div>
                    <div className="col-span-2 text-right">Fuel</div>
                    <div className="col-span-3 text-right">Opening</div>
                    <div className="col-span-3 text-right">Closing</div>
                    <div className="col-span-2 text-right">Sale</div>
                    <div className="col-span-2 text-right">Price</div>
                    <div className="col-span-4 text-right">Total</div>
                  </div>

                  {machine.nozzles.map((n) => {
                    const idx = getRowIndex(n.id);

                    return (
                      <div
                        key={n.id}
                        className="grid grid-cols-2 sm:grid-cols-20 gap-1 items-center px-2 py-2"
                      >
                        <div className="col-span-2 sm:col-span-4 font-medium">
                          <div className="font-medium">{n.nozzleNumber}</div>
                        </div>

                        <div className="hidden sm:block sm:col-span-2 text-right text-sm">
                          {n.fuelType}
                        </div>

                        {/* Opening */}
                        <div className="col-span-1 sm:col-span-3">
                          <FormField
                            control={form.control}
                            name={`rows.${idx}.opening`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    disabled
                                    type="text"
                                    placeholder="opening"
                                    value={field.value ?? ""}
                                    onChange={(e) =>
                                      field.onChange(
                                        e.target.value === "" ? undefined : Number(e.target.value)
                                      )
                                    }
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Closing */}
                        <div className="col-span-1 sm:col-span-3">
                          <FormField
                            control={form.control}
                            name={`rows.${idx}.closing`}
                            render={({ field }) => {
                              const openingValue = form.getValues(`rows.${idx}.opening`);
                              const closingValue = field.value;
                              const fuelType = n.fuelType;
                              const validation = closingValue != null && openingValue != null 
                                ? validateTankLevel(n.id, closingValue, openingValue) 
                                : null;
                              
                              // Calculate remaining stock for this fuel type
                              const rows = form.watch('rows');
                              const currentStock = getCurrentStock(fuelType);
                              
                              // Calculate total sale for this fuel type excluding current row
                              const otherRowsSale = rows
                                .filter((r, i) => r.fuelType === fuelType && i !== idx && r.sale != null)
                                .reduce((sum, r) => sum + (r.sale || 0), 0);
                              
                              // Calculate sale for current row
                              const currentRowSale = closingValue != null && openingValue != null
                                ? closingValue - openingValue
                                : 0;
                              
                              // Calculate remaining stock after all sales including this row
                              const remainingStock = currentStock - otherRowsSale - currentRowSale;
                              
                              // Check if this fuel type has negative stock (from other rows)
                              // Disable all remaining closing reading fields when stock goes negative
                              const isStockNegative = hasNegativeStock(fuelType);
                              // Disable if stock is negative and this field hasn't been filled yet (empty or equals opening)
                              const isDisabled = isStockNegative && (field.value == null || field.value === openingValue);

                              return (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      placeholder="closing"
                                      value={field.value ?? ""}
                                      disabled={isDisabled}
                                      className={`${validation && !validation.isValid ? "border-red-500" : ""} ${isDisabled ? "opacity-50 cursor-not-allowed" : ""} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      onChange={(e) => {
                                        const newClosingValue = e.target.value === "" ? undefined : Number(e.target.value);
                                        
                                        field.onChange(newClosingValue);
                                        
                                        const openingValue = form.getValues(`rows.${idx}.opening`);
                                        const fuelRate = form.getValues(`rows.${idx}.fuelRate`);
                                        
                                        if (openingValue != null && newClosingValue != null) {
                                          const sale = newClosingValue - openingValue;
                                          form.setValue(`rows.${idx}.sale`, sale);
                                        
                                          if (fuelRate != null) {
                                            const amount = sale * fuelRate;
                                            form.setValue(`rows.${idx}.totalAmount`, amount);
                                          } else {
                                            form.setValue(`rows.${idx}.totalAmount`, undefined);
                                          }
                                        } else {
                                          form.setValue(`rows.${idx}.sale`, undefined);
                                          form.setValue(`rows.${idx}.totalAmount`, undefined);
                                        }
                                        
                                        // Trigger validation check immediately
                                        setTimeout(() => checkValidationErrors(), 0);
                                      }}
                                    />
                                  </FormControl>
                                  {validation && (
                                    <div className={`text-xs mt-1 ${validation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                                      {validation.message}
                                    </div>
                                  )}
                                  {closingValue != null && openingValue != null && (
                                    <div className={`text-xs mt-1 ${remainingStock < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                      Stock: {remainingStock.toFixed(2)}L
                                    </div>
                                  )}
                                  {isDisabled && (
                                    <div className="text-xs mt-1 text-red-600">
                                      No stock available for {fuelType}
                                    </div>
                                  )}
                                </FormItem>
                              );
                            }}
                          />
                        </div>

                        {/* Sale */}
                        <div className="col-span-1 sm:col-span-2">
                          <FormField
                            control={form.control}
                            name={`rows.${idx}.sale`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    disabled
                                    type="text"
                                    placeholder="sale"
                                    value={field.value != null ? Number(field.value).toFixed(2) : ""}
                                    onChange={(e) =>
                                      field.onChange(
                                        e.target.value === "" ? undefined : Number(e.target.value)
                                      )
                                    }
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Price */}
                        <div className="col-span-1 sm:col-span-2">
                          <FormField
                            control={form.control}
                            name={`rows.${idx}.fuelRate`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    disabled
                                    type="text"
                                    placeholder="price/unit"
                                    value={field.value ?? ""}
                                    onChange={(e) =>
                                      field.onChange(
                                        e.target.value === "" ? undefined : Number(e.target.value)
                                      )
                                    }
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>

                        {/* Total */}
                        <div className="col-span-1 sm:col-span-4">
                          <FormField
                            control={form.control}
                            name={`rows.${idx}.totalAmount`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="total amount"
                                    value={field.value != null ? Number(field.value).toFixed(2) : ""}
                                    className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onChange={(e) =>
                                      field.onChange(
                                        e.target.value === "" ? undefined : Number(e.target.value)
                                      )
                                    }
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="flex justify-end pr-4 gap-10">
              {/* Dynamic Fuel Types Summary - Based on branch fuel products */}
              {(() => {
                const rows = form.watch("rows") ?? [];
                
                // Only show totals for fuel products that exist in the branch's Product table
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const branchFuelProductNames = branchFuelProducts.map((p: any) => p.productName);
                
                // Color mapping for different fuel types
                const fuelTypeColorMap: Record<string, string> = {
                  "HSD-DIESEL": "text-blue-900",
                  "XG-DIESEL": "text-blue-700",
                  "MS-PETROL": "text-green-900",
                  "POWER PETROL": "text-orange-700",
                  "XP 95 PETROL": "text-orange-700",
                };
                
                const defaultColor = "text-gray-900";
                
                // Only show totals for fuel products that exist in the branch
                return branchFuelProductNames.map((fuelProductName: string) => {
                  // Find rows that match this fuel product name (case-insensitive)
                  const filteredRows = rows.filter(r => {
                    const rowFuelType = (r.fuelType || "").trim();
                    const productName = fuelProductName.trim();
                    return rowFuelType.toUpperCase() === productName.toUpperCase();
                  });
                  
                  const totalSale = filteredRows
                    .map(r => r.sale ?? 0)
                    .reduce((sum, item) => sum + Number(item || 0), 0);
                  const totalAmount = filteredRows
                    .map(r => r.totalAmount ?? 0)
                    .reduce((sum, item) => sum + Number(item || 0), 0);
                  
                  const textColor = fuelTypeColorMap[fuelProductName] || defaultColor;
                  
                  return (
                    <div key={fuelProductName} className="text-right space-y-1">
                      <div className="text-muted-foreground text-sm">{fuelProductName}:</div>
                      <div className="text-base text-gray-600">
                        Sale: {totalSale.toFixed(2)} L
                      </div>
                      <div className={`text-xl font-semibold ${textColor}`}>
                        ₹{" "}
                        {Math.round(totalAmount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  );
                });
              })()}

              {/* Grand Total */}
              <div className="text-right space-y-1">
                <div className="text-muted-foreground text-sm">Total Sale:</div>
                <div className="text-base font-medium">
                  {(form.watch("rows") ?? [])
                    .map(r => r.sale ?? 0)
                    .reduce((sum, item) => sum + Number(item || 0), 0)
                    .toFixed(2)}{" "}
                  L
                </div>
                <div className="text-xl font-semibold">
                  ₹{" "}
                  {Math.round(
                    (form.watch("rows") ?? [])
                      .map(r => r.totalAmount ?? 0)
                      .reduce((sum, item) => sum + Number(item || 0), 0)
                  ).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>

          </form>
          )}

          {/* Footer with Stock Display and Complete Button */}
          {!isPumpClosed && (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4 border-t">
            {/* Current Stock Display - Bottom Left */}
            <div className="p-3 bg-muted/50 rounded-lg border w-full sm:w-auto">
              <div className="text-sm font-semibold mb-2">Current Stock Levels</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {branchFuelProducts.map((product) => {
                  const fuelType = product.productName;
                  const currentStock = getCurrentStock(fuelType);
                  const rows = form.watch('rows');
                  const totalSale = rows
                    .filter(r => r.fuelType === fuelType && r.sale != null)
                    .reduce((sum, r) => sum + (r.sale || 0), 0);
                  const remainingStock = currentStock - totalSale;
                  
                return (
                    <div key={fuelType} className="text-xs">
                      <div className="font-medium">{fuelType}:</div>
                      <div className={`${remainingStock < 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                        {remainingStock.toFixed(2)}L
                        </div>
                    </div>
                  );
                })}
                    </div>
                  </div>

            {/* Complete Button - Bottom Right */}
            <div className="w-full sm:w-auto">
            <Button 
              type="button" 
              variant="outline"
              onClick={markCurrentStepCompleted}
                className="w-full sm:w-auto"
            >
              Complete
            </Button>
            </div>
          </div>
          )}
        </CardContent>
      </Card>
    </FormProvider>
  );
};
