"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Hash } from "lucide-react"

export default function JoinGame() {
  const [gameCode, setGameCode] = useState("")
  const [nickname, setNickname] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleJoin = async () => {
    if (!gameCode || !nickname) {
      setError("Пожалуйста, заполните все поля")
      return
    }

    setLoading(true)
    setError("")

    try {
      // Переходим на страницу присоединения
      window.location.href = `/join/${gameCode.toUpperCase()}`
    } catch (error) {
      console.error("Ошибка при присоединении:", error)
      setError("Ошибка при присоединении к игре")
    } finally {
      setLoading(false)
    }
  }

  const handleCodeChange = (value: string) => {
    const formatted = value.toUpperCase().slice(0, 6)
    setGameCode(formatted)
  }

  return (
    <Card className="max-w-md mx-auto mobile-card">
      <CardHeader>
        <CardTitle className="text-center text-lg sm:text-xl">Присоединиться к игре</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="gameCode">Код игры</Label>
          <div className="relative">
            <Hash className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              id="gameCode"
              value={gameCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="ABC123"
              className="pl-10 text-center text-lg font-mono tracking-wider"
              maxLength={6}
              autoComplete="off"
            />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Введите 6-значный код игры</p>
        </div>

        <div>
          <Label htmlFor="nickname">Ваш никнейм</Label>
          <Input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Введите никнейм"
            maxLength={20}
            autoComplete="username"
          />
        </div>

        {error && <div className="text-destructive text-sm text-center">{error}</div>}

        <Button
          onClick={handleJoin}
          className="w-full touch-friendly"
          disabled={!gameCode || !nickname || loading}
          size="lg"
        >
          {loading ? "Подключение..." : "Присоединиться"}
        </Button>

        <div className="text-center text-sm text-muted-foreground">
          <p>Получите код игры от организатора</p>
        </div>
      </CardContent>
    </Card>
  )
}
