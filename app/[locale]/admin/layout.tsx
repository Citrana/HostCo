import { AdminShell } from "@/components/admin/admin-shell";

export default function Layout({ children }: LayoutProps<"/[locale]/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
