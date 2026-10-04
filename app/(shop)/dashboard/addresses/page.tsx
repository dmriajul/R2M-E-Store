"use client";

import { AddressBook } from "@/components/dashboard/AddressBook";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";

export default function DashboardAddressesPage() {
  return (
    <>
      <title>My Addresses | LITTLE LUXE</title>
      <meta
        name="description"
        content="Saved delivery addresses for your Little Luxe orders — add, edit or set a default."
      />
      <meta name="robots" content="noindex" />

      <DashboardPageHeader
        title="My Addresses"
        emoji="📍"
        description="Where should the next parcel land? Keep up to three addresses ready for a one-tap checkout."
      />

      <AddressBook />
    </>
  );
}
