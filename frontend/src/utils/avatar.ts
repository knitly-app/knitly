export function getAvatarUrl(user: { id: string; avatar?: string | null }): string {
  return user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`
}
