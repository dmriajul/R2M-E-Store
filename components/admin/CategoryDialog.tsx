"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { cn, slugify } from "@/lib/utils";
import { CATEGORY_EMOJI_CHOICES } from "@/lib/mock-admin";
import {
  adminCategorySchema,
  type AdminCategoryValues,
} from "@/lib/validations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AdminField,
  FormSection,
  adminButtonBlue,
  adminButtonGhost,
  adminInputClass,
  adminSelectClass,
} from "@/components/admin/Field";
import { useAdminStore } from "@/store/useAdminStore";
import type { AdminCategory } from "@/types";

function emptyValues(): AdminCategoryValues {
  return {
    name: "",
    slug: "",
    emoji: CATEGORY_EMOJI_CHOICES[0] ?? "🧸",
    description: "",
    parent: "",
  };
}

function valuesFor(category: AdminCategory): AdminCategoryValues {
  return {
    name: category.name,
    slug: category.slug,
    emoji: category.emoji,
    description: category.description,
    parent: category.parent ?? "",
  };
}

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null creates a category. */
  category?: AdminCategory | null;
  /** Other categories, offered as possible parents. */
  parents: readonly AdminCategory[];
}

/** Create / edit category modal with an emoji picker. */
export function CategoryDialog({
  open,
  onOpenChange,
  category = null,
  parents,
}: CategoryDialogProps) {
  const saveCategory = useAdminStore((state) => state.saveCategory);
  const [slugTouched, setSlugTouched] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AdminCategoryValues>({
    resolver: zodResolver(adminCategorySchema),
    defaultValues: emptyValues(),
  });

  useEffect(() => {
    if (!open) return;
    reset(category ? valuesFor(category) : emptyValues());
    setSlugTouched(Boolean(category));
  }, [open, category, reset]);

  const name = watch("name");
  const emoji = watch("emoji");

  useEffect(() => {
    if (!open || slugTouched) return;
    setValue("slug", slugify(name ?? ""), { shouldValidate: false });
  }, [name, open, slugTouched, setValue]);

  const onSubmit = handleSubmit((values) => {
    saveCategory(values, category?.id);
    toast.success(category ? "Category updated! 📂" : "Category created! 📂", {
      description: `${values.emoji} ${values.name}`,
    });
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-[#2A2A2A] bg-[#141414] p-6 sm:max-w-lg">
        <DialogHeader className="gap-1">
          <DialogTitle className="text-sm font-semibold text-foreground">
            {category ? `Edit ${category.name}` : "New category"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Categories group the catalogue on the shop page.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-6">
          <FormSection title="Details">
            <AdminField label="Name" htmlFor="category-name" error={errors.name?.message}>
              <input
                id="category-name"
                {...register("name")}
                aria-invalid={Boolean(errors.name)}
                placeholder="Swimwear"
                className={adminInputClass}
              />
            </AdminField>

            <AdminField
              label="Slug"
              htmlFor="category-slug"
              hint="Used in ?category= links"
              error={errors.slug?.message}
            >
              <input
                id="category-slug"
                {...register("slug", { onChange: () => setSlugTouched(true) })}
                aria-invalid={Boolean(errors.slug)}
                className={cn(adminInputClass, "font-mono text-xs")}
              />
            </AdminField>

            <AdminField
              label="Description"
              htmlFor="category-description"
              error={errors.description?.message}
              className="sm:col-span-2"
            >
              <textarea
                id="category-description"
                rows={2}
                {...register("description")}
                aria-invalid={Boolean(errors.description)}
                placeholder="Sun-safe swim sets and beach cover-ups."
                className={cn(adminInputClass, "h-auto resize-y py-2 leading-relaxed")}
              />
            </AdminField>

            <AdminField
              label="Parent category"
              htmlFor="category-parent"
              hint="Optional — leave empty for a top-level category."
              error={errors.parent?.message}
              className="sm:col-span-2"
            >
              <select id="category-parent" {...register("parent")} className={adminSelectClass}>
                <option value="">No parent</option>
                {parents
                  .filter((entry) => entry.id !== category?.id)
                  .map((entry) => (
                    <option key={entry.id} value={entry.name}>
                      {entry.emoji} {entry.name}
                    </option>
                  ))}
              </select>
            </AdminField>

            <fieldset className="sm:col-span-2">
              <legend className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                Emoji
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {CATEGORY_EMOJI_CHOICES.map((choice) => {
                  const selected = emoji === choice;
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setValue("emoji", choice, { shouldValidate: true })}
                      aria-label={`Use ${choice}`}
                      aria-pressed={selected}
                      className={cn(
                        "grid size-10 place-items-center rounded-lg border text-base transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:outline-none",
                        selected
                          ? "border-blue-500/60 bg-blue-500/12"
                          : "border-[#2A2A2A] bg-[#151515] hover:border-[#3A3A3A]",
                      )}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
              {errors.emoji && (
                <p role="alert" className="mt-1.5 text-[11px] text-rose">
                  {errors.emoji.message}
                </p>
              )}
            </fieldset>
          </FormSection>

          <div className="flex flex-col-reverse gap-2 border-t border-[#242424] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={cn(adminButtonGhost, "min-h-11 sm:min-h-10")}
            >
              Cancel
            </button>
            <button type="submit" className={cn(adminButtonBlue, "min-h-11 sm:min-h-10")}>
              {category ? "Save Category" : "Create Category"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
