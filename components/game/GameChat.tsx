"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { AVATARS } from "@/components/ui/AvatarSelector"
import { ref, onValue, off, push, set, update, remove } from "firebase/database"
import { realtimeDb } from "@/lib/firebase/config"
import type { ChatMessage } from "@/types/game"
import { Send, X, MessageCircle, Crown, Trophy, AlertTriangle, Volume2, VolumeX, ArrowDown, Trash2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

interface GameChatProps {
  gameId: string
  playerId: string
  playerName: string
  playerAvatar: string
  isOpen: boolean
  onClose: () => void
  isHost?: boolean
  isMuted?: boolean
  className?: string
}

interface ChatMessageWithKey extends ChatMessage {
  firebaseKey: string
}

export default function GameChat({
  gameId,
  playerId,
  playerName,
  playerAvatar,
  isOpen,
  onClose,
  isHost = false,
  isMuted = false,
  className = "",
}: GameChatProps) {
  const [messages, setMessages] = useState<ChatMessageWithKey[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [showScrollButton, setShowScrollButton] = useState(false)

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Автоматическая прокрутка вниз
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    scrollAreaRef.current?.scrollTo({
      top: scrollAreaRef.current.scrollHeight,
      behavior,
    })
  }, [])

  // Отслеживание положения прокрутки
  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollArea
      setShowScrollButton(scrollHeight - (scrollTop + clientHeight) > 100)
    }

    scrollArea.addEventListener("scroll", handleScroll)
    return () => scrollArea.removeEventListener("scroll", handleScroll)
  }, [])

  // Получение аватара
  const getAvatarDisplay = useCallback((avatarId: string) => {
    const avatar = AVATARS.find((a) => a.id === avatarId)
    return avatar ? (
      <div
        className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-sm sm:text-lg ${avatar.color}`}
      >
        {avatar.emoji}
      </div>
    ) : (
      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center text-xs">?</div>
    )
  }, [])

  // Воспроизведение звука
  const playSound = useCallback(
    (type: "message" | "system" | "achievement") => {
      if (!soundEnabled) return

      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        const frequencies = {
          message: 800,
          system: 600,
          achievement: 1000,
        }

        oscillator.frequency.setValueAtTime(frequencies[type], audioContext.currentTime)
        gainNode.gain.setValueAtTime(type === "achievement" ? 0.2 : 0.1, audioContext.currentTime)

        oscillator.start()
        oscillator.stop(audioContext.currentTime + 0.1)
      } catch (error) {
        console.warn("Не удалось воспроизвести звук:", error)
      }
    },
    [soundEnabled],
  )

  const FORBIDDEN_WORDS = ["плохоеслово1", "плохоеслово2", "плохоеслово3"]

  const checkForbiddenWords = (message: string): boolean => {
    const lowerMessage = message.toLowerCase()
    return FORBIDDEN_WORDS.some((word) => lowerMessage.includes(word.toLowerCase()))
  }

  // Подписка на сообщения чата
  useEffect(() => {
    if (!gameId || !isOpen) return

    const chatRef = ref(realtimeDb, `sessions/${gameId}/chat`)
    const usersRef = ref(realtimeDb, `sessions/${gameId}/players`)

    const unsubscribeChat = onValue(chatRef, (snapshot) => {
      const data = snapshot.val()
      if (!data) {
        setMessages([])
        return
      }

      const messagesList: ChatMessageWithKey[] = Object.entries(data)
        .filter(([key]) => key !== "undefined" && key.startsWith("-")) // Firebase push keys start with "-"
        .map(([fbKey, msgData]: [string, any]) => ({
          id: msgData.id || fbKey,
          firebaseKey: fbKey, // Store the actual Firebase push key
          playerId: msgData.playerId || "",
          playerName: msgData.playerName || "Unknown",
          playerAvatar: msgData.playerAvatar || "",
          message: msgData.message || "",
          timestamp: msgData.timestamp || Date.now(),
          type: msgData.type || "user",
        }))
        .sort((a, b) => a.timestamp - b.timestamp)

      setMessages((prev) => {
        if (messagesList.length > prev.length && prev.length > 0) {
          const lastMessage = messagesList[messagesList.length - 1]
          if (lastMessage.playerId !== playerId) {
            playSound(
              lastMessage.type === "achievement" ? "achievement" : lastMessage.type === "system" ? "system" : "message",
            )
          }
        }
        return messagesList
      })
    })

    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const players = snapshot.val()
      setOnlineUsers(players ? Object.keys(players).filter((id) => players[id]?.isConnected) : [])
    })

    return () => {
      off(chatRef, "value", unsubscribeChat)
      off(usersRef, "value", unsubscribeUsers)
    }
  }, [gameId, isOpen, playerId, playSound])

  // Автопрокрутка при новых сообщениях
  useEffect(() => {
    if (!isOpen || messages.length === 0) return
    scrollToBottom("auto")
  }, [messages, isOpen, scrollToBottom])

  // Фокус на поле ввода при открытии
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Отправка сообщения
  const sendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!newMessage.trim() || loading || isMuted) return

      if (checkForbiddenWords(newMessage)) {
        toast({
          title: "Сообщение заблокировано",
          description: "Ваше сообщение содержит запрещенные слова",
          variant: "destructive",
        })

        try {
          const warningRef = ref(realtimeDb, `sessions/${gameId}/warnings/${playerId}`)
          const currentWarnings = await new Promise<number>((resolve) => {
            onValue(
              warningRef,
              (snapshot) => {
                resolve(snapshot.val() || 0)
              },
              { onlyOnce: true },
            )
          })

          const newWarnings = currentWarnings + 1
          await update(warningRef, { count: newWarnings, lastWarning: Date.now() })

          if (newWarnings >= 3) {
            const playerRef = ref(realtimeDb, `sessions/${gameId}/players/${playerId}`)
            await update(playerRef, { isMuted: true, mutedAt: Date.now() })

            toast({
              title: "Вы заблокированы в чате",
              description: "Вы получили 3 предупреждения за использование запрещенных слов",
              variant: "destructive",
            })
          } else {
            toast({
              title: `Предупреждение ${newWarnings}/3`,
              description: "При 3 предупреждениях вы будете заблокированы в чате",
              variant: "destructive",
            })
          }
        } catch (error) {
          console.error("Ошибка обработки предупреждения:", error)
        }

        setNewMessage("")
        return
      }

      setLoading(true)
      try {
        const messageData = {
          playerId,
          playerName,
          playerAvatar,
          message: newMessage.trim(),
          timestamp: Date.now(),
          type: "user",
        }

        const chatRef = ref(realtimeDb, `sessions/${gameId}/chat`)
        const newMessageRef = push(chatRef)
        await set(newMessageRef, messageData)

        setNewMessage("")
        setTimeout(() => inputRef.current?.focus(), 50)
      } catch (error) {
        console.error("Ошибка отправки сообщения:", error)
      } finally {
        setLoading(false)
      }
    },
    [gameId, playerId, playerName, playerAvatar, newMessage, loading, isMuted],
  )

  // Форматирование времени
  const formatTime = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }, [])

  // Получение иконки типа сообщения
  const getMessageIcon = useCallback((type?: string) => {
    switch (type) {
      case "system":
        return <AlertTriangle className="w-3 h-3" />
      case "achievement":
        return <Trophy className="w-3 h-3 text-yellow-500" />
      case "warning":
        return <AlertTriangle className="w-3 h-3 text-red-500" />
      default:
        return null
    }
  }, [])

  const deleteMessage = useCallback(
    async (firebaseKey: string) => {
      if (!isHost || !firebaseKey || firebaseKey === "undefined") {
        console.warn("[v0] Cannot delete message - invalid firebaseKey:", firebaseKey)
        return
      }

      console.log("[v0] Deleting message with firebaseKey:", firebaseKey, "from game:", gameId)

      try {
        // Optimistically remove from local state first
        setMessages((prev) => prev.filter((msg) => msg.firebaseKey !== firebaseKey))

        // Remove from Firebase using the exact push key path
        const messageRef = ref(realtimeDb, `sessions/${gameId}/chat/${firebaseKey}`)
        await remove(messageRef)

        console.log("[v0] Message successfully deleted")

        toast({
          title: "Сообщение удалено",
          description: "Сообщение успешно удалено из чата",
        })
      } catch (error) {
        console.error("[v0] Error deleting message:", error)
        toast({
          title: "Ошибка",
          description: "Не удалось удалить сообщение",
          variant: "destructive",
        })
      }
    },
    [gameId, isHost],
  )

  const handleClearChat = useCallback(async () => {
    if (!isHost) return

    try {
      // Optimistically clear local state
      setMessages([])

      const chatRef = ref(realtimeDb, `sessions/${gameId}/chat`)
      await remove(chatRef)

      toast({
        title: "Чат очищен",
        description: "Все сообщения успешно удалены",
      })
    } catch (error) {
      console.error("[v0] Error clearing chat:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось очистить чат",
        variant: "destructive",
      })
    }
  }, [gameId, isHost])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className={`w-full max-w-md h-[80vh] flex flex-col bg-background ${className}`}>
        <CardHeader className="flex-shrink-0 pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isHost ? (
                <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Crown className="w-4 h-4 text-primary" />
                </div>
              ) : (
                <MessageCircle className="w-5 h-5" />
              )}
              <CardTitle className="text-lg">{isHost ? "Чат администратора" : "Чат игры"}</CardTitle>
              <Badge variant="outline" className="text-xs">
                {messages.filter((m) => m.playerId !== "system").length}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              {isHost && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearChat}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  aria-label="Очистить чат"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="h-8 w-8 p-0"
                aria-label={soundEnabled ? "Выключить звук" : "Включить звук"}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0" aria-label="Закрыть чат">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
          <ScrollArea ref={scrollAreaRef} className="flex-1 px-4" style={{ height: "calc(100% - 64px)" }}>
            <div className="space-y-3 py-4 min-h-full">
              {messages.filter((m) => m.playerId !== "system").length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Пока нет сообщений</p>
                  <p className="text-xs">Начните общение!</p>
                </div>
              ) : (
                messages
                  .filter((m) => m.playerId !== "system")
                  .map((message) => (
                    <div
                      key={message.firebaseKey}
                      className={`relative group rounded-xl p-3 transition-all ${
                        message.playerId === playerId ? "bg-primary text-primary-foreground ml-8" : "bg-muted mr-8"
                      }`}
                    >
                      {isHost && message.firebaseKey && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            console.log("[v0] Delete button clicked for firebaseKey:", message.firebaseKey)
                            deleteMessage(message.firebaseKey)
                          }}
                          className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center z-10 bg-destructive hover:bg-destructive/90 rounded-full shadow-md cursor-pointer"
                          title="Удалить сообщение"
                        >
                          <X className="w-3 h-3 text-destructive-foreground" />
                        </button>
                      )}

                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0">{getAvatarDisplay(message.playerAvatar || "")}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-medium truncate">
                              {message.playerName}
                              {message.playerId === playerId && " (Вы)"}
                            </span>
                            <span
                              className={`text-xs ${message.playerId === playerId ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                            >
                              {formatTime(message.timestamp)}
                            </span>
                          </div>
                          <p
                            className="text-sm break-words"
                            style={{
                              wordBreak: "break-word",
                              overflowWrap: "break-word",
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {message.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {showScrollButton && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => scrollToBottom()}
                className="sticky bottom-2 left-full transform -translate-x-12 z-10 shadow-md"
              >
                <ArrowDown className="w-4 h-4" />
              </Button>
            )}
          </ScrollArea>

          {/* Quick messages for host */}
          {isHost && (
            <div className="border-t px-4 py-3 bg-muted/30">
              <div className="flex flex-wrap gap-2">
                {[
                  { text: "Добро пожаловать в игру! 🎉", emoji: "🎉" },
                  { text: "Приготовьтесь к следующему вопросу! ⚡", emoji: "⚡" },
                  { text: "Отличная игра! 👏", emoji: "👏" },
                  { text: "Время почти истекло! 🕐", emoji: "🕐" },
                  { text: "Поздравляем с правильным ответом! 🎯", emoji: "🎯" },
                ].map((quick, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={async () => {
                      const messageData = {
                        playerId: "admin",
                        playerName: "Администратор",
                        playerAvatar: "admin",
                        message: quick.text,
                        timestamp: Date.now(),
                        type: "normal",
                      }
                      const chatRef = ref(realtimeDb, `sessions/${gameId}/chat`)
                      const newMessageRef = push(chatRef)
                      await set(newMessageRef, messageData)
                    }}
                    className="text-xs px-2 py-1 rounded-md bg-background hover:bg-muted border transition-colors"
                  >
                    {quick.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t p-4">
            {isMuted ? (
              <div className="text-center text-sm text-muted-foreground py-2">
                <VolumeX className="w-4 h-4 mx-auto mb-1" />
                Вы не можете отправлять сообщения
              </div>
            ) : (
              <form onSubmit={sendMessage} className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Введите сообщение..."
                  disabled={loading}
                  maxLength={500}
                  className="flex-1"
                />
                <Button type="submit" size="sm" disabled={loading || !newMessage.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
