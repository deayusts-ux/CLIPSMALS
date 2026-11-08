import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-surface">
      <Header />
      <main className="flex flex-col relative w-full pt-16 pb-28 min-h-screen">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}