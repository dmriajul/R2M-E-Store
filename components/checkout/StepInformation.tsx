"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Mail, Phone } from "lucide-react";
import { contactSchema, type ContactValues } from "@/lib/validations";
import { useCheckoutStore } from "@/store/useCheckoutStore";
import { CheckboxRow, Field, checkoutInputClass } from "@/components/checkout/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Step 1 — contact details. Values are written to the checkout store on submit
 * so they survive navigating forwards and back (and the payment step can read
 * the email for the order).
 */
export function StepInformation() {
  const contact = useCheckoutStore((state) => state.contact);
  const setContact = useCheckoutStore((state) => state.setContact);
  const goNext = useCheckoutStore((state) => state.goNext);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    mode: "onChange",
    defaultValues: contact ?? {
      email: "",
      phone: "",
      marketingOptIn: true,
    },
  });

  const onSubmit = (values: ContactValues) => {
    setContact(values);
    goNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <header>
        <h2 className="text-2xl font-bold tracking-tight">Contact Information</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          We&apos;ll email your order confirmation and delivery updates.
        </p>
      </header>

      <Field label="Email" htmlFor="checkout-email" error={errors.email?.message}>
        <div className="relative">
          <Mail
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="checkout-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            className={`${checkoutInputClass} pl-10`}
            {...register("email")}
          />
        </div>
      </Field>

      <Field label="Phone" htmlFor="checkout-phone" error={errors.phone?.message}>
        <div className="relative">
          <Phone
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="checkout-phone"
            type="tel"
            autoComplete="tel"
            placeholder="+880 1700 000000"
            aria-invalid={Boolean(errors.phone)}
            className={`${checkoutInputClass} pl-10`}
            {...register("phone")}
          />
        </div>
      </Field>

      <CheckboxRow
        id="checkout-marketing"
        label="I want to receive adorable updates via email"
        {...register("marketingOptIn")}
      />

      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 transition-colors duration-300 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          Log in
        </Link>
      </p>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          asChild
          variant="ghost"
          className="h-12 rounded-full text-xs tracking-[0.16em] text-muted-foreground uppercase transition-colors duration-300 hover:bg-white/5 hover:text-foreground"
        >
          <Link href="/shop">Continue shopping</Link>
        </Button>

        <Button
          type="submit"
          disabled={!isValid}
          className="group h-13 w-full gap-2 rounded-full bg-primary px-8 text-sm font-semibold tracking-[0.16em] text-primary-foreground uppercase transition-all duration-500 ease-[var(--ease-luxe)] hover:shadow-[0_0_40px_-8px_rgba(212,175,55,0.95)] disabled:opacity-45 disabled:shadow-none sm:w-auto motion-safe:hover:not-disabled:scale-[1.02]"
        >
          Continue to Shipping
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Button>
      </div>
    </form>
  );
}
