import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { QuantumAI } from '@/components/layout/QuantumAI'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-bg-base relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-grid-quantum pointer-events-none opacity-50" />
      
      <div className="hidden md:block fixed left-0 top-0 h-screen w-[220px] border-r border-bg-border z-30">
        <Sidebar />
      </div>
      
      <TopBar />
      
      <main className="pl-0 md:pl-[220px] pt-11 min-h-screen relative">
        <div className="p-4 max-w-[1800px] mx-auto">
          {children}
        </div>
      </main>

      {/* AI Terminal Integration */}
      <QuantumAI />
    </div>
  )
}
