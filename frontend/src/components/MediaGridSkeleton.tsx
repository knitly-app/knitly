export function MediaGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
      ))}
    </div>
  )
}
