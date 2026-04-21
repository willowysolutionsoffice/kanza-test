"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DialogClose } from "@/components/ui/dialog";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Oil } from "@prisma/client";
import { useRouter } from "next/navigation";
import { oilSchema } from "@/schemas/oil-schema";
import { useEffect, useState } from "react";
import { BranchSelector } from "@/components/common/branch-selector";
import { useNextAllowedDate } from "@/hooks/use-next-allowed-date";


type OilFormValues = z.infer<typeof oilSchema>;

export function OilFormModal({
  oil,
  open,
  openChange,
  branchId,
  userRole,
  userBranchId,
  wizardDate,
  canEdit,
}: {
  oil?: Oil;
  open?: boolean;
  openChange?: (open: boolean) => void;
  branchId?: string;
  userRole?: string;
  userBranchId?: string;
  wizardDate?: Date;
  canEdit?: boolean;
}) {
    const [productOption, setProductOptions] = useState<{ 
      productName: string;
      id: string;
      purchasePrice:number;
      sellingPrice:number;
      productUnit:string;
      branchId: string | null;
    }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(oil?.branchId || branchId || userBranchId || "");

  const router = useRouter();

  // Get next allowed date for branch managers
  // - Restricted for branch users when creating a new oil entry (non-wizard)
  // - Not restricted in wizard mode (wizardDate) or when editing existing oil entry
  const { nextAllowedDate, isDateRestricted } = useNextAllowedDate({
    userRole,
    branchId: selectedBranchId,
    isEditMode: !!oil || !!wizardDate,
  });

  const form = useForm<OilFormValues>({
    resolver: zodResolver(oilSchema),
    defaultValues: {
      date: oil?.date ? new Date(oil.date) : new Date(),
      productType: oil?.productType || "",
      quantity: oil?.quantity || undefined,
      price: oil?.price || undefined,
    },
  });

  // Update date when nextAllowedDate is available for branch managers
  useEffect(() => {
    const isOpen = open ?? true;
    if (isOpen && isDateRestricted && nextAllowedDate && !oil && !wizardDate) {
      const current = form.getValues();
      form.reset({ ...current, date: nextAllowedDate });
    }
  }, [open, isDateRestricted, nextAllowedDate, oil, wizardDate, form]);

    const quantity = useWatch({ control: form.control, name: "quantity" });
    const oilType = useWatch({ control: form.control, name: "productType" });

  const handleSubmit = async (values: OilFormValues, close: () => void) => {
    try {
      const url = oil ? `/api/oils/${oil.id}` : `/api/oils/create`;
      const method = oil ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          branchId: selectedBranchId,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error || "Failed to save oil entry");
        return;
      }

      toast.success(oil ? "Oil entry updated successfully" : "Oil entry created successfully");
      close();
      router.refresh();
    } catch (error) {
      console.error("Something went wrong:", error);
      toast.error("Something went wrong while saving oil entry");
    }
  };

    useEffect(() => {
    const quantity = form.watch("quantity") || 0;
    const selectedProductName = form.watch("productType"); 

    if (!selectedProductName) return;

    const selectedProduct = productOption.find(
        (p) => p.productName === selectedProductName
    );

    if (selectedProduct) {
        // auto calculate based on purchasePrice
        const autoPrice = quantity * selectedProduct.sellingPrice;
        form.setValue("price", Math.round(autoPrice) || 0);
    }
    }, [quantity, oilType, productOption,form]);


  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products");
        const json = await res.json();
        
        // Filter products by branch and exclude fuel products
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const filteredProducts = json.data?.filter((product: any) => {
          // Filter by branch if selectedBranchId is provided
          const branchMatch = selectedBranchId ? product.branchId === selectedBranchId : true;
          // Exclude fuel products
          const notFuelProduct = !["HSD-DIESEL", "MS-PETROL", "XG-DIESEL"].includes(product.productName);
          return branchMatch && notFuelProduct;
        }) || [];
        
        // Deduplicate products by name, keeping the first occurrence
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uniqueProducts = filteredProducts.reduce((acc: any[], product: any) => {
          const existingProduct = acc.find(p => p.productName === product.productName);
          if (!existingProduct) {
            acc.push(product);
          }
          return acc;
        }, []);
        
        setProductOptions(uniqueProducts);
      } catch (error) {
        console.error("Failed to fetch products", error);
      }
    };
  
    fetchProducts();
    }, [selectedBranchId]);

  // Clear product selection when branch changes
  useEffect(() => {
    if (selectedBranchId) {
      form.setValue("productType", "");
      form.setValue("price", 0);
    }
  }, [selectedBranchId, form]);

  return (
    <FormDialog
      open={open}
      openChange={openChange}
      form={form}
      onSubmit={(values) => handleSubmit(values, () => openChange?.(false))}
    >
      <FormDialogTrigger asChild>
        <Button>
          {oil ? <Pencil className="size-4 mr-2" /> : <Plus className="size-4 mr-2" />}
          {oil ? "Edit Oil Entry" : "New Oil Entry"}
        </Button>
      </FormDialogTrigger>

      <FormDialogContent className="sm:max-w-md">
        <FormDialogHeader>
          <FormDialogTitle>{oil ? "Edit Oil Entry" : "Create Oil Entry"}</FormDialogTitle>
          <FormDialogDescription>
            {oil ? "Update an existing oil record" : "Log a new oil entry."}
          </FormDialogDescription>
        </FormDialogHeader>

        <BranchSelector
          value={selectedBranchId}
          onValueChange={setSelectedBranchId}
          userRole={userRole}
          userBranchId={userBranchId}
          isEditMode={!!oil}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="productType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Oil or Gas type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {productOption.map((product) => (
                      <SelectItem key={product.id} value={product.productName}>
                        {product.productName}
                      </SelectItem>
                    ))}
                  </SelectContent>


                </Select>
                <FormMessage />
              </FormItem>
            )}
          />


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
                          onSelect={(val) => field.onChange(val ?? new Date())}
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

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Liters/Units"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="000.00"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormDialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              oil ? "Update" : "Save"
            )}
          </Button>
        </FormDialogFooter>
      </FormDialogContent>
    </FormDialog>
  );
}
