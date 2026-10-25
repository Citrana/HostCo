"use client";

import { AdminError } from "@/components/admin/admin-error";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <AdminError error={error} retry={retry} />;
}
