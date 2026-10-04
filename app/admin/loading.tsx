import { AdminLoading } from "@/components/admin/AdminLoading";

/** Streamed fallback for every /admin/* route (the console has no server data). */
export default function AdminLoadingRoute() {
  return <AdminLoading />;
}
