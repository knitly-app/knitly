type FormatTimeAgoOptions = {
  includeAgo?: boolean
  maxDays?: number
}

export function formatTimeAgo(dateString: string, options: FormatTimeAgoOptions = {}) {
  const { includeAgo = false, maxDays } = options
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'now'
  if (diffMins < 60) return includeAgo ? `${diffMins}m ago` : `${diffMins}m`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return includeAgo ? `${diffHours}h ago` : `${diffHours}h`

  const diffDays = Math.floor(diffHours / 24)
  if (maxDays !== undefined && diffDays >= maxDays) {
    return date.toLocaleDateString()
  }

  return includeAgo ? `${diffDays}d ago` : `${diffDays}d`
}
