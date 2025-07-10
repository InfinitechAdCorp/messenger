"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { DesktopSidebarV2 } from "@/components/desktop-sidebar"
import { ChatWindow } from "@/components/chat-window"
import { FriendsList } from "@/components/friends-list"
import { GroupsList } from "@/components/groups-list"
import { CreateGroupModal } from "@/components/create-group-modal"
import { AddFriendModal } from "@/components/add-friend-modal"
import { SearchBar } from "@/components/search-bar"
import { ChatList } from "@/components/chat-list"
import { OnlineFriends } from "@/components/online-friends"
import { MobileHeader } from "@/components/mobile-header"
import { PWAInstallBanner } from "@/components/pwa-install-banner"
import { PWAUpdateBanner } from "@/components/pwa-update-banner"
import { OfflineIndicator } from "@/components/offline-indicator"
import { useWebSocket } from "@/hooks/use-websocket"
import { useNotifications } from "@/hooks/use-notification"
import { usePWA } from "@/hooks/use-pwa"
import type { MessengerAppProps, Friend, Group, Chat, Message } from "@/types"
import { FriendRequestsModal } from "@/components/friend-requests-modal"

export function MessengerApp({ currentUser, onLogout }: MessengerAppProps) {
  const [activeView, setActiveView] = useState<"chats" | "friends" | "groups">("chats")
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [chats, setChats] = useState<Chat[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isMobile, setIsMobile] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [loading, setLoading] = useState(true)
  const [typingUsers, setTypingUsers] = useState<Record<string, number[]>>({})
  const [webSocketEnabled, setWebSocketEnabled] = useState(false) // Disabled by default
  const [showFriendRequests, setShowFriendRequests] = useState(false)

  // PWA hook for install/update functionality
  const { isInstalled, requestNotificationPermission, subscribeToPushNotifications } = usePWA()

  // Notification hook for browser notifications
  const { showNotification } = useNotifications()

  // Request notification permission and subscribe to push notifications when app loads
  useEffect(() => {
    const setupNotifications = async () => {
      const granted = await requestNotificationPermission()
      if (granted && isInstalled) {
        await subscribeToPushNotifications()
      }
    }

    setupNotifications()
  }, [isInstalled])

  // WebSocket hook for real-time functionality (disabled by default)
  const { isConnected, isConnecting, sendTyping, markMessageAsRead } = useWebSocket({
    currentUserId: currentUser.id,
    enabled: webSocketEnabled,
    onNewMessage: (newMessage: Message) => {
      setMessages((prev) => [...prev, newMessage])

      // Update chat list with new message
      setChats((prev) =>
        prev
          .map((chat) =>
            chat.id === newMessage.chatId
              ? {
                  ...chat,
                  lastMessage: newMessage.content,
                  timestamp: newMessage.timestamp,
                  unreadCount: selectedChat?.id === newMessage.chatId ? 0 : chat.unreadCount + 1,
                }
              : chat,
          )
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      )

      // Show notification if not in current chat
      if (selectedChat?.id !== newMessage.chatId) {
        const chat = chats.find((c) => c.id === newMessage.chatId)
        showNotification(
          `New message from ${newMessage.senderName}`,
          newMessage.content,
          chat?.type === "group" ? chat.name : newMessage.senderName,
        )
      }

      // Play notification sound
      playNotificationSound()
    },
    onUserStatusChange: (userId: number, status: "online" | "offline") => {
      setFriends((prev) => prev.map((friend) => (friend.id === userId ? { ...friend, status } : friend)))
    },
    onTypingUpdate: (chatId: string, userId: number, isTyping: boolean) => {
      setTypingUsers((prev) => {
        const current = prev[chatId] || []
        if (isTyping) {
          return { ...prev, [chatId]: [...current.filter((id) => id !== userId), userId] }
        } else {
          return { ...prev, [chatId]: current.filter((id) => id !== userId) }
        }
      })
    },
    onMessageRead: (chatId: string, messageId: number) => {
      // Handle message read receipts
      console.log(`Message ${messageId} read in chat ${chatId}`)
    },
  })

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audio = new Audio("/notification.mp3")
      audio.volume = 0.3
      audio.play().catch((e) => console.log("Could not play notification sound:", e))
    } catch (error) {
      console.log("Notification sound not available")
    }
  }

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Close mobile sidebar when clicking outside or pressing escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowMobileSidebar(false)
      }
    }
    if (showMobileSidebar) {
      document.addEventListener("keydown", handleEscape)
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.removeEventListener("keydown", handleEscape)
      document.body.style.overflow = "unset"
    }
  }, [showMobileSidebar])

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // Load friends, groups, and chats in parallel
        const [friendsRes, groupsRes, chatsRes] = await Promise.all([
          fetch("/api/friends"),
          fetch("/api/groups"),
          fetch("/api/chats"),
        ])

        if (friendsRes.ok) {
          const friendsData = await friendsRes.json()
          setFriends(friendsData)
        }

        if (groupsRes.ok) {
          const groupsData = await groupsRes.json()
          setGroups(groupsData)
        }

        if (chatsRes.ok) {
          const chatsData = await chatsRes.json()
          setChats(
            chatsData.sort((a: Chat, b: Chat) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
          )
        }
      } catch (error) {
        console.error("Failed to load data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Load messages for selected chat
  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedChat) return

      try {
        const response = await fetch(`/api/chats/${selectedChat.id}/messages`)
        if (response.ok) {
          const messagesData = await response.json()
          setMessages(messagesData)

          // Mark messages as read (only if WebSocket is connected)
          if (messagesData.length > 0 && isConnected) {
            const lastMessage = messagesData[messagesData.length - 1]
            markMessageAsRead(selectedChat.id, lastMessage.id)
          }
        }
      } catch (error) {
        console.error("Failed to load messages:", error)
      }
    }

    loadMessages()
  }, [selectedChat, isConnected])

  const handleSendMessage = async (content: string) => {
    if (!selectedChat) return

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId: selectedChat.id,
          content,
        }),
      })

      if (response.ok) {
        const newMessage = await response.json()

        // If WebSocket is not connected, add message directly to state
        if (!isConnected) {
          setMessages((prev) => [...prev, newMessage])
        }

        // Update the chat list
        setChats((prev) =>
          prev
            .map((chat) =>
              chat.id === selectedChat.id
                ? { ...chat, lastMessage: content, timestamp: newMessage.timestamp, unreadCount: 0 }
                : chat,
            )
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
        )
      }
    } catch (error) {
      console.error("Failed to send message:", error)
    }
  }

  const handleSendFriendRequest = async (friendData: { userId: number }) => {
    try {
      const response = await fetch("/api/friends/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(friendData),
      })

      if (response.ok) {
        // Friend request sent successfully
        // No need to update friends list since it's just a request
        console.log("Friend request sent successfully")
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to send friend request")
      }
    } catch (error) {
      console.error("Failed to send friend request:", error)
      throw error // Re-throw to handle in modal
    }
  }

  const handleUnfriend = async (friendId: number) => {
    try {
      const response = await fetch(`/api/friends/${friendId}/unfriend`, {
        method: "DELETE",
      })

      if (response.ok) {
        // Remove friend from friends list
        setFriends((prev) => prev.filter((friend) => friend.id !== friendId))

        // Remove the chat with this friend from chats list
        setChats((prev) =>
          prev.filter((chat) => {
            if (chat.type === "direct" && chat.participant?.id === friendId) {
              return false
            }
            return true
          }),
        )

        // If currently viewing the chat with this friend, close it
        if (selectedChat?.type === "direct" && selectedChat.participant?.id === friendId) {
          setSelectedChat(null)
        }

        console.log("Friend removed successfully")
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to remove friend")
      }
    } catch (error) {
      console.error("Failed to remove friend:", error)
      throw error
    }
  }

  const handleCreateGroup = async (groupData: { name: string; members: number[] }) => {
    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(groupData),
      })

      if (response.ok) {
        const newGroup = await response.json()
        setGroups((prev) => [...prev, newGroup])

        // Reload chats to include new group chat
        const chatsRes = await fetch("/api/chats")
        if (chatsRes.ok) {
          const chatsData = await chatsRes.json()
          setChats(
            chatsData.sort((a: Chat, b: Chat) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
          )
        }
      }
    } catch (error) {
      console.error("Failed to create group:", error)
    }
  }

  const getChatMessages = (chatId: string): Message[] => {
    return messages.filter((msg) => msg.chatId === chatId)
  }

  const filteredChats = chats.filter(
    (chat) =>
      chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const filteredFriends = friends.filter(
    (friend) =>
      friend.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.username.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const filteredGroups = groups.filter((group) => group.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const onlineFriends = friends.filter((friend) => friend.status === "online")

  const totalUnreadCount = chats.reduce((sum, chat) => sum + chat.unreadCount, 0)

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat)
    setShowMobileSidebar(false)
    // Mark as read
    setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, unreadCount: 0 } : c)))
  }

  const handleBackToList = () => {
    setSelectedChat(null)
  }

  const handleStartChatWithFriend = (friend: Friend) => {
    const chat = chats.find((c) => c.type === "direct" && c.participant?.id === friend.id)
    if (chat) {
      handleSelectChat(chat)
      setActiveView("chats")
    }
  }

  const handleCloseMobileSidebar = () => {
    setShowMobileSidebar(false)
  }

  const handleToggleMobileSidebar = () => {
    setShowMobileSidebar(!showMobileSidebar)
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      onLogout()
    } catch (error) {
      console.error("Logout failed:", error)
      onLogout() // Still logout on frontend even if API call fails
    }
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your conversations...</p>
        </div>
      </div>
    )
  }

  // Mobile: Show only chat window when chat is selected
  const showChatOnly = isMobile && selectedChat

  // Mobile: Show only sidebar and list when no chat is selected
  const showListOnly = isMobile && !selectedChat

  // Determine connection status for display
  const connectionStatus = webSocketEnabled
    ? isConnected
      ? "connected"
      : isConnecting
        ? "connecting"
        : "disconnected"
    : "disabled"

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 relative">
      {/* PWA Components */}
      <PWAInstallBanner />
      <PWAUpdateBanner />
      <OfflineIndicator />

      {/* Connection Status Indicator - Only show if WebSocket is enabled and having issues */}
      {webSocketEnabled && !isConnected && (
        <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">{isConnecting ? "Connecting..." : "Reconnecting..."}</span>
        </div>
      )}

      {/* Mobile Header */}
      {isMobile && (
        <MobileHeader
          currentUser={currentUser}
          activeView={activeView}
          selectedChat={selectedChat}
          onMenuClick={handleToggleMobileSidebar}
          onBack={handleBackToList}
          showMobileSidebar={showMobileSidebar}
        />
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobile && showMobileSidebar && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex w-full">
            <Sidebar
              currentUser={currentUser}
              activeView={activeView}
              onViewChange={(view) => {
                setActiveView(view)
                setShowMobileSidebar(false)
              }}
              onLogout={handleLogout}
              isMobile={true}
              onClose={handleCloseMobileSidebar}
            />
            <div
              className="flex-1 bg-black bg-opacity-50 min-w-0"
              onClick={handleCloseMobileSidebar}
              onTouchStart={handleCloseMobileSidebar}
            />
          </div>
        </div>
      )}

      {/* Desktop Sidebar - Hidden on mobile */}
      {!isMobile && (
        <DesktopSidebarV2
          currentUser={currentUser}
          activeView={activeView}
          onViewChange={setActiveView}
          onLogout={handleLogout}
          unreadCount={totalUnreadCount}
          onlineCount={onlineFriends.length}
          isConnected={connectionStatus === "connected"}
          connectionStatus={connectionStatus}
        />
      )}

      <div className="flex-1 flex">
        {/* Left Panel - Hidden on mobile when chat is selected */}
        <div
          className={`w-full md:w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col ${showChatOnly ? "hidden" : "block"} ${isMobile ? "pt-16" : ""}`}
        >
          {/* Online Friends */}
          {activeView === "chats" && onlineFriends.length > 0 && (
            <OnlineFriends friends={onlineFriends} onStartChat={handleStartChatWithFriend} />
          )}

          {/* Header with Search */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {activeView === "chats" && "Chats"}
                {activeView === "friends" && "Friends"}
                {activeView === "groups" && "Groups"}
              </h2>
              <div className="flex items-center space-x-2">
                {activeView === "friends" && (
                  <>
                    <button
                      onClick={() => setShowFriendRequests(true)}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors relative"
                      title="Friend Requests"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 17h5l-5 5-5-5h5v-12a1 1 0 011-1h4a1 1 0 011 1v12z"
                        />
                      </svg>
                      {/* Add notification badge if there are pending requests */}
                    </button>
                    <button
                      onClick={() => setShowAddFriend(true)}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Add Friend"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                    </button>
                  </>
                )}
                {activeView === "groups" && (
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Create Group"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <SearchBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeView === "chats" && (
              <ChatList
                chats={filteredChats}
                selectedChat={selectedChat}
                onSelectChat={handleSelectChat}
                searchQuery={searchQuery}
                typingUsers={webSocketEnabled ? typingUsers : {}}
              />
            )}
            {activeView === "friends" && (
              <FriendsList
                friends={filteredFriends}
                onAddFriend={() => setShowAddFriend(true)}
                onStartChat={handleStartChatWithFriend}
                onUnfriend={handleUnfriend}
                searchQuery={searchQuery}
              />
            )}
            {activeView === "groups" && (
              <GroupsList
                groups={filteredGroups}
                friends={friends}
                onCreateGroup={() => setShowCreateGroup(true)}
                onSelectGroup={(group) => {
                  const chat = chats.find((c) => c.type === "group" && c.group?.id === group.id)
                  if (chat) {
                    handleSelectChat(chat)
                    setActiveView("chats")
                  }
                }}
                searchQuery={searchQuery}
              />
            )}
          </div>
        </div>

        {/* Right Panel - Chat Window */}
        <div className={`flex-1 ${showListOnly ? "hidden" : "block"} ${isMobile ? "pt-16" : ""}`}>
          {selectedChat ? (
            <ChatWindow
              chat={selectedChat}
              messages={getChatMessages(selectedChat.id)}
              currentUser={currentUser}
              onSendMessage={handleSendMessage}
              onBack={isMobile ? handleBackToList : undefined}
              isMobile={isMobile}
              onTyping={webSocketEnabled ? (isTyping) => sendTyping(selectedChat.id, isTyping) : undefined}
              typingUsers={webSocketEnabled ? typingUsers[selectedChat.id] || [] : []}
              onUnfriend={handleUnfriend}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-white dark:bg-gray-800">
              <div className="text-center max-w-md">
                <div className="w-32 h-32 mx-auto mb-8 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-3xl flex items-center justify-center shadow-lg">
                  <svg
                    className="w-16 h-16 text-blue-500 dark:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">Ready to Chat?</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                  Select a conversation from the sidebar to start messaging, or create a new chat with friends and
                  groups.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => setActiveView("friends")}
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors shadow-lg hover:shadow-xl"
                  >
                    Add Friends
                  </button>
                  <button
                    onClick={() => setActiveView("groups")}
                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
                  >
                    Create Group
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreateGroup && (
        <CreateGroupModal
          friends={friends}
          onClose={() => setShowCreateGroup(false)}
          onCreateGroup={handleCreateGroup}
        />
      )}

      {showAddFriend && (
        <AddFriendModal
          onClose={() => setShowAddFriend(false)}
          onFriendRequestSent={() => {
            // Optional: Show success message or update UI
            console.log("Friend request sent!")
          }}
        />
      )}
      {showFriendRequests && (
        <FriendRequestsModal
          onClose={() => setShowFriendRequests(false)}
          onRequestHandled={() => {
            // Reload friends list
            const loadFriends = async () => {
              try {
                const response = await fetch("/api/friends")
                if (response.ok) {
                  const friendsData = await response.json()
                  setFriends(friendsData)
                }
              } catch (error) {
                console.error("Failed to reload friends:", error)
              }
            }
            loadFriends()
          }}
        />
      )}
    </div>
  )
}
