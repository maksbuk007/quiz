"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import { NotificationSystem } from "@/components/ui/NotificationSystem"
import { v4 as uuidv4 } from "uuid"
import type { GameNotification } from "@/types/game"

interface NotificationContextType {
  addNotification: (notification: Omit<GameNotification, "id" | "timestamp">) => string
  dismissNotification: (id: string) => void
  clearAllNotifications: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<GameNotification[]>([])

  const addNotification = useCallback((notification: Omit<GameNotification, "id" | "timestamp">) => {
    const id = uuidv4()
    const newNotification = {
      ...notification,
      id,
      timestamp: Date.now(),
    }
    setNotifications((prev) => [...prev, newNotification])
    return id
  }, [])

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id))
  }, [])

  const clearAllNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  return (
    <NotificationContext.Provider
      value={{
        addNotification,
        dismissNotification,
        clearAllNotifications,
      }}
    >
      {children}
      <NotificationSystem notifications={notifications} onDismiss={dismissNotification} />
    </NotificationContext.Provider>
  )
}

// Основной хук для использования контекста уведомлений
export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider")
  }
  return context
}

// Алиас для совместимости с существующим кодом
export const useNotification = useNotifications
