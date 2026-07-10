import { useInfiniteQuery } from '@tanstack/react-query'
import { admin } from '../../api/endpoints'
import { AdminTableSkeleton } from '../Skeleton'
import { formatTimeAgo } from '../../utils/time'
import { queryKeys } from '../../api/queryKeys'
import { formatAuditAction } from '../../utils/adminAudit'

export function AdminAudit() {
  const {
    data: auditPages,
    isLoading: auditLoading,
    hasNextPage: auditHasNextPage,
    fetchNextPage: fetchMoreAudit,
    isFetchingNextPage: isFetchingMoreAudit,
  } = useInfiniteQuery({
    queryKey: queryKeys.admin.audit(),
    queryFn: ({ pageParam }) => admin.auditLog({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  const auditItems = auditPages?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="bg-white rounded-4xl shadow-sm border border-gray-50 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Audit Log</h2>
        <span className="text-xs text-gray-400">All admin actions</span>
      </div>

      {auditLoading ? (
        <AdminTableSkeleton count={5} />
      ) : auditItems.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-sm">No audit entries</div>
      ) : (
        <>
          <div className="divide-y divide-gray-100">
            {auditItems.map((entry) => (
              <div key={entry.id} className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-semibold text-gray-900">
                      {entry.actor.displayName}
                    </span>
                    <span className="text-sm text-gray-400">@{entry.actor.username}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatTimeAgo(entry.createdAt, { includeAgo: true })}
                  </span>
                </div>
                <div className="text-sm text-gray-700">
                  {formatAuditAction(entry.actionType)}
                  {entry.targetId && (
                    <span className="text-gray-400"> (ID: {entry.targetId})</span>
                  )}
                </div>
                {entry.metadata && (
                  <div className="text-xs text-gray-400">
                    {Object.entries(entry.metadata).map(([key, value]) => (
                      <span key={key} className="mr-3">
                        {key}: {String(value)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {auditHasNextPage && (
            <div className="p-4 flex justify-center">
              <button
                onClick={() => {
                  void fetchMoreAudit()
                }}
                disabled={isFetchingMoreAudit}
                className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {isFetchingMoreAudit ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
