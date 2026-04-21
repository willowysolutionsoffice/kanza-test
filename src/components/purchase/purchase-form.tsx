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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DialogClose } from "@/components/ui/dialog";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { purchaseSchema } from "@/schemas/purchase-schema";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { Purchase } from "@prisma/client";
import { useRouter } from "next/navigation";
import { BranchSelector } from "@/components/common/branch-selector";

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

export function PurchaseFormModal({
  purchase,
  // open,
  // openChange,
  userRole,
  canEdit,
  userBranchId,
}: {
  purchase?: Purchase;
  open?: boolean;
  openChange?: (open: boolean) => void;
  userRole?: string;
  canEdit?: boolean;
  userBranchId?: string;
}) {
  const [supplierOptions, setSupplierOptions] = useState<
    { name: string; id: string; phone: string }[]
  >([]);
  const [productOption, setProductOptions] = useState<
    {
      productName: string;
      id: string;
      purchasePrice: number;
      sellingPrice: number;
      productUnit: string;
      branchId: string | null;
    }[]
  >([]);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    purchase?.branchId || userBranchId || "",
  );
  const closeRef = useRef<HTMLButtonElement>(null);

  const router = useRouter();

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      supplierId: purchase?.supplierId || "",
      productType: purchase?.productType || "",
      quantity: purchase?.quantity || undefined,
      date: purchase?.date || new Date(),
      purchasePrice: purchase?.purchasePrice || undefined,
      paidAmount: purchase?.paidAmount || undefined,
      branchId: purchase?.branchId ?? undefined,
    },
  });

  const quantity = useWatch({ control: form.control, name: "quantity" });
  const productType = useWatch({ control: form.control, name: "productType" });

  const handleSubmit = async (
    values: PurchaseFormValues,
  ) => {
    try {
      const url = purchase
        ? `/api/purchases/${purchase.id}`
        : `/api/purchases/create`;

      const method = purchase ? "PATCH" : "POST";

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
        toast.error(error || "Failed to save purchase");
        return;
      }

      toast.success(
        purchase
          ? "Purchase updated successfully"
          : "Purchase created successfully",
      );
      close();
      closeRef.current?.click();
      router.refresh();
    } catch (error) {
      console.error("Something went wrong:", error);
      toast.error("Something went wrong while saving purchase");
    }
  };

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch("/api/suppliers");
        const json = await res.json();
        setSupplierOptions(json.data || []);
      } catch (error) {
        console.error("Failed to fetch suppliers", error);
      }
    };

    fetchSuppliers();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch("/api/products");
        const json = await res.json();

        setProductOptions(json.data || []);
      } catch (error) {
        console.error("Failed to fetch products", error);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    const quantity = form.watch("quantity") || 0;
    const selectedProductName = form.watch("productType");

    // Find product for the selected branch
    const selectedProduct = productOption.find(
      (p) =>
        p.productName === selectedProductName &&
        p.branchId === selectedBranchId,
    );

    const sellingPrice = selectedProduct?.sellingPrice ?? 0;
    const purchasePrice = selectedProduct?.purchasePrice ?? 0;

    form.setValue("purchasePrice", quantity * purchasePrice);

    setSellingPrice(sellingPrice);
    setPurchasePrice(purchasePrice);
  }, [quantity, productType, selectedBranchId, productOption, form]);

  // Clear product selection when branch changes
  useEffect(() => {
    if (selectedBranchId) {
      form.setValue("productType", "");
      setSellingPrice(0);
      setPurchasePrice(0);
      form.setValue("purchasePrice", 0);
    }
  }, [selectedBranchId, form]);

  return (
    <FormDialog
      // open={open}
      // openChange={openChange}
      form={form}
      onSubmit={(values) => handleSubmit(values)}
    >
      <DialogClose asChild>
  <button ref={closeRef} className="hidden" />
</DialogClose>

      <FormDialogTrigger asChild>
        <Button>
          {purchase ? (
            <Pencil className="mr-2 size-4" />
          ) : (
            <Plus className="mr-2 size-4" />
          )}
          {purchase ? "Edit Purchase" : "New Purchase"}
        </Button>
      </FormDialogTrigger>

      <FormDialogContent className="sm:max-w-md">
        <FormDialogHeader>
          <FormDialogTitle>
            {purchase ? "Edit Purchase" : "Create Purchase"}
          </FormDialogTitle>
          <FormDialogDescription>
            {purchase
              ? "Update an existing purchase order"
              : "Place a new order for fuel or inventory items."}
          </FormDialogDescription>
        </FormDialogHeader>

        <div className="flex gap-10">
          <p className="text-sm font-medium text-green-500">
            {sellingPrice > 0 && `Selling Price: ₹${sellingPrice}`}{" "}
          </p>
          <p className="text-sm font-medium text-red-500">
            {purchasePrice > 0 && `Purchase Price: ₹${purchasePrice}`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="supplierId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Supplier" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {supplierOptions.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <BranchSelector
            value={selectedBranchId}
            onValueChange={setSelectedBranchId}
            userRole={userRole}
            userBranchId={userBranchId}
            isEditMode={!!purchase}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Number (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="+91 XXXXX XXXXX" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="productType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fuel Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select fuel type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {productOption
                      .filter(
                        (product) => product.branchId === selectedBranchId,
                      )
                      .map((product) => (
                        <SelectItem
                          key={product.id}
                          value={product.productName}
                        >
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
                    onChange={(e) => {
                      const quantity =
                        e.target.value === ""
                          ? undefined
                          : Number(e.target.value);
                      field.onChange(quantity);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
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
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="purchasePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purchase Total</FormLabel>
                <FormControl>
                  <Input type="number" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="paidAmount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Paid Amount</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="000.00"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
            ) : purchase ? (
              "Update"
            ) : (
              "Save"
            )}
          </Button>
        </FormDialogFooter>
      </FormDialogContent>
    </FormDialog>
  );
}
