import {  Link, redirect, type ActionFunction, type LoaderFunction, type MetaFunction } from "react-router";
import { useLoaderData, useActionData, useFetcher, useNavigate, useParams } from "react-router";
import React, { useState, useRef, useEffect } from 'react';
import { Send, Search, MoreVertical,  Video, Paperclip, Smile, Users, Clock, CheckCheck, ArrowLeft, Menu, UserPlus, X, House } from 'lucide-react';
import { getChatMessageModel } from '~/models/chats.server';
import { getUserModel } from '~/models/user.server';

interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  lastMessage?: {
    message: string;
    createdAt: string | Date;
    senderType: 'user' | 'admin';
    status: string;
  };
  unreadCount: number;
  status: 'online' | 'offline' | 'away';
  firstName: string;
  lastName: string;
}

interface Message {
  _id: string;
  userId: string;
  message: string;
  createdAt: string;
  senderType: 'user' | 'admin';
  status: 'sent' | 'delivered' | 'read';
}

interface LoaderData {
  users: User[];
  messages: Message[];
  selectedUserId?: string;
}

interface ActionData {
  success?: boolean;
  error?: string;
  message?: Message;
  searchResults?: User[];
  newConversation?: {
    user: User;
    message: Message;
  };
}

import settings from '~/assets/settings.json';
import { requireAdminSession } from "~/utils/admin.server";
export const meta: MetaFunction = () => {
  return [
    {title: `Chats | ${settings.site.title}`},
  ];
};

