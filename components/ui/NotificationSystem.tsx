"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { SoundService } from "@/lib/services/soundService"
import { AVATARS } from "@/components/ui/AvatarSelector"
import type { GameNotification } from "@/types/game"
import { X, Trophy, Users, Play, Square, MessageCircle, Info } from "lucide-react"

interface NotificationSystemProps {
  notifications?: GameNotification[]
  onDismiss?: (notificationId: string) => void
  soundEnabled?: boolean
}

interface DisplayNotification extends GameNotification {
  isVisible: boolean
  timeLeft: number
}

export function NotificationSystem({
  notifications = [],
  onDismiss = () => {},
  soundEnabled = true,
}: NotificationSystemProps) {
  const [displayNotifications, setDisplayNotifications] = useState<DisplayNotification[]>([])

  // Добавление новых уведомлений
  useEffect(() => {
    if (!notifications || !Array.isArray(notifications)) return

    notifications.forEach((notification) => {
      if (!notification) return

      const exists = displayNotifications.find((n) => n.id === notification.id)
      if (!exists) {
        const newNotification: DisplayNotification = {
          ...notification,
          isVisible: true,
          timeLeft: 5000, // 5 секунд
        }

        setDisplayNotifications((prev) => [...prev, newNotification])

        // Воспроизводим звук
        if (soundEnabled) {
          try {
            switch (notification.type) {
              case "player_joined":
                SoundService.playPlayerJoined()
                break
              case "game_started":
                SoundService.playGameStart()
                break
              case "game_ended":
                SoundService.playGameEnd()
                break
              case "achievement_unlocked":
                SoundService.playAchievement()
                break
              default:
                SoundService.playNotification()
            }
          } catch (error) {
            console.error("Error playing notification sound:", error)
          }
        }

        // Автоматическое скрытие через 5 секунд
        setTimeout(() => {
          setDisplayNotifications((prev) =>
            prev.map((n) => (n.id === notification.id ? { ...n, isVisible: false } : n)),
          )
          setTimeout(() => {
            setDisplayNotifications((prev) => prev.filter((n) => n.id !== notification.id))
            onDismiss(notification.id)
          }, 300)
        }, 5000)
      }
    })
  }, [notifications, displayNotifications, onDismiss, soundEnabled])

  // Обновление таймера
  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayNotifications((prev) =>
        prev.map((notification) => ({
          ...notification,
          timeLeft: Math.max(0, notification.timeLeft - 100),
        })),
      )
    }, 100)

    return () => clearInterval(interval)
  }, [])

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "player_joined":
        return <Users className="w-4 h-4 text-green-600" />
      case "player_left":
        return <Users className="w-4 h-4 text-red-600" />
      case "game_started":
        return <Play className="w-4 h-4 text-blue-600" />
      case "game_ended":
        return <Square className="w-4 h-4 text-gray-600" />
      case "question_changed":
        return <MessageCircle className="w-4 h-4 text-purple-600" />
      case "achievement_unlocked":
        return <Trophy className="w-4 h-4 text-yellow-600" />
      default:
        return <Info className="w-4 h-4 text-blue-600" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "player_joined":
        return "border-green-200 bg-green-50"
      case "player_left":
        return "border-red-200 bg-red-50"
      case "game_started":
        return "border-blue-200 bg-blue-50"
      case "game_ended":
        return "border-gray-200 bg-gray-50"
      case "achievement_unlocked":
        return "border-yellow-200 bg-yellow-50"
      default:
        return "border-blue-200 bg-blue-50"
    }
  }

  const getPlayerAvatar = (playerId?: string) => {
    if (!playerId || playerId === "system") return null

    // В реальном приложении здесь был бы поиск игрока
    const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)]
    return (
      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-sm ${avatar.color}`}>
        {avatar.emoji}
      </div>
    )
  }

  const handleDismiss = useCallback(
    (notificationId: string) => {
      setDisplayNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, isVisible: false } : n)))
      setTimeout(() => {
        setDisplayNotifications((prev) => prev.filter((n) => n.id !== notificationId))
        onDismiss(notificationId)
      }, 300)
    },
    [onDismiss],
  )

  if (displayNotifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {displayNotifications.map((notification) => (
        <Card
          key={notification.id}
          className={`transition-all duration-300 transform ${
            notification.isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
          } ${getNotificationColor(notification.type)} border-l-4`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                {getNotificationIcon(notification.type)}
                {getPlayerAvatar(notification.playerId)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 break-words">{notification.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(notification.timestamp).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDismiss(notification.id)}
                className="h-6 w-6 p-0 hover:bg-gray-200"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            {/* Прогресс-бар времени */}
            <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-100 ease-linear"
                style={{ width: `${(notification.timeLeft / 5000) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default NotificationSystem
