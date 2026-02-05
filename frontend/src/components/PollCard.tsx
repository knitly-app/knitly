import { Check } from 'lucide-preact'
import type { Poll } from '../api/endpoints'

interface PollCardProps {
  poll: Poll
  onVote: (optionId: string) => void
  isVoting: boolean
}

export function PollCard({ poll, onVote, isVoting }: PollCardProps) {
  const hasVoted = poll.userVote !== null

  return (
    <div className="mb-4">
      <p className="font-medium text-gray-900 mb-3">{poll.question}</p>

      {hasVoted ? (
        <div className="space-y-2">
          {poll.options.map((option) => {
            const percentage = poll.totalVotes > 0
              ? Math.round((option.voteCount / poll.totalVotes) * 100)
              : 0
            const isSelected = poll.userVote === option.id

            return (
              <div key={option.id} className="relative">
                <div
                  className={`absolute inset-0 rounded-xl transition-all ${
                    isSelected ? 'bg-accent-100' : 'bg-gray-100'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
                <div className="relative flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2">
                    {isSelected && <Check size={16} className="text-accent-500" />}
                    <span className={isSelected ? 'font-medium text-accent-700' : 'text-gray-700'}>
                      {option.optionText}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-gray-500">{percentage}%</span>
                </div>
              </div>
            )
          })}
          <p className="text-sm text-gray-500 mt-2">
            {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {poll.options.map((option) => (
            <button
              key={option.id}
              onClick={() => onVote(option.id)}
              disabled={isVoting}
              className="w-full px-4 py-3 text-left rounded-xl border border-gray-200 hover:border-accent-300 hover:bg-accent-50 transition-colors text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {option.optionText}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
