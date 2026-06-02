export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 animate-in slide-in-from-right-8 duration-300 ease-out">
      {children}
    </div>
  );
}
