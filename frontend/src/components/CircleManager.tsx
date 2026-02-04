import { useState } from 'preact/hooks'
import { Plus, Trash2, Users, X, UserPlus, Check, Pencil } from 'lucide-preact'
import { useCircles, useCircle, useCreateCircle, useUpdateCircle, useDeleteCircle, useAddCircleMember, useRemoveCircleMember } from '../hooks/useCircles'
import { users as usersApi, type Circle } from '../api/endpoints'
import { useQuery } from '@tanstack/react-query'
import { useConfirm } from './ConfirmModal'
import { Spinner } from './Spinner'
import { getAvatarUrl } from '../utils/avatar'

const COLORS = [
  { name: 'blue', class: 'bg-blue-500' },
  { name: 'green', class: 'bg-green-500' },
  { name: 'purple', class: 'bg-purple-500' },
  { name: 'orange', class: 'bg-orange-500' },
  { name: 'pink', class: 'bg-pink-500' },
  { name: 'red', class: 'bg-red-500' },
]

export function CircleManager() {
  const { data: circles, isLoading } = useCircles()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('blue')

  const createCircle = useCreateCircle()
  const confirm = useConfirm()
  const deleteCircle = useDeleteCircle()

  const handleCreate = () => {
    if (!newName.trim()) return
    createCircle.mutate({ name: newName.trim(), color: newColor }, {
      onSuccess: () => {
        setNewName('')
        setNewColor('blue')
        setShowCreate(false)
      }
    })
  }

  const handleDelete = async (circleId: string) => {
    const ok = await confirm({
      title: 'Delete Circle',
      message: 'This will remove the circle. Posts shared with this circle will become visible to everyone.',
      confirmText: 'Delete',
      danger: true,
    })
    if (ok) deleteCircle.mutate(circleId)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {circles && circles.length > 0 ? (
        circles.map(circle => (
          <CircleItem
            key={circle.id}
            circle={circle}
            isExpanded={expandedId === circle.id}
            onToggle={() => setExpandedId(expandedId === circle.id ? null : circle.id)}
            onDelete={() => void handleDelete(circle.id)}
          />
        ))
      ) : (
        <p className="text-center py-8 text-gray-400">
          No circles yet. Create one to share Moments with specific groups.
        </p>
      )}

      {showCreate ? (
        <div className="bg-white rounded-4xl p-6 shadow-sm border border-gray-50 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Circle Name
            </label>
            <input
              type="text"
              value={newName}
              onInput={e => setNewName((e.target as HTMLInputElement).value)}
              placeholder="Family, Close Friends, Work..."
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Color
            </label>
            <div className="flex gap-3">
              {COLORS.map(c => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setNewColor(c.name)}
                  className={`w-10 h-10 rounded-full ${c.class} transition-all ${newColor === c.name ? 'ring-4 ring-offset-2 ring-accent-300 scale-110' : 'hover:scale-105'}`}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || createCircle.isPending}
              className="flex-1 py-3 bg-accent-500 text-white rounded-2xl font-bold shadow-lg shadow-accent-200 hover:bg-accent-600 transition-all disabled:opacity-50"
            >
              {createCircle.isPending ? 'Creating...' : 'Create Circle'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(''); setNewColor('blue') }}
              className="px-6 py-3 text-gray-500 hover:text-gray-700 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-200 rounded-4xl text-gray-500 hover:border-accent-300 hover:text-accent-600 transition-colors"
        >
          <Plus size={20} />
          <span className="font-bold">Create Circle</span>
        </button>
      )}
    </div>
  )
}

