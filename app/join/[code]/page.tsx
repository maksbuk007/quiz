"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, AlertTriangle, Lock } from "lucide-react"
import AvatarSelector from "@/components/ui/AvatarSelector"
import { GameService } from "@/lib/firebase/gameService"
import { toast } from "@/hooks/use-toast"

export default function JoinGamePage() {
  const params = useParams()
  const router = useRouter()
  const gameCode = params.code as string

  const [loading, setLoading] = useState(false)
  const [gameLoading, setGameLoading] = useState(true)
  const [nickname, setNickname] = useState("")
  const [selectedAvatar, setSelectedAvatar] = useState("cat")
  const [error, setError] = useState("")
  const [gameExists, setGameExists] = useState(false)
  const [gameTitle, setGameTitle] = useState("")
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    const checkGame = async () => {
      try {
        setGameLoading(true)
        setError("")

        if (!gameCode) {
          setError("Код игры не указан")
          return
        }

        console.log("Проверяем игру с кодом:", gameCode)
        const game = await GameService.findGameByCode(gameCode.toUpperCase())

        if (game) {
          setGameExists(true)
          setGameTitle(game.title)
          setIsLocked(game.isLocked || false)
          console.log("Игра найдена:", game.title, "Заблокирована:", game.isLocked)
        } else {
          console.error("Игра не найдена. Код:", gameCode)
          setError(
            `Игра с кодом "${gameCode}" не найдена. Проверьте правильность кода или попросите ведущего создать новую игру.`,
          )
        }
      } catch (error: any) {
        console.error("Ошибка при проверке игры:", error)
        setError(
          `Ошибка подключения к базе данных: ${error.message || "Неизвестная ошибка"}. Проверьте подключение к интернету и правила Firebase.`,
        )
      } finally {
        setGameLoading(false)
      }
    }

    checkGame()
  }, [gameCode])

  const handleJoinGame = async () => {
    if (!nickname.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите ваше имя",
        variant: "destructive",
      })
      return
    }

    if (nickname.trim().length < 2) {
      toast({
        title: "Ошибка",
        description: "Имя должно содержать минимум 2 символа",
        variant: "destructive",
      })
      return
    }

    if (isLocked) {
      toast({
        title: "Доступ закрыт",
        description: "Администратор закрыл доступ к этой игре",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setError("")

    try {
      console.log("Присоединяемся к игре:", gameCode)

      const game = await GameService.findGameByCode(gameCode.toUpperCase())
      if (!game) {
        throw new Error("Игра не найдена")
      }

      if (game.isLocked) {
        throw new Error("Доступ к игре закрыт администратором")
      }

      const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const player = {
        id: playerId,
        nickname: nickname.trim(),
        avatar: selectedAvatar,
        score: 0,
        answers: [],
        joinedAt: Date.now(),
        isConnected: true,
        lastActivity: Date.now(),
        warnings: 0,
        isMuted: false,
      }

      await GameService.addPlayerToSession(game.id, player)

      toast({
        title: "Успешно присоединились!",
        description: "Переход в игру...",
      })

      // Detect mode from session to route correctly
      const { get: dbGet, ref: dbRef } = await import("firebase/database")
      const { realtimeDb } = await import("@/lib/firebase/config")
      const sessionSnap = await dbGet(dbRef(realtimeDb, `sessions/${game.id}`))
      const sessionData = sessionSnap.val()
      const mode = sessionData?.mode ?? "synchronized"
      const basePath = mode === "self_paced" ? `/game/${game.id}/selfpaced` : `/game/${game.id}`
      const playUrl = `${basePath}?playerId=${playerId}&nickname=${encodeURIComponent(nickname.trim())}`

      setTimeout(() => {
        router.push(playUrl)
      }, 1000)
    } catch (error: any) {
      console.error("Ошибка присоединения:", error)
      setError(error.message || "Ошибка при присоединении к игре")
      toast({
        title: "Ошибка присоединения",
        description: error.message || "Не удалось присоединиться к игре",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading && nickname.trim() && !isLocked) {
      handleJoinGame()
    }
  }

  if (gameLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="text-muted-foreground">Проверяем игру...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!gameExists || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
            <h2 className="text-xl font-bold mb-2 text-center">{error || "Игра не найдена"}</h2>
            <p className="text-muted-foreground text-center mb-4 text-sm">
              {error.includes("правила Firebase")
                ? "Проблема с доступом к базе данных. Обратитесь к администратору."
                : "Проверьте правильность кода игры или обратитесь к организатору"}
            </p>
            <div className="bg-muted p-3 rounded-lg mb-4 w-full">
              <p className="text-xs text-muted-foreground text-center mb-1">Код игры:</p>
              <p className="text-lg font-mono font-bold text-center">{gameCode}</p>
            </div>
            <Button onClick={() => router.push("/")} variant="outline" className="w-full">
              На главную
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Lock className="w-12 h-12 text-destructive mb-4" />
            <h2 className="text-xl font-bold mb-2 text-center">Доступ закрыт</h2>
            <p className="text-muted-foreground text-center mb-4">
              Администратор закрыл доступ к этой игре. Присоединение невозможно.
            </p>
            <Button onClick={() => router.push("/")} variant="outline">
              На главную
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <Card className="w-full max-w-2xl lg:max-w-3xl shadow-2xl border-none bg-card">
        <CardHeader className="text-center pb-4 border-b space-y-4">
          <CardTitle className="text-2xl sm:text-3xl font-bold text-foreground">Присоединиться к игре</CardTitle>
          <div className="space-y-3">
            <p className="text-base sm:text-lg font-semibold text-foreground">{gameTitle}</p>
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-primary/10 border-2 border-primary">
              <span className="text-sm font-semibold text-muted-foreground">Код:</span>
              <span className="font-mono text-xl font-bold text-primary tracking-wider">{gameCode}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6 px-4 sm:px-6 lg:px-8">
          <div className="space-y-2">
            <label htmlFor="nickname" className="text-sm font-semibold text-foreground">
              Ваше имя
            </label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Введите ваше имя"
              maxLength={20}
              onKeyPress={handleKeyPress}
              disabled={loading}
              className="h-14 text-base sm:text-lg font-medium border-2 focus:border-primary bg-background text-foreground placeholder:text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">От 2 до 20 символов</p>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground block">Выберите аватар</label>
            <div className="bg-muted/30 p-4 rounded-lg border-2">
              <AvatarSelector selectedAvatar={selectedAvatar} onAvatarSelect={setSelectedAvatar} disabled={loading} />
            </div>
          </div>

          <Button
            onClick={handleJoinGame}
            disabled={!nickname.trim() || loading}
            className="w-full h-16 text-base sm:text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Присоединяемся...
              </>
            ) : (
              "Присоединиться к игре"
            )}
          </Button>

          <div className="text-center pt-2">
            <Button
              variant="ghost"
              onClick={() => router.push("/")}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground"
            >
              Отмена
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
