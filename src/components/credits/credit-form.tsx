"use client";

import {
  DialogClose,
} from "@/components/ui/dialog";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  FormDialog,
  FormDialogContent,
  FormDialogDescription,
  FormDialogFooter,
  FormDialogHeader,
  FormDialogTitle,
  FormDialogTrigger,
} from "@/components/ui/form-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { Credit } from "@prisma/client";
import { useRouter } from "next/navigation";
import { creditSchema } from "@/schemas/credit-schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { BranchSelector } from "@/components/common/branch-selector";
import { useNextAllowedDate } from "@/hooks/use-next-allowed-date";


export function CreditFormDialog({
  credits,
  open,
  openChange,
  branchId,
  userRole,
  canEdit,
  userBranchId,
}: {
  credits?: Credit;
  open?: boolean;
  openChange?: (open: boolean) => void;
  branchId?: string;
  userRole?: string;
  canEdit?: boolean;
  userBranchId?: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerOption, setCustomerOptions] = useState<{ id: string; name: string; openingBalance: number; outstandingPayments:number; limit?: number; }[]>([]);
  const [products, setProducts] = useState<{id:string; productName :string; productUnit: string; purchasePrice: number; sellingPrice: number; }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(credits?.branchId || branchId || userBranchId || "");
  const [customerSearch, setCustomerSearch] = useState("");
  const router = useRouter();

  // Get next allowed date for branch managers
  const { nextAllowedDate, isDateRestricted } = useNextAllowedDate({
    userRole,
    branchId: selectedBranchId,
    isEditMode: !!credits,
  });

  const form = useForm<z.infer<typeof creditSchema>>({
    resolver: zodResolver(creditSchema),
    defaultValues: {
      customerId: credits?.customerId || "",
      fuelType:credits?.fuelType || "",
      quantity:credits?.quantity || undefined,
      amount: credits?.amount || undefined,
      date: credits?.date ? new Date(credits.date) : new Date(),
      reason: (credits as { reason?: string })?.reason || "",
    },
  });

  // Update date when nextAllowedDate is available for branch managers
  useEffect(() => {
    const isOpen = open ?? true;
    if (isOpen && isDateRestricted && nextAllowedDate && !credits) {
      const current = form.getValues();
      form.reset({ ...current, date: nextAllowedDate });
    }
  }, [open, isDateRestricted, nextAllowedDate, credits, form, selectedBranchId]);

  // 🔑 Watch fields
  const selectedCustomerId = form.watch("customerId");
  const enteredAmount = form.watch("amount") ?? 0;

  // Find selected customer
  const selectedCustomer = customerOption.find(
    (c) => c.id === selectedCustomerId
  );

  // Calculate new balance for display
  const displayBalance =
    (selectedCustomer?.outstandingPayments ?? 0) + Number(enteredAmount || 0);

  // Check if outstanding + entered amount exceeds customer limit
  const exceedsLimit = selectedCustomer?.limit && displayBalance > selectedCustomer.limit;

  const handleSubmit = async (
    values: z.infer<typeof creditSchema>,
    close: () => void
  ) => {
    // Validate reason when limit is exceeded
    if (exceedsLimit && (!values.reason || values.reason.trim() === "")) {
      toast.error("Reason is required when outstanding + credit amount exceeds customer limit");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = credits
        ? `${baseUrl}/api/credits/${credits.id}`
        : `${baseUrl}/api/credits/create`;

      const method = credits ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          branchId: selectedBranchId,
        }),
      });

      const response = await res.json();

      if (!res.ok) {
        toast.error(response.error || "Failed to save credits");
        return;
      }

      toast.success(
        credits ? "credits updated successfully" : "credits created successfully"
      );
      close();
      router.refresh();
    } catch (error) {
      console.error("Error saving credits:", error);
      toast.error("Unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inside your component

  // Watch fuelType and quantity
  const selectedFuelType = form.watch("fuelType");
  const enteredQuantity = form.watch("quantity") ?? 0;

  // Find selected product
  const selectedProduct = products.find(
    (p) => p.productName === selectedFuelType
  );

  // Auto-calculate amount when quantity or fuel changes
  useEffect(() => {
    if (selectedProduct && enteredQuantity) {
      form.setValue("amount", enteredQuantity * selectedProduct.sellingPrice);
    }
  }, [enteredQuantity, selectedFuelType, selectedProduct, form]);


  // Search-based customer fetching
  const fetchCustomers = useCallback(async (searchTerm: string = "") => {
    try {
      const params = new URLSearchParams({
        limit: '100', // Increased limit to fetch more customers
        search: searchTerm
      });
      
      if (selectedBranchId) {
        params.append('branchId', selectedBranchId);
      }
      
      const res = await fetch(`/api/customers?${params.toString()}`);
      const json = await res.json();
      
      return json.data?.map((customer: { id: string; name: string; openingBalance: number; outstandingPayments: number; limit?: number }) => ({
        id: customer.id,
        name: customer.name,
        openingBalance: customer.openingBalance || 0,
        outstandingPayments: customer.outstandingPayments || 0,
        limit: customer.limit
      })) || [];
    } catch (error) {
      console.error("Failed to fetch customers", error);
      return [];
    }
  }, [selectedBranchId]);

  // Load customers when search term changes
  useEffect(() => {
    const loadCustomers = async () => {
      const customers = await fetchCustomers(customerSearch);
      setCustomerOptions(customers);
    };
    
    loadCustomers();
  }, [selectedBranchId, customerSearch, fetchCustomers]);

   // Fetch products - filtered by selected branch (both FUEL and OTHER products)
    useEffect(() => {
      const fetchProducts = async () => {
        if (!selectedBranchId) {
          setProducts([]);
          return;
        }

        try {
          const res = await fetch("/api/products");
          const json = await res.json();
          
          // Filter products: only products for the selected branch (both FUEL and OTHER)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const branchProducts = json.data?.filter((product: any) => {
            return product.branchId === selectedBranchId;
          }) || [];
          
          // Deduplicate products by name, keeping the first occurrence
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const uniqueProducts = branchProducts.reduce((acc: any[], product: any) => {
            const existingProduct = acc.find(p => p.productName === product.productName);
            if (!existingProduct) {
              acc.push(product);
            }
            return acc;
          }, []);
          
          setProducts(uniqueProducts);
        } catch (error) {
          console.error("Failed to fetch products", error);
          setProducts([]);
        }
      };
  
      fetchProducts();
    }, [selectedBranchId]);
  

  return (
    <FormDialog
      open={open}
      openChange={openChange}
      form={form}
      onSubmit={(values) => handleSubmit(values, () => openChange?.(false))}
    >
      <FormDialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          {credits ? "Edit Credits" : "New Credits"}
        </Button>
      </FormDialogTrigger>

      <FormDialogContent className="sm:max-w-sm">
        <FormDialogHeader>
          <FormDialogTitle>
            {credits ? "Edit Credits" : "New Credits"}
          </FormDialogTitle>
          <FormDialogDescription>
            {credits
              ? "Update credits details. Click save when you're done."
              : "Fill out the credits details. Click save when you're done."}
          </FormDialogDescription>
        </FormDialogHeader>

        {/* Branch Selector */}
        <BranchSelector
          value={selectedBranchId}
          onValueChange={setSelectedBranchId}
          userRole={userRole}
          userBranchId={userBranchId}
          isEditMode={!!credits}
        />

        {/* Customer Search */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Search Customer</label>
          <Input
            placeholder="Type to search customers..."
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Customer Select */}
        <FormField
          control={form.control}
          name="customerId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Customer" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {customerOption.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Show calculated balance */}
                {selectedCustomer && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Outstanding :{" "}
                    <span className="font-medium">{displayBalance}</span>
                  </p>
                )}
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4 mt-4">
         <FormField
            control={form.control}
            name="fuelType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fuel Type</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  value={field.value}
                  disabled={!selectedBranchId || products.length === 0}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={
                        !selectedBranchId 
                          ? "Select branch first" 
                          : products.length === 0 
                            ? "No products available" 
                            : "Select Fuel Type"
                      } />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {products.length > 0 ? (
                      products.map((p) => (
                        <SelectItem key={p.id} value={p.productName}>
                          {p.productName}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-products" disabled>
                        No products found for this branch
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {!selectedBranchId && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Please select a branch first
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />


          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity (optional)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="0.00"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

        </div>


        <div className="grid grid-cols-2 gap-4 mt-4">
          {/* Amount */}
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="0.00"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
                
              </FormItem>
            )}
          />

          {/* Date */}
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  {isDateRestricted ? (
                    <Button
                      variant="outline"
                      disabled
                      className="w-full text-left bg-muted cursor-not-allowed"
                    >
                      {field.value
                        ? new Date(field.value).toLocaleDateString()
                        : "Pick date"}
                    </Button>
                  ) : (
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className="w-full text-left">
                            {field.value
                              ? new Date(field.value).toLocaleDateString()
                              : "Pick date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent>
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={field.onChange}
                          captionLayout="dropdown"
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Reason field - only show when credit amount exceeds limit */}
        {exceedsLimit && (
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason (Required - Outstanding + Credit exceeds limit)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter reason for exceeding customer limit"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormDialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              credits ? "Update" : "Save"
            )}
          </Button>
        </FormDialogFooter>
      </FormDialogContent>
    </FormDialog>
  );
}
