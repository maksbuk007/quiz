"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Send, X, Trash2, AlertTriangle, Crown, Shield } from "lucide-react"
import { ref, push, onValue, off, query, orderByChild, limitToLast, remove } from "firebase/database"
import { realtimeDb } from "@/lib/firebase/config"
import { AVATARS } from "@/components/ui/AvatarSelector"
import { toast } from "@/hooks/use-toast"
import { motion, AnimatePresence } from "framer-motion"
import { GameService } from "@/lib/firebase/gameService"

interface ChatMessage {
  id: string
  playerId: string
  playerName: string
  playerAvatar: string
  message: string
  timestamp: number
  type?: "system" | "kick" | "warning" | "normal"
}

interface AdminGameChatProps {
  gameId: string
  isOpen: boolean
  onToggle: () => void
  gameStatus: string
}

export default function AdminGameChat({ gameId, isOpen, onToggle, gameStatus }: AdminGameChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [lastReadTimestamp, setLastReadTimestamp] = useState(Date.now())

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const getAvatarDisplay = (avatarId: string) => {
    if (avatarId === "system") {
      return (
        <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-white" />
        </div>
      )
    }

    if (avatarId === "admin") {
      return (
        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
          <Crown className="w-4 h-4 text-white" />
        </div>
      )
    }

    const avatar = AVATARS.find((a) => a.id === avatarId)
    if (!avatar) {
      return <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">?</div>
    }

    return (
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${avatar.color}`}>
        {avatar.emoji}
      </div>
    )
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // ИСПРАВЛЕНО: Подписка на сообщения чата
  useEffect(() => {
    if (!gameId) return

    const chatRef = ref(realtimeDb, `sessions/${gameId}/chat`)
    const chatQuery = query(chatRef, orderByChild("timestamp"), limitToLast(100))

    const unsubscribe = onValue(chatQuery, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const messagesList = Object.values(data) as ChatMessage[]
        messagesList.sort((a, b) => a.timestamp - b.timestamp)
        setMessages(messagesList)

        // Подсчитываем непрочитанные сообщения
        if (!isOpen) {
          const unreadMessages = messagesList.filter(
            (msg) => msg.timestamp > lastReadTimestamp && msg.playerId !== "admin",
          )
          setUnreadCount(unreadMessages.length)
        }

        // Автоскролл к последнему сообщению
        setTimeout(scrollToBottom, 100)
      } else {
        setMessages([])
        setUnreadCount(0)
      }
    })

    return () => off(chatRef, "value", unsubscribe)
  }, [gameId, isOpen, lastReadTimestamp])

  // Сброс счетчика непрочитанных при открытии чата
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0)
      setLastReadTimestamp(Date.now())
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  const sendMessage = async () => {
    if (!newMessage.trim() || isLoading) return

    try {
      setIsLoading(true)
      const chatRef = ref(realtimeDb, `sessions/${gameId}/chat`)

      await push(chatRef, {
        id: `msg_${Date.now()}_admin`,
        playerId: "admin",
        playerName: "Администратор",
        playerAvatar: "admin",
        message: newMessage.trim(),
        timestamp: Date.now(),
        type: "normal",
      })

      setNewMessage("")
      scrollToBottom()
    } catch (error) {
      console.error("Ошибка отправки сообщения:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось отправить сообщение",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const sendSystemMessage = async (message: string, type: "system" | "warning" = "system") => {
    try {
      const chatRef = ref(realtimeDb, `sessions/${gameId}/chat`)

      await push(chatRef, {
        id: `msg_${Date.now()}_system`,
        playerId: "system",
        playerName: "Система",
        playerAvatar: "system",
        message,
        timestamp: Date.now(),
        type,
      })

      scrollToBottom()
    } catch (error) {
      console.error("Ошибка отправки системного сообщения:", error)
    }
  }

  const clearChat = async () => {
    try {
      const chatRef = ref(realtimeDb, `sessions/${gameId}/chat`)
      await remove(chatRef)

      toast({
        title: "Чат очищен",
        description: "Все сообщения удалены",
      })
    } catch (error) {
      console.error("Ошибка очистки чата:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось очистить чат",
        variant: "destructive",
      })
    }
  }

  const deleteMessage = async (messageId: string) => {
    try {
      await GameService.deleteMessage(gameId, messageId)
      toast({
        title: "Сообщение удалено",
        description: "Сообщение успешно удалено из чата",
      })
    } catch (error) {
      console.error("Ошибка удаления сообщения:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось удалить сообщение",
        variant: "destructive",
      })
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getMessageStyle = (message: ChatMessage) => {
    switch (message.type) {
      case "system":
        return "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200"
      case "kick":
        return "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200"
      case "warning":
        return "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200"
      default:
        return message.playerId === "admin"
          ? "bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800"
          : "bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700"
    }
  }

  const quickMessages = [
    "Добро пожаловать в игру! 🎉",
    "Приготовьтесь к следующему вопросу! ⚡",
    "Отличная игра! 👏",
    "Время почти истекло! ⏰",
    "Поздравляем с правильным ответом! 🎯",
  ]

  if (!isOpen) {
    return (
      <motion.div
        className="fixed bottom-4 right-4 z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Button
          onClick={onToggle}
          size="lg"
          className="rounded-full shadow-lg bg-purple-600 hover:bg-purple-700 relative"
        >
          <MessageSquare className="w-6 h-6" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 px-2 py-1 text-xs min-w-[20px] h-5 flex items-center justify-center"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]"
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <Card className="shadow-2xl border-2 border-purple-200 dark:border-purple-800">
        <CardHeader className="pb-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span>Чат администратора</span>
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                {messages.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                className="text-white hover:bg-white/20 p-1 h-8 w-8"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onToggle} className="text-white hover:bg-white/20 p-1 h-8 w-8">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {/* Область сообщений */}
          <ScrollArea className="h-80 p-4">
            <div className="space-y-3">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`p-3 rounded-lg border ${getMessageStyle(message)} group relative`}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMessage(message.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                    <div className="flex items-start gap-3">
                      {getAvatarDisplay(message.playerAvatar)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{message.playerName}</span>
                          {message.playerId === "admin" && (
                            <Badge variant="secondary" className="text-xs px-1 py-0">
                              Админ
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">{formatTime(message.timestamp)}</span>
                        </div>
                        {/* ИСПРАВЛЕНО: Правильный перенос длинных сообщений */}
                        <p className="text-sm break-words whitespace-pre-wrap overflow-wrap-anywhere">
                          {message.message}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Пока нет сообщений</p>
                  <p className="text-sm">Начните общение с игроками!</p>
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Быстрые сообщения */}
          <div className="p-3 border-t bg-gray-50 dark:bg-gray-800">
            <div className="flex flex-wrap gap-1 mb-3">
              {quickMessages.map((msg, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs h-6 px-2 bg-transparent"
                  onClick={() => setNewMessage(msg)}
                >
                  {msg}
                </Button>
              ))}
            </div>
          </div>

          {/* Поле ввода */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Написать сообщение..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || isLoading}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            {/* Дополнительные кнопки */}
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => sendSystemMessage("⚠️ Внимание! Соблюдайте правила игры.", "warning")}
                className="text-xs"
              >
                Предупреждение
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => sendSystemMessage("🎯 Игра началась! Удачи всем участникам!")}
                className="text-xs"
              >
                Объявление
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
