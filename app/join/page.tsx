"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, ArrowRight } from "lucide-react"

export default function JoinPage() {
  const router = useRouter()
  const [gameCode, setGameCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!gameCode.trim()) {
      return
    }

    setIsLoading(true)
    const upperCode = gameCode.toUpperCase().trim()
    router.push(`/join/${upperCode}`)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && gameCode.trim()) {
      handleSubmit(e as any)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold">Присоединиться к игре</CardTitle>
          <p className="text-muted-foreground">Введите код игры, который вам дал организатор</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="gameCode" className="text-sm font-medium">
                Код игры
              </label>
              <Input
                id="gameCode"
                type="text"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                placeholder="Например: ABC123"
                maxLength={6}
                className="text-center text-lg font-mono uppercase"
                disabled={isLoading}
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">Код состоит из 6 символов</p>
            </div>

            <Button type="submit" disabled={!gameCode.trim() || isLoading} className="w-full" size="lg">
              {isLoading ? (
                <>Переход...</>
              ) : (
                <>
                  Продолжить
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button variant="ghost" onClick={() => router.push("/")} disabled={isLoading}>
              Назад на главную
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">Или отсканируйте QR-код</p>
              <div className="flex justify-center">
                <div className="p-4 bg-muted rounded-lg">
                  <Search className="w-12 h-12 text-muted-foreground" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