// Loader function to get all conversations and messages
export const loader: LoaderFunction = async ({ request, params }) => {
  try {
    const admin =  await requireAdminSession(request);
    if (!admin.adminId) {
      return redirect('/');
    }
    const url = new URL(request.url);
    const selectedUserId = params.userId || url.searchParams.get('userId');
    
    const ChatMessage = await getChatMessageModel();
   

    // Get all users with conversations
    const conversations = await ChatMessage.getAllUserConversations();
    
    // Transform conversations to match your User interface
    const users: User[] = conversations.map((conv: any) => ({
      _id: conv.userId.toString(),
      name: `${conv.user.firstName || conv.user.name} ${conv.user.lastName || ''}`.trim(),
      email: conv.user.email,
      avatar: conv.user?.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.user.firstName || conv.user.name)}&background=random`,
      firstName: conv.user.firstName,
      lastName: conv.user.lastName,
      lastMessage: conv.lastMessage ? {
        message: conv.lastMessage.message,
        createdAt: conv.lastMessage.createdAt,
        senderType: conv.lastMessage.senderType,
        status: conv.lastMessage.status
      } : undefined,
      unreadCount: conv.unreadCount || 0,
      status: 'offline' as const // You can implement online/offline logic based on lastSeen
    }));

    // Get messages for selected user if any
    let messages: Message[] = [];
    if (selectedUserId) {
      const userMessages = await ChatMessage.getUserConversation(selectedUserId);
      messages = userMessages.map((msg: any) => ({
        _id: msg._id.toString(),
        userId: msg.userId.toString(),
        message: msg.message,
        createdAt: msg.createdAt,
        senderType: msg.senderType,
        status: msg.status
      }));

      // Mark user messages as read when admin opens conversation
      await ChatMessage.markUserMessagesAsRead(selectedUserId);
    }

    return Response.json({
      users,
      messages,
      selectedUserId
    });

  } catch (error) {
    console.error('Loader error:', error);
    throw new Response("Error loading chat data", { status: 500 });
  }
};

// Action function to handle sending messages and searching users
export const action: ActionFunction = async ({ request }) => {
  try {
    const formData = await request.formData();
    const intent = formData.get("intent");

    const ChatMessage = await getChatMessageModel();
    const UserModel = await getUserModel();

    if (intent === "send_message") {
      const userId = formData.get("userId") as string;
      const message = formData.get("message") as string;
      const senderType = formData.get("senderType") as "user" | "admin";

      if (!userId || !message || !senderType) {
        return Response.json({ error: "Missing required fields" }, { status: 400 });
      }

      let savedMessage;
      
      if (senderType === "admin") {
        savedMessage = await ChatMessage.sendAdminMessage(userId, message);
      } else {
        savedMessage = await ChatMessage.sendUserMessage(userId, message);
      }

      return Response.json({
        success: true,
        message: {
          _id: savedMessage._id.toString(),
          userId: savedMessage.userId.toString(),
          message: savedMessage.message,
          createdAt: savedMessage.createdAt,
          senderType: savedMessage.senderType,
          status: savedMessage.status
        }
      });
    }

    if (intent === "search_users") {
      const query = formData.get("query") as string;
      
      if (!query || query.trim().length < 2) {
        return Response.json({ error: "Search query must be at least 2 characters" }, { status: 400 });
      }

      // Search users by email or name
      const users = await UserModel.find({
        $or: [
          { email: { $regex: query.trim(), $options: 'i' } },
          { firstName: { $regex: query.trim(), $options: 'i' } },
          { lastName: { $regex: query.trim(), $options: 'i' } }
        ]
      })
      .select('_id firstName lastName email avatar')
      .limit(10)
      .lean();

      const searchResults: User[] = users.map((user: any) => ({
        _id: user._id.toString(),
        name: `${user.firstName} ${user.lastName || ''}`.trim(),
        email: user.email,
        avatar: user?.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.firstName)}&background=random`,
        firstName: user.firstName,
        lastName: user.lastName || '',
        unreadCount: 0,
        status: 'offline' as const
      }));

      return Response.json({
        success: true,
        searchResults
      });
    }

    if (intent === "start_conversation") {
      const userId = formData.get("userId") as string;
      const message = formData.get("message") as string;

      if (!userId || !message) {
        return Response.json({ error: "Missing required fields" }, { status: 400 });
      }

      // Get user details
      const user = await UserModel.findById(userId).select('_id firstName lastName email').lean();
      if (!user) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }

      // Send the message
      const savedMessage = await ChatMessage.sendAdminMessage(userId, message);

      const userFormatted: User = {
        _id: user._id.toString(),
        name: `${user.firstName} ${user.lastName || ''}`.trim(),
        email: user.email,
        avatar: user.avatar.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.firstName)}&background=random`,
        firstName: user.firstName,
        lastName: user.lastName || '',
        unreadCount: 0,
        status: 'offline' as const,
        lastMessage: {
          message: savedMessage.message,
          createdAt: savedMessage.createdAt,
          senderType: savedMessage.senderType,
          status: savedMessage.status
        }
      };

      return Response.json({
        success: true,
        newConversation: {
          user: userFormatted,
          message: {
            _id: savedMessage._id.toString(),
            userId: savedMessage.userId.toString(),
            message: savedMessage.message,
            createdAt: savedMessage.createdAt,
            senderType: savedMessage.senderType,
            status: savedMessage.status
          }
        }
      });
    }

    if (intent === "mark_as_read") {
      const messageIds = JSON.parse(formData.get("messageIds") as string);
      await ChatMessage.markAsRead(messageIds);
      return Response.json({ success: true });
    }

    return Response.json({ error: "Invalid intent" }, { status: 400 });

  } catch (error) {
    console.error('Action error:', error);
    return Response.json({ error: "Server error occurred" }, { status: 500 });
  }
};

export default function AdminChatPage() {
  const { users: initialUsers, messages: initialMessages, selectedUserId } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  const fetcher = useFetcher();
  const searchFetcher = useFetcher();
  const navigate = useNavigate();
  const params = useParams();
  
  const [users, setUsers] = useState<User[]>(initialUsers || []);
  const [selectedUser, setSelectedUser] = useState<User | null>(
    selectedUserId ? users.find(u => u._id === selectedUserId) || users[0] || null : users[0] || null
  );
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [newConversationMessage, setNewConversationMessage] = useState('');
  const [selectedNewUser, setSelectedNewUser] = useState<User | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Filter users based on search query
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );
const textRef = useRef<HTMLTextAreaElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update messages when loader data changes
  useEffect(() => {
    setMessages(initialMessages || []);
  }, [initialMessages]);

  // Update users when loader data changes
  useEffect(() => {
    setUsers(initialUsers || []);
  }, [initialUsers]);

  // Handle successful message send
  useEffect(() => {
    if (actionData?.success && actionData.message) {
      setMessages(prev => [...prev, actionData.message!]);
      setNewMessage('');
      
    }
  }, [actionData]);

  // Handle search results from searchFetcher
  useEffect(() => {
    if (searchFetcher.data?.success && searchFetcher.data.searchResults) {
      setSearchResults(searchFetcher.data.searchResults);
    }
  }, [searchFetcher.data]);

  // Handle new conversation creation
  useEffect(() => {
    if (actionData?.success && actionData.newConversation) {
      const { user: newUser, message } = actionData.newConversation;
      
      // Add user to the list if not already present
      setUsers(prev => {
        const existingUser = prev.find(u => u._id === newUser._id);
        if (!existingUser) {
          return [newUser, ...prev];
        } else {
          // Update existing user with new last message
          return prev.map(u => u._id === newUser._id ? { ...u, lastMessage: newUser.lastMessage } : u);
        }
      });

      // Set as selected user and add message
      setSelectedUser(newUser);
      setMessages([message]);
      setShowNewConversation(false);
      setUserSearchQuery('');
      setSearchResults([]);
      setSelectedNewUser(null);
      setNewConversationMessage('');

  // Navigate to the new conversation using query param
  navigate(`/chats?userId=${newUser._id}`);
    }
  }, [actionData, navigate]);

  const handleUserSelect = (user: User) => {
  setSelectedUser(user);
  setShowSidebar(false);
  setShowNewConversation(false);
  // Navigate to the user's conversation using query param
  navigate(`/chats?userId=${user._id}`);
  };

const handleSendMessage = () => {
  if (newMessage.trim() && selectedUser) {
    const messageToSend = newMessage.trim();
    // Clear the message state before sending
    setNewMessage('');
    
    // Use fetcher to send message
    fetcher.submit(
      {
        intent: "send_message",
        userId: selectedUser._id,
        message: messageToSend,
        senderType: "admin"
      },
      { method: "post" }
    );
  }
};

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleUserSearch = () => {
    if (userSearchQuery.trim().length >= 2) {
      searchFetcher.submit(
        {
          intent: "search_users",
          query: userSearchQuery.trim()
        },
        { method: "post" }
      );
    }
  };

  const handleStartConversation = () => {
    if (selectedNewUser && newConversationMessage.trim()) {
      fetcher.submit(
        {
          intent: "start_conversation",
          userId: selectedNewUser._id,
          message: newConversationMessage.trim()
        },
        { method: "post" }
      );
      setShowNewConversation(false);
      setUserSearchQuery('');
      setSearchResults([]);
      setSelectedNewUser(null);
      setNewConversationMessage('');
    }
  };

  const getStatusColor = (status: User['status']) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-400';
    }
  };

  const getMessageStatus = (message: Message) => {
    if (message.senderType !== 'admin') return null;
    
    switch (message.status) {
      case 'sent': return <Clock className="w-3 h-3 text-gray-400" />;
      case 'delivered': return <CheckCheck className="w-3 h-3 text-gray-400" />;
      case 'read': return <CheckCheck className="w-3 h-3 text-blue-500" />;
    }
  };

  const formatTimestamp = (dateString: string | Date) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hour${Math.floor(diffInMinutes / 60) > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffInMinutes / 1440)} day${Math.floor(diffInMinutes / 1440) > 1 ? 's' : ''} ago`;
  };

  const formatMessageTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!selectedUser && users.length === 0 && !showNewConversation) {
    return (
      <div className="min-h-screen h-screen bg-gray-50 flex items-center justify-center overflow-hidden">
        <div className="text-center p-6">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No conversations yet</h2>
          <p className="text-gray-500 mb-4">Start a conversation with any user by searching their email.</p>
          <button
            onClick={() => setShowNewConversation(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Start New Conversation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 overflow-hidden flex flex-col">
      {/* Mobile-first layout */}
      <div className="flex flex-1 h-full overflow-hidden">
        {/* Sidebar - Hidden on mobile by default */}
        <div className={`
          fixed inset-y-0 left-0 z-50 w-full max-w-sm bg-white border-r border-gray-200 flex flex-col
          transform transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0 md:w-80 md:max-w-none md:flex md:z-auto
          ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0 bg-white">
            <Link to="/admin" className="flex items-center space-x-2">
              <House className="w-5 h-5 text-gray-500" />
            </Link>
            <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setShowNewConversation(true);
                  setShowSidebar(false);
                }}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Start new conversation"
              >
                <UserPlus className="w-5 h-5" />
              </button>
              <button 
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                onClick={() => setShowSidebar(false)}
              >
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-gray-200 flex-shrink-0 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* User List - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            {filteredUsers.map((user) => (
              <div
                key={user._id}
                className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedUser?._id === user._id ? 'bg-blue-50 border-blue-200' : ''
                }`}
                onClick={() => handleUserSelect(user)}
              >
                <div className="flex items-start space-x-3">
                  <div className="relative flex-shrink-0">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover"
                    />
                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 md:w-4 md:h-4 rounded-full border-2 border-white ${getStatusColor(user.status)}`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900 truncate">{user.name}</h3>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {user.lastMessage ? formatTimestamp(user.lastMessage.createdAt) : ''}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    <p className="text-sm text-gray-600 truncate mt-1">
                      {user.lastMessage ? user.lastMessage.message : 'No messages yet'}
                    </p>
                  </div>
                  
                  {user.unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-5 text-center flex-shrink-0">
                      {user.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {filteredUsers.length === 0 && searchQuery && (
              <div className="p-4 text-center text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>No conversations found</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile overlay */}
        {showSidebar && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Chat Area or New Conversation */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {showNewConversation ? (
            // New Conversation Modal
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* New Conversation Header */}
              <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Start New Conversation</h2>
                  <button
                    onClick={() => {
                      setShowNewConversation(false);
                      setUserSearchQuery('');
                      setSearchResults([]);
                      setSelectedNewUser(null);
                      setNewConversationMessage('');
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* User Search */}
              <div className="p-4 border-b border-gray-200 flex-shrink-0 bg-white">
                <div className="flex space-x-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search by email, first name, or last name..."
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleUserSearch();
                        }
                      }}
                    />
                  </div>
                  <button
                    onClick={handleUserSearch}
                    disabled={userSearchQuery.trim().length < 2 || searchFetcher.state === 'submitting'}
                    className="px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {searchFetcher.state === 'submitting' ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      'Search'
                    )}
                  </button>
                </div>
              </div>

              {/* Search Results - Scrollable */}
              <div className="flex-1 overflow-y-auto p-4">
                {searchResults.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Select a user to start conversation:</h3>
                    {searchResults.map((user) => (
                      <div
                        key={user._id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedNewUser?._id === user._id 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                        onClick={() => setSelectedNewUser(user)}
                      >
                        <div className="flex items-center space-x-3">
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">{user.name}</h4>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : userSearchQuery && searchFetcher.state === 'idle' ? (
                  <div className="text-center text-gray-500 mt-8">
                    <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>No users found matching "{userSearchQuery}"</p>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 mt-8">
                    <Search className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Search for users by email or name to start a conversation</p>
                  </div>
                )}
              </div>

              {/* Message Input for New Conversation */}
              {selectedNewUser && (
                <div className="bg-white border-t border-gray-200 p-4 flex-shrink-0">
                  <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-900">
                      Starting conversation with <strong>{selectedNewUser.name}</strong> ({selectedNewUser.email})
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <textarea
                      placeholder="Type your first message..."
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[44px] max-h-32"
                      value={newConversationMessage}
                      onChange={(e) => setNewConversationMessage(e.target.value)}
                      rows={2}
                    />
                    <button
                      onClick={handleStartConversation}
                      disabled={!newConversationMessage.trim() || fetcher.state === 'submitting'}
                      className="px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      {fetcher.state === 'submitting' ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : selectedUser ? (
            // Regular Chat Interface
            <div className="flex flex-col h-full overflow-hidden">
              {/* Chat Header */}
              <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0">
                    <button 
                      className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                      onClick={() => setShowSidebar(true)}
                    >
                      <Menu className="w-5 h-5 text-gray-600" />
                    </button>
                    
                    <div className="relative flex-shrink-0">
                      <img
                        src={selectedUser.avatar}
                        alt={selectedUser.name}
                        className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover"
                      />
                      <div className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full border-2 border-white ${getStatusColor(selectedUser.status)}`} />
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base md:text-lg font-medium text-gray-900 truncate">{selectedUser.name}</h2>
                      <p className="text-xs md:text-sm text-gray-500 capitalize">{selectedUser.status}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 md:space-x-2 flex-shrink-0">
                    <button className="p-1.5 md:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                      <Video className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                    <button className="p-1.5 md:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                      <MoreVertical className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages - Scrollable area with proper height */}
              <div className="flex-1  overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 bg-gray-50" style={{ minHeight: 0 }}>
                {messages
                  .filter(message => message.userId === selectedUser._id)
                  .map((message) => (
                  <div
                    key={message._id}
                    className={`flex ${message.senderType === 'admin' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[75%] md:max-w-xs lg:max-w-md px-3 md:px-4 py-2.5 rounded-2xl ${
                      message.senderType === 'admin'
                        ? 'bg-blue-500 text-white rounded-br-sm'
                        : 'bg-white text-gray-900 rounded-bl-sm shadow-sm border border-gray-100'
                    }`}>
                      <p className="text-sm md:text-base leading-relaxed break-words">{message.message}</p>
                      <div className={`flex items-center justify-end mt-1.5 space-x-1 ${
                        message.senderType === 'admin' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        <span className="text-xs">{formatMessageTime(message.createdAt)}</span>
                        {getMessageStatus(message)}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input - Fixed at bottom */}
              <div className="bg-white border-t  border-gray-200 p-3 md:p-4 flex-shrink-0">
                <div className="flex items-center items-en space-x-2 md:space-x-3">
                  <button className="hidden md:flex p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  
                  <div className="flex-1 relative">
                    <textarea
                      placeholder="Type your message..."
                      className="w-full px-3 md:px-4 py-2.5 md:py-3 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 md:pr-12 text-sm md:text-base resize-none min-h-[44px] max-h-32"
                      value={newMessage}
                      ref={textRef}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      rows={1}
                    />
                    <button className="absolute right-2 bottom-2.5 md:bottom-3 p-1 text-gray-400 hover:text-gray-600 transition-colors">
                      <Smile className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                  </div>
                  
                  <button
                    onClick={handleSendMessage}
                    className="p-2.5 md:p-3 bg-blue-500 text-white rounded-2xl hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    disabled={!newMessage.trim() || fetcher.state === 'submitting'}
                  >
                    {fetcher.state === 'submitting' ? (
                      <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 md:w-5 md:h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // No conversation selected
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-6">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Select a conversation</h2>
                <p className="text-gray-500 mb-4">Choose a conversation from the sidebar or start a new one.</p>
                <button
                  onClick={() => setShowNewConversation(true)}
                  className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Start New Conversation
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {actionData?.error && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          {actionData.error}
        </div>
      )}

      {/* Success Display */}
      {actionData?.success && actionData.newConversation && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          New conversation started successfully!
        </div>
      )}
    </div>
  );
}