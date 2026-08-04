import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { ShortcutHandler } from '@/components/utils/ShortcutHandler'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-bg-base">
      <ShortcutHandler />
      <Sidebar />
      <TopBar />
      <main className="md:ml-[220px] pt-12 min-h-screen">
        <div className="p-4 md:p-5">
          {children}
        </div>
      </main>
    </div>
  )
}