function CircleItem({ circle, isExpanded, onToggle, onDelete }: {
  circle: Circle
  isExpanded: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(circle.name)
  const [editColor, setEditColor] = useState(circle.color)
  const updateCircle = useUpdateCircle()

  const colorClass = COLORS.find(c => c.name === circle.color)?.class || 'bg-gray-400'

  const handleSave = () => {
    if (!editName.trim()) return
    updateCircle.mutate({ id: circle.id, name: editName.trim(), color: editColor }, {
      onSuccess: () => setIsEditing(false)
    })
  }

  return (
    <div className="bg-white rounded-4xl shadow-sm border border-gray-50 overflow-hidden">
      {isEditing ? (
        <div className="p-4 space-y-4">
          <input
            type="text"
            value={editName}
            onInput={e => setEditName((e.target as HTMLInputElement).value)}
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all font-bold"
            autoFocus
          />
          <div className="flex gap-3">
            {COLORS.map(c => (
              <button
                key={c.name}
                type="button"
                onClick={() => setEditColor(c.name)}
                className={`w-8 h-8 rounded-full ${c.class} transition-all ${editColor === c.name ? 'ring-4 ring-offset-2 ring-accent-300 scale-110' : 'hover:scale-105'}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!editName.trim() || updateCircle.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-accent-500 text-white rounded-xl font-bold disabled:opacity-50"
            >
              <Check size={16} />
              {updateCircle.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setIsEditing(false); setEditName(circle.name); setEditColor(circle.color) }}
              className="px-4 py-2 text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={onToggle}
          className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 text-left transition-colors"
        >
          <div className={`w-8 h-8 rounded-full ${colorClass}`} />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 truncate">{circle.name}</h3>
            <p className="text-sm text-gray-400">{circle.memberCount || 0} members</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setIsEditing(true) }}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100"
          >
            <Pencil size={18} />
          </button>
          <Users size={20} className="text-gray-400" />
        </button>
      )}

      {isExpanded && !isEditing && (
        <CircleDetails circleId={circle.id} onDelete={onDelete} />
      )}
    </div>
  )
}

function CircleDetails({ circleId, onDelete }: { circleId: string; onDelete: () => void }) {
  const { data: circle, isLoading } = useCircle(circleId)
  const { data: allUsers } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const addMember = useAddCircleMember()
  const removeMember = useRemoveCircleMember()
  const [searchQuery, setSearchQuery] = useState('')

  if (isLoading || !circle) {
    return (
      <div className="p-6 flex justify-center border-t border-gray-100">
        <Spinner size="sm" />
      </div>
    )
  }

  const memberIds = new Set(circle.members?.map(m => m.id) || [])
  const filteredUsers = searchQuery.length >= 2
    ? allUsers?.filter(u =>
        !memberIds.has(u.id) &&
        (u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
         u.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 5) || []
    : []

  return (
    <div className="border-t border-gray-100 p-4 space-y-4">
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
          Add Members
        </label>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onInput={e => setSearchQuery((e.target as HTMLInputElement).value)}
            placeholder="Search users..."
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-4 focus:ring-accent-50 focus:border-accent-300 transition-all"
          />
          {searchQuery.length >= 2 && filteredUsers.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-100 shadow-lg overflow-hidden z-10">
              {filteredUsers.map(user => (
                <button
                  key={user.id}
                  onClick={() => {
                    addMember.mutate({ circleId, userIds: [parseInt(user.id)] })
                    setSearchQuery('')
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                >
                  <UserPlus size={18} className="text-accent-500" />
                  <img
                    src={getAvatarUrl(user)}
                    alt={user.displayName}
                    className="w-8 h-8 rounded-full"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{user.displayName}</p>
                    <p className="text-xs text-gray-400">@{user.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {searchQuery.length >= 2 && filteredUsers.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-100 shadow-lg p-4 text-center text-gray-400 z-10">
              No users found
            </div>
          )}
        </div>
      </div>

      {circle.members && circle.members.length > 0 && (
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
            Members
          </label>
          <div className="space-y-2">
            {circle.members.map(member => (
              <div key={member.id} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50">
                <img
                  src={getAvatarUrl(member)}
                  alt={member.displayName}
                  className="w-10 h-10 rounded-full"
                  loading="lazy"
                  decoding="async"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{member.displayName}</p>
                  <p className="text-xs text-gray-400">@{member.username}</p>
                </div>
                <button
                  onClick={() => removeMember.mutate({ circleId, userId: member.id })}
                  className="p-2 text-gray-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors"
                  title="Remove member"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onDelete}
        className="w-full flex items-center justify-center gap-2 py-3 text-red-500 hover:bg-red-50 rounded-2xl transition-colors font-medium"
      >
        <Trash2 size={18} />
        <span>Delete Circle</span>
      </button>
    </div>
  )
}
