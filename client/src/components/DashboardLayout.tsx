/**
 * Generic content wrapper retained for routes that may need a layout later.
 * The local inference application intentionally has no authentication shell.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
