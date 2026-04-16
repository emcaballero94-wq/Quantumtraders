import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { MOCK_SESSIONS, MOCK_ALERTS } from '@/lib/oracle/mock-data'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-bg-base">
      <Sidebar />
      <TopBar sessions={MOCK_SESSIONS} alerts={MOCK_ALERTS} />
      <main className="ml-[220px] pt-12 min-h-screen">
        <div className="p-5">
          {children}
        </div>
      </main>
    </div>
  )
}
