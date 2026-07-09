import { useState } from 'preact/hooks'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, Copy, Eye, EyeOff, Plus, RefreshCw, Trash2 } from 'lucide-preact'
import { admin } from '../../api/endpoints'
import { AdminTableSkeleton } from '../Skeleton'
import { useToast } from '../Toast'
import { useConfirm } from '../ConfirmModal'
import { formatTimeAgo } from '../../utils/time'
import { queryKeys } from '../../api/queryKeys'
import { confirmThenMutate } from './confirmThenMutate'

export function AdminBots() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()

  const [showCreateBot, setShowCreateBot] = useState(false)
  const [newBotUsername, setNewBotUsername] = useState('')
  const [newBotDisplayName, setNewBotDisplayName] = useState('')
  const [newBotBio, setNewBotBio] = useState('')
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)

  const { data: bots, isLoading: botsLoading } = useQuery({
    queryKey: queryKeys.admin.bots(),
    queryFn: admin.bots,
  })

  const createBot = useMutation({
    mutationFn: admin.createBot,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.bots() })
      setCreatedApiKey(data.apiKey)
      setShowApiKey(true)
      setNewBotUsername('')
      setNewBotDisplayName('')
      setNewBotBio('')
      setShowCreateBot(false)
      toast.success('Bot created')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to create bot'
      toast.error(message)
    },
  })

  const regenerateBotKey = useMutation({
    mutationFn: admin.regenerateBotKey,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.bots() })
      setCreatedApiKey(data.apiKey)
      setShowApiKey(true)
      toast.success('Key regenerated')
    },
    onError: () => toast.error('Failed to regenerate key'),
  })

  const revokeBotKey = useMutation({
    mutationFn: admin.revokeBotKey,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.bots() })
      toast.success('Key revoked')
    },
    onError: () => toast.error('Failed to revoke key'),
  })

  const deleteBot = useMutation({
    mutationFn: admin.deleteBot,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.bots() })
      toast.success('Bot deleted')
    },
    onError: () => toast.error('Failed to delete bot'),
  })

  const handleRegenerateKey = (botId: string, username: string) =>
    confirmThenMutate(
      confirm,
      {
        title: 'Regenerate API Key',
        message: `This will revoke the current key for @${username} and generate a new one.`,
        confirmText: 'Regenerate',
        danger: true,
      },
      () => regenerateBotKey.mutate(botId)
    )

  const handleRevokeKey = (botId: string, username: string) =>
    confirmThenMutate(
      confirm,
      {
        title: 'Revoke API Key',
        message: `@${username} will no longer be able to authenticate via API.`,
        confirmText: 'Revoke',
        danger: true,
      },
      () => revokeBotKey.mutate(botId)
    )

  const handleDeleteBot = (botId: string, username: string) =>
    confirmThenMutate(
      confirm,
      {
        title: 'Delete Bot',
        message: `This will permanently remove @${username} and all its content.`,
        confirmText: 'Delete',
        danger: true,
      },
      () => deleteBot.mutate(botId)
    )

  return (
    <>
      {createdApiKey && (
        <div className="mb-6 bg-green-50 rounded-4xl p-6 border border-green-100">
          <h3 className="font-bold text-green-800 mb-2">API Key Created</h3>
          <p className="text-sm text-green-700 mb-3">
            Copy this key now. It won't be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white px-4 py-3 rounded-2xl text-sm font-mono text-gray-900 border border-green-200 select-all break-all">
              {showApiKey ? createdApiKey : '•'.repeat(40)}
            </code>
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="p-3 rounded-xl bg-white border border-green-200 hover:bg-green-50 transition-colors"
            >
              {showApiKey ? <EyeOff size={18} className="text-green-700" /> : <Eye size={18} className="text-green-700" />}
            </button>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(createdApiKey).then(() => toast.success('Copied!'))
              }}
              className="p-3 rounded-xl bg-white border border-green-200 hover:bg-green-50 transition-colors"
            >
              <Copy size={18} className="text-green-700" />
            </button>
          </div>
          <button
            onClick={() => { setCreatedApiKey(null); setShowApiKey(false) }}
            className="mt-3 text-xs text-green-600 hover:text-green-800 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="bg-white rounded-4xl shadow-sm border border-gray-50 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Bots</h2>
          <button
            onClick={() => setShowCreateBot(!showCreateBot)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-accent-500 text-white rounded-full text-sm font-bold shadow-sm hover:bg-accent-600 transition-colors"
          >
            <Plus size={16} />
            <span>New Bot</span>
          </button>
        </div>

        {showCreateBot && (
          <div className="p-6 border-b border-gray-100 bg-gray-50">
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={newBotUsername}
                  onInput={(e) => setNewBotUsername((e.target as HTMLInputElement).value)}
                  placeholder="knitly-bot"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-4 focus:ring-accent-50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                <input
                  type="text"
                  value={newBotDisplayName}
                  onInput={(e) => setNewBotDisplayName((e.target as HTMLInputElement).value)}
                  placeholder="Knitly Bot"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-4 focus:ring-accent-50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bio (optional)</label>
                <input
                  type="text"
                  value={newBotBio}
                  onInput={(e) => setNewBotBio((e.target as HTMLInputElement).value)}
                  placeholder="I'm a friendly bot..."
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-4 focus:ring-accent-50 transition-all"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => createBot.mutate({
                    username: newBotUsername,
                    displayName: newBotDisplayName,
                    bio: newBotBio || undefined,
                  })}
                  disabled={!newBotUsername.trim() || !newBotDisplayName.trim() || createBot.isPending}
                  className="px-4 py-2 bg-accent-500 text-white rounded-full text-sm font-bold hover:bg-accent-600 transition-colors disabled:opacity-50"
                >
                  {createBot.isPending ? 'Creating...' : 'Create Bot'}
                </button>
                <button
                  onClick={() => setShowCreateBot(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded-full text-sm font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {botsLoading ? (
          <AdminTableSkeleton count={3} />
        ) : !bots?.length ? (
          <div className="py-10 text-center text-gray-400 text-sm">
            No bots yet. Create one to get started.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {bots.map((bot) => {
              const activeKey = bot.keys.find(k => !k.revokedAt)
              const hasActiveKey = !!activeKey

              return (
                <div key={bot.id} className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <Bot size={20} className="text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate">{bot.displayName}</p>
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 leading-none">
                          Bot
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 truncate">@{bot.username}</p>
                      {bot.lastActive && (
                        <p className="text-xs text-gray-400">Last active: {formatTimeAgo(bot.lastActive, { includeAgo: true })}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${
                      hasActiveKey ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {hasActiveKey ? 'Active' : 'No Key'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleRegenerateKey(bot.id, bot.username)}
                      disabled={regenerateBotKey.isPending}
                      className="px-3 py-2 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={14} className="inline mr-1" />
                      Regenerate Key
                    </button>

                    {hasActiveKey && (
                      <button
                        onClick={() => handleRevokeKey(bot.id, bot.username)}
                        disabled={revokeBotKey.isPending}
                        className="px-3 py-2 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                      >
                        Revoke Key
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteBot(bot.id, bot.username)}
                      disabled={deleteBot.isPending}
                      className="px-3 py-2 rounded-full text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={14} className="inline mr-1" />
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
