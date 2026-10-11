"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CirclePlus, ImagePlus, Loader2, Trash2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { cn, formatPrice, slugify } from "@/lib/utils";
import {
  MAX_IMAGE_BYTES,
  humanFileSize,
  isRenderableImage,
  publicIdFromUrl,
  validateUploadFile,
} from "@/lib/images";
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
import { MarkdownDescriptionEditor } from "@/components/admin/MarkdownDescriptionEditor";
import type { AdminProduct, UploadResult } from "@/types";

/** New products start at 10; existing records keep their own threshold. */
const NEW_PRODUCT_THRESHOLD = 10;
const MAX_IMAGES = 5;
/** Images arrive as Cloudinary URLs or, without Cloudinary, as local uploads. */
const UPLOAD_HINT = `JPEG, PNG or WebP up to ${humanFileSize(MAX_IMAGE_BYTES)} each`;
type AgeOption = (typeof AGE_OPTIONS)[number];
type VariantEntry = {
  size: string;
  color: string;
  stock: unknown;
  sku?: string;
};

function buildVariantMatrix(
  colors: readonly string[],
  sizes: readonly AdminProductValues["sizes"][number][],
  stock: number,
  existing: readonly VariantEntry[] = [],
) {
  const combinations = colors.flatMap((color) =>
    sizes.map((size) => ({ color, size })),
  );
  const existingByCombination = new Map(
    existing.map((variant) => [`${variant.color}\u0000${variant.size}`, variant]),
  );
  const existingStock = combinations.reduce((total, { color, size }) => {
    const variant = existingByCombination.get(`${color}\u0000${size}`);
    return total + (variant ? Math.max(0, Number(variant.stock) || 0) : 0);
  }, 0);
  const missingCount = combinations.filter(
    ({ color, size }) => !existingByCombination.has(`${color}\u0000${size}`),
  ).length;
  const missingStock = Math.max(0, stock - existingStock);
  const defaultStock = missingCount > 0 ? Math.floor(missingStock / missingCount) : 0;
  const remainder = missingCount > 0 ? missingStock % missingCount : 0;
  let missingIndex = 0;

  return combinations.map(({ color, size }) => {
    const variant = existingByCombination.get(`${color}\u0000${size}`);
    const defaultVariantStock =
      defaultStock + (missingIndex < remainder ? 1 : 0);
    if (!variant) missingIndex += 1;

    return {
      color,
      size,
      stock: variant
        ? Math.max(0, Number(variant.stock) || 0)
        : defaultVariantStock,
      ...(variant?.sku ? { sku: variant.sku } : {}),
    };
  });
}

/** "2-4Y" / "One Size" → [min, max] that always sits inside the age dropdowns. */
function parseAgeRange(range: string): [AgeOption, AgeOption] {
  const numbers = range.match(/\d+/g)?.map(Number) ?? [];
  const min = Math.min(12, numbers[0] ?? 0);
  const max = Math.min(12, numbers[1] ?? min);
  const clamp = (value: number): AgeOption => {
    const bounded = Math.min(12, Math.max(0, value));
    return String(bounded) as AgeOption;
  };
  return [clamp(min), clamp(Math.max(min, max))];
}

function emptyValues(): AdminProductFormInput {
  return {
    name: "",
    description: "",
    category: "",
    categories: [],
    gender: "Girls",
    ageMin: "0",
    ageMax: "12",
    price: 0,
    compareAtPrice: undefined,
    costPrice: undefined,
    sku: "LL-NEW-001",
    stock: 0,
    lowStockThreshold: NEW_PRODUCT_THRESHOLD,
    trackInventory: true,
    colors: [{ name: "Pink", hex: COLOR_HEX.Pink ?? DEFAULT_SWATCH }],
    sizes: ["4T", "5"],
    variants: buildVariantMatrix(["Pink"], ["4T", "5"], 0),
    images: [],
    metaTitle: "",
    metaDescription: "",
    slug: "",
    active: true,
    featured: false,
    virtualBoutique: false,
    newArrival: false,
    bestSeller: false,
    featuredOrder: 0,
    badge: "none",
  };
}

