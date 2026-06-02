// Auth pages get no header — unauthenticated users see a clean sign-in screen.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
