export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-48 bg-bg-elevated rounded" />
        <div className="h-6 w-32 bg-bg-elevated rounded" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="h-64 bg-bg-card border border-bg-border rounded-xl" />
          <div className="grid grid-cols-3 gap-4">
             <div className="h-32 bg-bg-card border border-bg-border rounded-xl" />
             <div className="h-32 bg-bg-card border border-bg-border rounded-xl" />
             <div className="h-32 bg-bg-card border border-bg-border rounded-xl" />
          </div>
        </div>
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="h-[500px] bg-bg-card border border-bg-border rounded-xl" />
        </div>
      </div>
    </div>
  )
}