function valuesFor(product: AdminProduct): AdminProductFormInput {
  const [ageMin, ageMax] = parseAgeRange(product.ageRange);
  const sizes = product.sizes.filter(
    (size): size is AdminProductValues["sizes"][number] =>
      PRODUCT_SIZE_OPTIONS.includes(size as AdminProductValues["sizes"][number]),
  );
  const variants = buildVariantMatrix(
    product.colors,
    sizes,
    product.stock,
    product.variants,
  );

  return {
    name: product.name,
    description: product.description,
    category: product.category,
    categories: product.categories?.length ? [...product.categories] : [product.category],
    gender: product.gender,
    ageMin,
    ageMax,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    costPrice: product.costPrice,
    sku: product.sku,
    stock: variants.reduce((total, variant) => total + variant.stock, 0),
    lowStockThreshold: product.lowStockThreshold,
    trackInventory: product.trackInventory,
    colors: product.colors.map((name) => ({
      name,
      hex: COLOR_HEX[name] ?? DEFAULT_SWATCH,
    })),
    sizes,
    variants,
    images: [...product.images],
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    slug: product.slug,
    active: product.status === "active",
    featured: product.featured,
    virtualBoutique: product.virtualBoutique ?? false,
    newArrival: product.newArrival ?? false,
    bestSeller: product.bestSeller ?? false,
    featuredOrder: product.featuredOrder ?? 0,
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
  const upsertProduct = useAdminStore((state) => state.upsertProduct);
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
  const variants = watch("variants") ?? [];
  const images = watch("images") ?? [];

  /* ---------- Uploads (Cloudinary, or /public/uploads in demo mode) ---------- */
  const [uploading, setUploading] = useState(false);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(
    () => new Set(),
  );
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const category = watch("category");
  const categories = watch("categories") ?? [];
  const active = watch("active");
  const virtualBoutique = watch("virtualBoutique");
  const featured = watch("featured");
  const newArrival = watch("newArrival");
  const bestSeller = watch("bestSeller");
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

  const syncVariantMatrix = (
    nextColors: readonly { name: string }[],
    nextSizes: readonly (typeof PRODUCT_SIZE_OPTIONS)[number][],
  ) => {
    const nextVariants = buildVariantMatrix(
      nextColors.map((color) => color.name),
      nextSizes,
      0,
      watch("variants") ?? [],
    );
    const totalStock = nextVariants.reduce((sum, variant) => sum + variant.stock, 0);
    setValue("variants", nextVariants, { shouldDirty: true, shouldValidate: true });
    setValue("stock", totalStock, { shouldDirty: true, shouldValidate: true });
  };

  const toggleSize = (size: (typeof PRODUCT_SIZE_OPTIONS)[number]) => {
    const next = sizes.includes(size) ? sizes.filter((entry) => entry !== size) : [...sizes, size];
    setValue("sizes", next, { shouldValidate: true, shouldDirty: true });
    syncVariantMatrix(watch("colors") ?? [], next);
  };

  const addImage = () => {
    if (images.length >= MAX_IMAGES) {
      toast.error(`Max ${MAX_IMAGES} images per product`);
      return;
    }
    const stem = slugify(slug || name || "product") || "product";
    setValue("images", [...images, `${stem}-${images.length + 1}`], { shouldDirty: true });
  };

  /** XHR (not fetch) so the progress bar can show real percentages. */
  const uploadAsset = (file: File) =>
    new Promise<UploadResult>((resolve, reject) => {
      const body = new FormData();
      body.append("file", file);

      const request = new XMLHttpRequest();
      request.open("POST", "/api/upload");
      request.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
      request.addEventListener("load", () => {
        try {
          const payload = JSON.parse(request.responseText) as {
            data?: UploadResult;
            error?: string;
          };
          if (request.status >= 400 || !payload.data) {
            reject(new Error(payload.error ?? "Upload failed"));
            return;
          }
          resolve(payload.data);
        } catch {
          reject(new Error("Unexpected response from the upload service"));
        }
      });
      request.addEventListener("error", () => reject(new Error("Network error")));
      request.send(body);
    });

  const handleImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      toast.error(`Max ${MAX_IMAGES} images per product`);
      return;
    }

    setUploading(true);
    const uploaded: string[] = [];

    try {
      for (const file of Array.from(files).slice(0, room)) {
        const validation = validateUploadFile(file);
        if (!validation.ok) {
          toast.error(file.name, { description: validation.error });
          continue;
        }

        setProgress(0);
        try {
          const asset = await uploadAsset(file);
          uploaded.push(asset.url);
        } catch (error) {
          toast.error(`Couldn't upload ${file.name}`, {
            description: error instanceof Error ? error.message : undefined,
          });
        }
      }

      if (uploaded.length > 0) {
        setValue("images", [...images, ...uploaded], { shouldDirty: true });
        toast.success(uploaded.length === 1 ? "Image uploaded 📸" : `${uploaded.length} images uploaded 📸`);
      }
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  /** Deletes a Cloudinary asset when an image is removed from the form. */
  const discardAsset = async (value: string | undefined) => {
    if (!value) return;
    const publicId = publicIdFromUrl(value);
    if (!publicId) return;

    await fetch(`/api/upload?publicId=${encodeURIComponent(publicId)}`, {
      method: "DELETE",
    }).catch(() => null);
  };

  const removeImage = (index: number) => {
    void discardAsset(images[index]);
    setValue(
      "images",
      images.filter((_, position) => position !== index),
      { shouldDirty: true },
    );
  };

  const onSubmit = handleSubmit(async (values) => {
    const stock = values.variants.reduce((sum, variant) => sum + variant.stock, 0);
    const endpoint = product
      ? `/api/admin/products/${encodeURIComponent(product.id)}`
      : "/api/admin/products";

    try {
      const response = await fetch(endpoint, {
        method: product ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, stock }),
      });
      const payload = (await response.json()) as {
        data?: { product: AdminProduct | null };
        error?: string;
        source?: "database" | "mock";
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Product could not be saved");
      }

      let id: string;
      if (payload.source === "database" && payload.data.product) {
        id = payload.data.product.id;
        upsertProduct(payload.data.product);
      } else {
        id = saveProduct({ ...values, stock }, product?.id);
      }

      toast.success("Product saved! ✅", {
        description: product ? `${values.name} updated.` : `${values.name} added as ${id}.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error("Product couldn't be saved", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  });

  const categoryEmoji = category ? CATEGORY_META[category].emoji : "🧥";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full border-l border-[#242424] bg-[#141414] p-0 sm:max-w-none sm:w-[60%]"
      >
        <SheetHeader className="flex-row items-start justify-between gap-3 border-b border-[#242424] px-6 py-5 sm:px-8">
          <div>
            <SheetTitle className="text-sm font-semibold text-foreground">
              {product ? "Edit product" : "Add product"}
            </SheetTitle>
            <SheetDescription className="mt-1 text-xs text-muted-foreground">
              {product
                ? `Editing ${product.name} · ${product.sku}`
                  : "Add product details and choose where it appears on the storefront."}
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
          <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-7">
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
                  <Controller
                    control={control}
                    name="description"
                    render={({ field }) => (
                      <MarkdownDescriptionEditor
                        id="product-description"
                        name={field.name}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        inputRef={field.ref}
                        invalid={Boolean(errors.description)}
                      />
                    )}
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
                    <option value="">Choose a primary category</option>
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
                <AdminField label="Selling Price (৳)" htmlFor="product-price" error={errors.price?.message}>
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
                  label="Cost Price / Buying Price (৳)"
                  htmlFor="product-cost"
                  hint="Supplier cost per unit, used for profit reporting."
                  error={errors.costPrice?.message}
                >
                  <input
                    id="product-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("costPrice")}
                    aria-invalid={Boolean(errors.costPrice)}
                    className={adminInputClass}
                  />
                </AdminField>

                <AdminField
                  label="Compare-at price (৳)"
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

                <div className="flex items-end pb-1 text-xs text-muted-foreground">
                  Margin preview:{" "}
                  <span className="ml-1.5 font-medium text-foreground tabular-nums">
                    {watch("costPrice") && watch("price")
                      ? formatPrice(Number(watch("price")) - Number(watch("costPrice")))
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
                  label="Total variant stock"
                  htmlFor="product-stock"
                  error={errors.stock?.message}
                >
                  <input
                    id="product-stock"
                    type="number"
                    min="0"
                    step="1"
                    {...register("stock")}
                    value={watch("stock") ?? 0}
                    readOnly
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
                    {colorFields.map((field, index) => {
                      const colorNameField = register(`colors.${index}.name`);
                      const currentColor = watch(`colors.${index}.name`) ?? "";
                      return (
                      <li key={field.id} className="flex flex-wrap items-center gap-2">
                        <span
                          aria-hidden
                          className="size-8 shrink-0 rounded-lg border border-[#2A2A2A]"
                          style={{ backgroundColor: watch(`colors.${index}.hex`) || DEFAULT_SWATCH }}
                        />
                        <input
                          aria-label={`Colour ${index + 1} name`}
                          {...colorNameField}
                          onChange={(event) => {
                            colorNameField.onChange(event);
                            setValue(
                              "variants",
                              (watch("variants") ?? []).map((variant) =>
                                variant.color === currentColor
                                  ? { ...variant, color: event.target.value }
                                  : variant,
                              ),
                              { shouldDirty: true, shouldValidate: true },
                            );
                          }}
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
                          onClick={() => {
                            const nextColors = (watch("colors") ?? []).filter(
                              (_, colorIndex) => colorIndex !== index,
                            );
                            removeColor(index);
                            syncVariantMatrix(nextColors, sizes);
                          }}
                          disabled={colorFields.length <= 1}
                          aria-label={`Remove colour ${index + 1}`}
                          className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#2A2A2A] text-muted-foreground transition-colors duration-200 hover:border-rose-500/50 hover:text-rose-400 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none disabled:opacity-35"
                        >
                          <Trash2 aria-hidden className="size-3.5" />
                        </button>
                      </li>
                      );
                    })}
                  </ul>
                  {errors.colors && (
                    <p role="alert" className="mt-1.5 text-[11px] text-rose">
                      {errors.colors.message ?? "Fix the colour rows above"}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const newColor = {
                        name: `Colour ${colorFields.length + 1}`,
                        hex: DEFAULT_SWATCH,
                      };
                      const nextColors = [...(watch("colors") ?? []), newColor];
                      appendColor(newColor);
                      syncVariantMatrix(nextColors, sizes);
                    }}
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

                <div className="sm:col-span-2">
                  <p className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    Size &amp; colour inventory
                  </p>
                  <div className="mt-2 overflow-x-auto rounded-lg border border-[#2A2A2A]">
                    <table className="w-full min-w-[620px] text-left text-xs">
                      <thead className="bg-[#101010] text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Colour</th>
                          <th className="px-3 py-2 font-medium">Size</th>
                          <th className="px-3 py-2 font-medium">Stock</th>
                          <th className="px-3 py-2 font-medium">Variant SKU (optional)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#242424]">
                        {variants.map((variant, index) => {
                          const stockField = register(`variants.${index}.stock`);
                          return (
                            <tr key={`${variant.color}-${variant.size}`}>
                              <td className="px-3 py-2 text-foreground">{variant.color}</td>
                              <td className="px-3 py-2 text-foreground">{variant.size}</td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  aria-label={`${variant.color} ${variant.size} stock`}
                                  {...stockField}
                                  onChange={(event) => {
                                    stockField.onChange(event);
                                    const total = variants.reduce(
                                      (sum, entry, entryIndex) =>
                                        sum +
                                        (entryIndex === index
                                          ? Math.max(0, Number(event.target.value) || 0)
                                          : Math.max(0, Number(entry.stock) || 0)),
                                      0,
                                    );
                                    setValue("stock", total, {
                                      shouldDirty: true,
                                      shouldValidate: true,
                                    });
                                  }}
                                  className={cn(adminInputClass, "h-9 w-24")}
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  aria-label={`${variant.color} ${variant.size} SKU`}
                                  {...register(`variants.${index}.sku`)}
                                  placeholder="Optional"
                                  className={cn(adminInputClass, "h-9 min-w-40 font-mono text-xs")}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {errors.variants && (
                    <p role="alert" className="mt-1.5 text-[11px] text-rose">
                      Check the size and colour inventory rows.
                    </p>
                  )}
                </div>
              </FormSection>

              {/* ---------- Media ---------- */}
              <FormSection title="Media">
                <div className="sm:col-span-2">
                  <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                    {images.map((value, index) => (
                      <li
                        key={`${value}-${index}`}
                        className="group relative aspect-square overflow-hidden rounded-lg border border-[#2A2A2A] bg-[#101010]"
                      >
                        {isRenderableImage(value) && !failedImageUrls.has(value) ? (
                          <Image
                            src={value}
                            alt={`Product image ${index + 1}`}
                            fill
                            sizes="160px"
                            unoptimized={value.startsWith("/uploads/")}
                            className="object-cover"
                            onError={() =>
                              setFailedImageUrls((current) => {
                                const next = new Set(current);
                                next.add(value);
                                return next;
                              })
                            }
                          />
                        ) : (
                          <span className="grid h-full place-items-center bg-linear-to-br from-blue-500/20 to-violet-500/10 text-2xl">
                            {categoryEmoji}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          aria-label={`Remove image ${index + 1}`}
                          className="absolute top-1 right-1 inline-flex size-7 items-center justify-center rounded-md border border-[#2A2A2A] bg-[#0D0D0D]/85 text-muted-foreground transition-colors duration-200 hover:text-rose-400 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none"
                        >
                          <X aria-hidden className="size-3" />
                        </button>
                        <span className="absolute inset-x-1 bottom-1 truncate rounded bg-[#0D0D0D]/80 px-1 py-0.5 text-[9px] text-muted-foreground">
                          {value}
                        </span>
                      </li>
                    ))}

                    <li>
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => imageInput.current?.click()}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(event) => {
                          event.preventDefault();
                          setDragging(false);
                          void handleImageFiles(event.dataTransfer.files);
                        }}
                        className={cn(
                          "flex h-full min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-2 py-4 text-center text-[11px] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none disabled:opacity-60",
                          dragging
                            ? "border-blue-500/70 bg-blue-500/8 text-blue-200"
                            : "border-[#3A3A3A] bg-[#101010] text-muted-foreground hover:border-blue-500/50 hover:text-blue-300",
                        )}
                      >
                        {uploading ? (
                          <>
                            <Loader2 aria-hidden className="size-4 animate-spin" />
                            {progress}%
                          </>
                        ) : (
                          <>
                            <UploadCloud aria-hidden className="size-4" />
                            Drop or click
                          </>
                        )}
                      </button>
                    </li>
                  </ul>

                  {uploading && (
                    <div
                      role="progressbar"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#242424]"
                    >
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">
                      Max {MAX_IMAGES} images · {UPLOAD_HINT} · Cloudinary when configured,
                      otherwise /public/uploads.
                    </p>
                    <button
                      type="button"
                      onClick={addImage}
                      className={cn(adminButtonGhost, "min-h-9 px-3 text-[11px]")}
                    >
                      <ImagePlus aria-hidden className="size-3.5" />
                      Add placeholder
                    </button>
                  </div>

                  <input
                    ref={imageInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    onChange={(event) => {
                      void handleImageFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </div>

              </FormSection>

              {/* ---------- Status ---------- */}
              <FormSection title="Status">
                <div className="flex flex-col gap-3">
                  <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-xs text-foreground transition-colors duration-200 hover:border-[#3A3A3A]">
                    <span>
                      Publish product
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        Published products are visible on the storefront
                      </span>
                    </span>
                    <Switch
                      checked={active}
                      onCheckedChange={(checked) =>
                        setValue("active", checked, { shouldDirty: true })
                      }
                      aria-label="Active"
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

              {/* ---------- Display & visibility ---------- */}
              <FormSection title="Display & Visibility">
                <fieldset className="sm:col-span-2">
                  <legend className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    Category assignments
                  </legend>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Products appear in every selected category. The primary category is used for product details.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {PRODUCT_CATEGORY_NAMES.map((name) => {
                      const checked = categories.includes(name);
                      return (
                        <label
                          key={name}
                          className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-xs text-foreground transition-colors duration-200 hover:border-[#3A3A3A] has-checked:border-blue-500/60 has-checked:bg-blue-500/12"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={checked && categories.length === 1}
                            onChange={() => {
                              const nextCategories = checked
                                ? categories.filter((entry) => entry !== name)
                                : [...categories, name];
                              setValue("categories", nextCategories, {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                              const nextPrimaryCategory = nextCategories[0];
                              if (
                                category &&
                                nextPrimaryCategory &&
                                !nextCategories.includes(category)
                              ) {
                                setValue("category", nextPrimaryCategory, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                              } else if (!category && nextPrimaryCategory) {
                                setValue("category", nextPrimaryCategory, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                              }
                            }}
                            className="size-3.5 accent-blue-500"
                          />
                          {CATEGORY_META[name].emoji} {name}
                        </label>
                      );
                    })}
                  </div>
                  {errors.categories && (
                    <p role="alert" className="mt-1.5 text-[11px] text-rose">
                      {errors.categories.message}
                    </p>
                  )}
                </fieldset>

                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-xs text-foreground transition-colors duration-200 hover:border-[#3A3A3A]">
                  <span>
                    Show in Virtual Boutique
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      Include this product in the boutique showcase
                    </span>
                  </span>
                  <Switch
                    checked={virtualBoutique}
                    onCheckedChange={(checked) =>
                      setValue("virtualBoutique", checked, { shouldDirty: true })
                    }
                    aria-label="Show in Virtual Boutique"
                  />
                </label>

                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-xs text-foreground transition-colors duration-200 hover:border-[#3A3A3A]">
                  <span>
                    Feature on Homepage
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      Pin to the homepage featured rail
                    </span>
                  </span>
                  <Switch
                    checked={featured}
                    onCheckedChange={(checked) =>
                      setValue("featured", checked, { shouldDirty: true })
                    }
                    aria-label="Feature on Homepage"
                  />
                </label>

                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-xs text-foreground transition-colors duration-200 hover:border-[#3A3A3A]">
                  <span>
                    Mark as New Arrival
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      Show in the new arrivals collection
                    </span>
                  </span>
                  <Switch
                    checked={newArrival}
                    onCheckedChange={(checked) =>
                      setValue("newArrival", checked, { shouldDirty: true })
                    }
                    aria-label="Mark as New Arrival"
                  />
                </label>

                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#2A2A2A] bg-[#151515] px-3 text-xs text-foreground transition-colors duration-200 hover:border-[#3A3A3A]">
                  <span>
                    Mark as Bestseller
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      Show in the best sellers collection
                    </span>
                  </span>
                  <Switch
                    checked={bestSeller}
                    onCheckedChange={(checked) =>
                      setValue("bestSeller", checked, { shouldDirty: true })
                    }
                    aria-label="Mark as Bestseller"
                  />
                </label>

                <AdminField
                  label="Featured display priority"
                  htmlFor="product-featured-order"
                  hint="Lower numbers appear first; ties use newest product first."
                  error={errors.featuredOrder?.message}
                >
                  <input
                    id="product-featured-order"
                    type="number"
                    min="0"
                    max="9999"
                    step="1"
                    {...register("featuredOrder")}
                    aria-invalid={Boolean(errors.featuredOrder)}
                    className={adminInputClass}
                  />
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
                    placeholder="Rainbow Tutu Skirt | Mukra"
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
                    className={cn(adminInputClass, "h-auto resize-y px-4 py-2.5 leading-relaxed")}
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

            </div>
          </div>

          {/* ---------- Footer ---------- */}
          <div className="flex flex-col-reverse gap-2 border-t border-[#242424] bg-[#101010] px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
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
