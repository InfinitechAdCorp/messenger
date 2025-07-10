import type React from "react"

export interface IconSvgProps extends React.SVGProps<SVGSVGElement> {
  size?: number
}

export interface User {
  id: number
  username: string
  email: string
  fullName: string
  password?: string
  status?: "online" | "offline"
}

export interface Friend {
  id: number
  username: string
  fullName: string
  status: "online" | "offline"
}

export interface Group {
  id: number
  name: string
  members: number[]
  createdBy: number
}

export interface Chat {
  id: string
  type: "direct" | "group"
  name: string
  participant?: Friend
  group?: Group
  lastMessage: string
  timestamp: string
  unreadCount: number
}

export interface Message {
  id: number
  chatId: string
  senderId: number
  senderName: string
  content: string
  timestamp: string
}

export interface MessengerAppProps {
  currentUser: User
  onLogout: () => void
}

export interface LoginFormProps {
  onLogin: (user: User) => void
}

export interface SidebarProps {
  currentUser: User
  activeView: "chats" | "friends" | "groups"
  onViewChange: (view: "chats" | "friends" | "groups") => void
  onLogout: () => void
}

export interface ChatWindowProps {
  chat: Chat
  messages: Message[]
  currentUser: User
  onSendMessage: (content: string) => void
  onBack?: () => void
  isMobile?: boolean
  onTyping?: (isTyping: boolean) => void
  typingUsers?: number[]
  onUnfriend?: (friendId: number) => Promise<void>
}

export interface FriendsListProps {
  friends: Friend[]
  onAddFriend: () => void
  onStartChat: (friend: Friend) => void
  onUnfriend?: (friendId: number) => Promise<void>
  searchQuery: string
}

export interface GroupsListProps {
  groups: Group[]
  friends: Friend[]
  onCreateGroup: () => void
  onSelectGroup: (group: Group) => void
  searchQuery: string
}

export interface CreateGroupModalProps {
  friends: Friend[]
  onClose: () => void
  onCreateGroup: (groupData: { name: string; members: number[] }) => void
}

export interface AddFriendModalProps {
  onClose: () => void
  onAddFriend: (friendData: { username: string; fullName: string; email: string }) => void
}
