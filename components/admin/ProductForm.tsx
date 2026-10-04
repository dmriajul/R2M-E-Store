"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CirclePlus, ImagePlus, Shapes, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn, formatPrice, slugify } from "@/lib/utils";
import { CATEGORY_META, COLOR_HEX, DEFAULT_SWATCH } from "@/lib/site";
import { PRODUCT_BADGE_CHOICES } from "@/lib/mock-admin";
import {
  AGE_OPTIONS,
  PRODUCT_CATEGORY_NAMES,
  PRODUCT_GENDERS,
  PRODUCT_SIZE_OPTIONS,
  adminProductSchema,
  type AdminProductFormInput,
  type AdminProductValues,
} from "@/lib/validations";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  AdminField,
  FormSection,
  adminButtonBlue,
  adminButtonGhost,
  adminInputClass,
  adminSelectClass,
} from "@/components/admin/Field";
import { useAdminStore } from "@/store/useAdminStore";
import type { AdminProduct } from "@/types";

/** New products start at 10; existing records keep their own threshold. */
const NEW_PRODUCT_THRESHOLD = 10;
const MAX_IMAGES = 5;
type AgeOption = (typeof AGE_OPTIONS)[number];

/** "2-4Y" / "One Size" → [min, max] that always sits inside the age dropdowns. */
function parseAgeRange(range: string): [AgeOption, AgeOption] {
  const numbers = range.match(/\d+/g)?.map(Number) ?? [];
  const min = numbers[0] ?? 3;
  const max = numbers[1] ?? min;
  const clamp = (value: number): AgeOption => {
    const bounded = Math.min(14, Math.max(0, value));
    return String(bounded) as AgeOption;
  };
  return [clamp(min), clamp(Math.max(min, max))];
}

function emptyValues(): AdminProductFormInput {
  return {
    name: "",
    description: "",
    category: "Dresses",
    gender: "Girls",
    ageMin: "3",
    ageMax: "8",
    price: 0,
    compareAtPrice: undefined,
    costPerItem: undefined,
    sku: "LL-NEW-001",
    stock: 0,
    lowStockThreshold: NEW_PRODUCT_THRESHOLD,
    trackInventory: true,
    colors: [{ name: "Pink", hex: COLOR_HEX.Pink ?? DEFAULT_SWATCH }],
    sizes: ["4T", "5"],
    images: [],
    modelUrl: "",
    metaTitle: "",
    metaDescription: "",
    slug: "",
    active: true,
    featured: false,
    badge: "none",
  };
}

function valuesFor(product: AdminProduct): AdminProductFormInput {
  const [ageMin, ageMax] = parseAgeRange(product.ageRange);
  return {
    name: product.name,
    description: product.description,
    category: product.category,
    gender: product.gender,
    ageMin,
    ageMax,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    costPerItem: product.costPerItem,
    sku: product.sku,
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
    trackInventory: product.trackInventory,
    colors: product.colors.map((name) => ({
      name,
      hex: COLOR_HEX[name] ?? DEFAULT_SWATCH,
    })),
    sizes: product.sizes.filter((size): size is (typeof PRODUCT_SIZE_OPTIONS)[number] =>
      PRODUCT_SIZE_OPTIONS.includes(size as (typeof PRODUCT_SIZE_OPTIONS)[number]),
    ),
    images: [...product.images],
    modelUrl: product.modelUrl ?? "",
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    slug: product.slug,
    active: product.status === "active",
    featured: product.featured,
    badge: product.badge ?? "none",
  };
}

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null (or undefined) opens a blank "add product" form. */
  product?: AdminProduct | null;
}

/**
 * Add / edit sheet. A real shop would upload to storage — here the media zones
 * write placeholder tokens, which is why the same sheet can run without a
 * backend.
 */
