import { ChatRoom } from '../components/Chat/ChatRoom'

export function ChatRoute() {
  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)] md:py-4">
      <div className="flex-1 flex flex-col bg-white md:rounded-2xl md:shadow-sm md:border md:border-gray-100 overflow-hidden">
        <ChatRoom />
      </div>
    </div>
  )
}
