"use client";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { ProfileCard } from "@/components/dashboard/ProfileCard";
import {
  DangerZone,
  PasswordCard,
  PreferencesCard,
  ProfileDetailsForm,
} from "@/components/dashboard/ProfileForms";

export default function DashboardProfilePage() {
  return (
    <>
      <title>My Profile | LITTLE LUXE</title>
      <meta
        name="description"
        content="Your Little Luxe profile — contact details, password, notification preferences and more."
      />
      <meta name="robots" content="noindex" />

      <DashboardPageHeader
        title="My Profile"
        emoji="👤"
        description="Your details, your password and how we keep in touch."
      />

      <div className="flex flex-col gap-6">
        <ProfileCard />
        <ProfileDetailsForm />
        <PasswordCard />
        <PreferencesCard />
        <DangerZone />
      </div>
    </>
  );
}