export function ProductForm({ open, onOpenChange, product = null }: ProductFormProps) {
  const saveProduct = useAdminStore((state) => state.saveProduct);
  const [slugTouched, setSlugTouched] = useState(false);
  const [skuTouched, setSkuTouched] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AdminProductFormInput, unknown, AdminProductValues>({
    resolver: zodResolver(adminProductSchema),
    defaultValues: emptyValues(),
  });

  const { fields: colorFields, append: appendColor, remove: removeColor } = useFieldArray({
    control,
    name: "colors",
  });

  const name = watch("name");
  const slug = watch("slug");
  const sizes = watch("sizes") ?? [];
  const images = watch("images") ?? [];
  const modelUrl = watch("modelUrl") ?? "";
  const category = watch("category");
  const active = watch("active");
  const featured = watch("featured");
  const trackInventory = watch("trackInventory");

  /* Reload the form whenever the sheet opens for a different record. */
  useEffect(() => {
    if (!open) return;
    reset(product ? valuesFor(product) : emptyValues());
    setSlugTouched(Boolean(product));
    setSkuTouched(Boolean(product));
  }, [open, product, reset]);

  /* Slug + SKU follow the name until the admin edits them by hand. */
  useEffect(() => {
    if (!open || slugTouched) return;
    const generated = slugify(name ?? "");
    setValue("slug", generated, { shouldValidate: false });
  }, [name, open, slugTouched, setValue]);

  useEffect(() => {
    if (!open || skuTouched) return;
    const stem = slugify(name ?? "")
      .replace(/[^a-z]/g, "")
      .slice(0, 3)
      .toUpperCase();
    setValue("sku", `LL-${stem || "NEW"}-001`, { shouldValidate: false });
  }, [name, open, skuTouched, setValue]);

  const toggleSize = (size: (typeof PRODUCT_SIZE_OPTIONS)[number]) => {
    const next = sizes.includes(size) ? sizes.filter((entry) => entry !== size) : [...sizes, size];
    setValue("sizes", next, { shouldValidate: true, shouldDirty: true });
  };

  const addImage = () => {
    if (images.length >= MAX_IMAGES) {
      toast.error(`Max ${MAX_IMAGES} images per product`);
      return;
    }
    const stem = slugify(slug || name || "product") || "product";
    setValue("images", [...images, `${stem}-${images.length + 1}`], { shouldDirty: true });
  };

  const removeImage = (index: number) => {
    setValue(
      "images",
      images.filter((_, position) => position !== index),
      { shouldDirty: true },
    );
  };

  const onSubmit = handleSubmit((values) => {
    const id = saveProduct(values, product?.id);
    toast.success("Product saved! ✅", {
      description: product ? `${values.name} updated.` : `${values.name} added as ${id}.`,
    });
    onOpenChange(false);
  });

  const categoryEmoji = CATEGORY_META[category].emoji;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full border-l border-[#242424] bg-[#141414] p-0 sm:max-w-none sm:w-[60%]"
      >
        <SheetHeader className="flex-row items-start justify-between gap-3 border-b border-[#242424] px-6 py-4">
          <div>
            <SheetTitle className="text-sm font-semibold text-foreground">
              {product ? "Edit product" : "Add product"}
            </SheetTitle>
            <SheetDescription className="mt-1 text-xs text-muted-foreground">
              {product
                ? `Editing ${product.name} · ${product.sku}`
                : "Fill in the details — everything is saved locally for the demo."}
            </SheetDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close product form"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-[#3A3A3A] hover:text-foreground focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
          >
            <X aria-hidden className="size-4" />
          </button>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-6">
              {/* ---------- Basic info ---------- */}
              <FormSection title="Basic info">
                <AdminField
                  label="Product name"
                  htmlFor="product-name"
                  error={errors.name?.message}
                  className="sm:col-span-2"
                >
                  <input
                    id="product-name"
                    {...register("name")}
                    aria-invalid={Boolean(errors.name)}
                    placeholder="Rainbow Tutu Skirt"
                    className={adminInputClass}
                  />
                </AdminField>

                <AdminField
                  label="Description"
                  htmlFor="product-description"
                  error={errors.description?.message}
                  className="sm:col-span-2"
                >
                  <textarea
                    id="product-description"
                    rows={3}
                    {...register("description")}
                    aria-invalid={Boolean(errors.description)}
                    placeholder="Soft tulle layers with an elasticated waist…"
                    className={cn(adminInputClass, "h-auto resize-y py-2 leading-relaxed")}
                  />
                </AdminField>

                <AdminField
                  label="Category"
                  htmlFor="product-category"
                  error={errors.category?.message}
                >
                  <select
                    id="product-category"
                    {...register("category")}
                    aria-invalid={Boolean(errors.category)}
                    className={adminSelectClass}
                  >
                    {PRODUCT_CATEGORY_NAMES.map((name) => (
                      <option key={name} value={name}>
                        {CATEGORY_META[name].emoji} {name}
                      </option>
                    ))}
                  </select>
                </AdminField>

                <fieldset className="flex flex-col gap-1.5">
                  <legend className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    Gender
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {PRODUCT_GENDERS.map((gender) => (
                      <label
                        key={gender}
                        className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-xs text-foreground transition-colors duration-200 hover:border-[#3A3A3A] has-checked:border-blue-500/60 has-checked:bg-blue-500/12"
                      >
                        <input
                          type="radio"
                          value={gender}
                          {...register("gender")}
                          className="size-3.5 accent-blue-500"
                        />
                        {gender}
                      </label>
                    ))}
                  </div>
                  {errors.gender && (
                    <p role="alert" className="text-[11px] text-rose">
                      {errors.gender.message}
                    </p>
                  )}
                </fieldset>

                <div className="grid grid-cols-2 gap-4">
                  <AdminField label="Age min" htmlFor="product-age-min">
                    <select
                      id="product-age-min"
                      {...register("ageMin")}
                      className={adminSelectClass}
                    >
                      {AGE_OPTIONS.map((age) => (
                        <option key={age} value={age}>
                          {age}Y
                        </option>
                      ))}
                    </select>
                  </AdminField>
                  <AdminField
                    label="Age max"
                    htmlFor="product-age-max"
                    error={errors.ageMax?.message}
                  >
                    <select
                      id="product-age-max"
                      {...register("ageMax")}
                      aria-invalid={Boolean(errors.ageMax)}
                      className={adminSelectClass}
                    >
                      {AGE_OPTIONS.map((age) => (
                        <option key={age} value={age}>
                          {age}Y
                        </option>
                      ))}
                    </select>
                  </AdminField>
                </div>
              </FormSection>

              {/* ---------- Pricing ---------- */}
              <FormSection title="Pricing">
                <AdminField label="Price (USD)" htmlFor="product-price" error={errors.price?.message}>
                  <input
                    id="product-price"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("price")}
                    aria-invalid={Boolean(errors.price)}
                    className={adminInputClass}
                  />
                </AdminField>

                <AdminField
                  label="Compare-at price"
                  htmlFor="product-compare"
                  hint="Optional — shows a strike-through."
                  error={errors.compareAtPrice?.message}
                >
                  <input
                    id="product-compare"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("compareAtPrice")}
                    aria-invalid={Boolean(errors.compareAtPrice)}
                    className={adminInputClass}
                  />
                </AdminField>

                <AdminField
                  label="Cost per item"
                  htmlFor="product-cost"
                  hint="Used for the margin column later."
                  error={errors.costPerItem?.message}
                >
                  <input
                    id="product-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("costPerItem")}
                    aria-invalid={Boolean(errors.costPerItem)}
                    className={adminInputClass}
                  />
                </AdminField>

                <div className="flex items-end pb-1 text-xs text-muted-foreground">
                  Margin preview:{" "}
                  <span className="ml-1.5 font-medium text-foreground tabular-nums">
                    {watch("costPerItem") && watch("price")
                      ? formatPrice(Number(watch("price")) - Number(watch("costPerItem")))
                      : "—"}
                  </span>
                </div>
              </FormSection>

              {/* ---------- Inventory ---------- */}
              <FormSection title="Inventory">
                <AdminField
                  label="SKU"
                  htmlFor="product-sku"
                  hint="Auto-generated, editable."
                  error={errors.sku?.message}
                >
                  <input
                    id="product-sku"
                    {...register("sku", { onChange: () => setSkuTouched(true) })}
                    aria-invalid={Boolean(errors.sku)}
                    className={cn(adminInputClass, "font-mono text-xs")}
                  />
                </AdminField>

                <AdminField
                  label="Stock on hand"
                  htmlFor="product-stock"
                  error={errors.stock?.message}
                >
                  <input
                    id="product-stock"
                    type="number"
                    min="0"
                    step="1"
                    {...register("stock")}
                    aria-invalid={Boolean(errors.stock)}
                    className={adminInputClass}
                  />
                </AdminField>

                <AdminField
                  label="Low-stock threshold"
                  htmlFor="product-threshold"
                  hint={`Flags the product when stock drops to ${watch("lowStockThreshold") || 0}.`}
                  error={errors.lowStockThreshold?.message}
                >
                  <input
                    id="product-threshold"
                    type="number"
                    min="0"
                    step="1"
                    {...register("lowStockThreshold")}
                    aria-invalid={Boolean(errors.lowStockThreshold)}
                    className={adminInputClass}
                  />
                </AdminField>

                <div className="flex items-end pb-1">
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 text-xs text-foreground">
                    <Switch
                      checked={trackInventory}
                      onCheckedChange={(checked) =>
                        setValue("trackInventory", checked, { shouldDirty: true })
                      }
                      aria-label="Track inventory"
                    />
                    Track inventory
                  </label>
                </div>
              </FormSection>

              {/* ---------- Variants ---------- */}
              <FormSection title="Variants">
                <div className="sm:col-span-2">
                  <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    Colours
                  </p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {colorFields.map((field, index) => (
                      <li key={field.id} className="flex flex-wrap items-center gap-2">
                        <span
                          aria-hidden
                          className="size-8 shrink-0 rounded-lg border border-[#2A2A2A]"
                          style={{ backgroundColor: watch(`colors.${index}.hex`) || DEFAULT_SWATCH }}
                        />
                        <input
                          aria-label={`Colour ${index + 1} name`}
                          {...register(`colors.${index}.name`)}
                          placeholder="Pink"
                          className={cn(adminInputClass, "w-32 flex-1")}
                        />
                        <input
                          type="color"
                          aria-label={`Colour ${index + 1} hex`}
                          {...register(`colors.${index}.hex`)}
                          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-[#2A2A2A] bg-[#151515] p-1"
                        />
                        <button
                          type="button"
                          onClick={() => removeColor(index)}
                          disabled={colorFields.length <= 1}
                          aria-label={`Remove colour ${index + 1}`}
                          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-rose-500/50 hover:text-rose-400 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none disabled:opacity-35"
                        >
                          <Trash2 aria-hidden className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {errors.colors && (
                    <p role="alert" className="mt-1.5 text-[11px] text-rose">
                      {errors.colors.message ?? "Fix the colour rows above"}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => appendColor({ name: "", hex: DEFAULT_SWATCH })}
                    className={cn(adminButtonGhost, "mt-2 min-h-9 px-3")}
                  >
                    <CirclePlus aria-hidden className="size-3.5" />
                    Add colour
                  </button>
                </div>

                <fieldset className="sm:col-span-2">
                  <legend className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    Sizes
                  </legend>
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {PRODUCT_SIZE_OPTIONS.map((size) => {
                      const checked = sizes.includes(size);
                      return (
                        <label
                          key={size}
                          className={cn(
                            "flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-xs transition-colors duration-200 has-focus-visible:ring-2 has-focus-visible:ring-blue-400/40",
                            checked
                              ? "border-blue-500/60 bg-blue-500/12 text-foreground"
                              : "border-[#2A2A2A] bg-[#151515] text-muted-foreground hover:border-[#3A3A3A]",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSize(size)}
                            className="sr-only"
                            aria-label={`Size ${size}`}
                          />
                          {size}
                        </label>
                      );
                    })}
                  </div>
                  {errors.sizes && (
                    <p role="alert" className="mt-1.5 text-[11px] text-rose">
                      {errors.sizes.message}
                    </p>
                  )}
                </fieldset>
              </FormSection>

              {/* ---------- Media ---------- */}
              <FormSection title="Media">
                <div className="sm:col-span-2">
                  <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    {images.map((token, index) => (
                      <li
                        key={token}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-[#2A2A2A] bg-[#101010]"
                      >
                        <span className="grid h-full place-items-center bg-linear-to-br from-blue-500/20 to-violet-500/10 text-2xl">
                          {categoryEmoji}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          aria-label={`Remove image ${index + 1}`}
                          className="absolute top-1 right-1 inline-flex size-7 items-center justify-center rounded-md border border-[#2A2A2A] bg-[#0D0D0D]/85 text-muted-foreground transition-colors duration-200 hover:text-rose-400 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
                        >
                          <X aria-hidden className="size-3" />
                        </button>
                        <span className="absolute inset-x-1 bottom-1 truncate rounded bg-[#0D0D0D]/80 px-1 py-0.5 text-[9px] text-muted-foreground">
                          {token}
                        </span>
                      </li>
                    ))}

                    <li>
                      <button
                        type="button"
                        onClick={addImage}
                        className="flex h-full min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#3A3A3A] bg-[#101010] px-2 py-4 text-[11px] text-muted-foreground transition-colors duration-200 hover:border-blue-500/50 hover:text-blue-300 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
                      >
                        <ImagePlus aria-hidden className="size-4" />
                        Add image
                      </button>
                    </li>
                  </ul>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Max {MAX_IMAGES} images, 2MB each · placeholders are generated for the demo.
                  </p>
                </div>

                <AdminField
                  label="3D model"
                  htmlFor="product-model"
                  hint=".glb files only — leave blank for the gradient viewer."
                  className="sm:col-span-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      id="product-model"
                      {...register("modelUrl")}
                      placeholder="rainbow-tutu.glb"
                      className={cn(adminInputClass, "flex-1 font-mono text-xs")}
                    />
                    {modelUrl ? (
                      <button
                        type="button"
                        onClick={() => setValue("modelUrl", "", { shouldDirty: true })}
                        className={cn(adminButtonGhost, "min-h-10 px-3")}
                      >
                        Clear
                      </button>
                    ) : (
                      <span className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#2A2A2A] px-3 text-[11px] text-muted-foreground">
                        <Shapes aria-hidden className="size-3.5" />
                        No model
                      </span>
                    )}
                  </div>
                  {modelUrl && !modelUrl.toLowerCase().endsWith(".glb") && (
                    <p role="alert" className="mt-1.5 text-[11px] text-amber-400">
                      Only .glb files are supported.
                    </p>
                  )}
                </AdminField>
              </FormSection>

              {/* ---------- SEO ---------- */}
              <FormSection title="SEO">
                <AdminField
                  label="Meta title"
                  htmlFor="product-meta-title"
                  hint={`${(watch("metaTitle") ?? "").length}/70 characters`}
                  error={errors.metaTitle?.message}
                  className="sm:col-span-2"
                >
                  <input
                    id="product-meta-title"
                    {...register("metaTitle")}
                    aria-invalid={Boolean(errors.metaTitle)}
                    placeholder="Rainbow Tutu Skirt | Little Luxe"
                    className={adminInputClass}
                  />
                </AdminField>

                <AdminField
                  label="Meta description"
                  htmlFor="product-meta-description"
                  hint={`${(watch("metaDescription") ?? "").length}/160 characters`}
                  error={errors.metaDescription?.message}
                  className="sm:col-span-2"
                >
                  <textarea
                    id="product-meta-description"
                    rows={2}
                    {...register("metaDescription")}
                    aria-invalid={Boolean(errors.metaDescription)}
                    className={cn(adminInputClass, "h-auto resize-y py-2 leading-relaxed")}
                  />
                </AdminField>

                <AdminField
                  label="Slug"
                  htmlFor="product-slug"
                  hint="Auto-generated from the name, editable."
                  error={errors.slug?.message}
                  className="sm:col-span-2"
                >
                  <input
                    id="product-slug"
                    {...register("slug", { onChange: () => setSlugTouched(true) })}
                    aria-invalid={Boolean(errors.slug)}
                    className={cn(adminInputClass, "font-mono text-xs")}
                  />
                </AdminField>
              </FormSection>

              {/* ---------- Status ---------- */}
              <FormSection title="Status">
                <div className="flex flex-col gap-3">
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-xs text-foreground transition-colors duration-200 hover:border-[#3A3A3A]">
                    <span>
                      Active
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        Visible on the storefront
                      </span>
                    </span>
                    <Switch
                      checked={active}
                      onCheckedChange={(checked) => setValue("active", checked, { shouldDirty: true })}
                      aria-label="Active"
                    />
                  </label>

                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-xs text-foreground transition-colors duration-200 hover:border-[#3A3A3A]">
                    <span>
                      Featured
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        Pinned to the home rail
                      </span>
                    </span>
                    <Switch
                      checked={featured}
                      onCheckedChange={(checked) =>
                        setValue("featured", checked, { shouldDirty: true })
                      }
                      aria-label="Featured"
                    />
                  </label>
                </div>

                <AdminField label="Badge" htmlFor="product-badge" className="sm:col-span-2">
                  <select
                    id="product-badge"
                    {...register("badge")}
                    className={cn(adminSelectClass, "sm:w-64")}
                  >
                    {PRODUCT_BADGE_CHOICES.map((badge) => (
                      <option key={badge} value={badge}>
                        {badge === "none" ? "None" : badge}
                      </option>
                    ))}
                  </select>
                </AdminField>
              </FormSection>
            </div>
          </div>

          {/* ---------- Footer ---------- */}
          <div className="flex flex-col-reverse gap-2 border-t border-[#242424] bg-[#101010] px-6 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={cn(adminButtonGhost, "min-h-11 sm:min-h-10")}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(adminButtonBlue, "min-h-11 sm:min-h-10")}
            >
              Save Product
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
