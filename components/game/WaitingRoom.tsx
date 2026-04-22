"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import {
  Users,
  Clock,
  Trophy,
  Gamepad2,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  User,
  Crown,
  Star,
  Zap,
  Target,
  Award,
  Copy,
  QrCode,
} from "lucide-react"
import { AVATARS } from "@/components/ui/AvatarSelector"
import type { Player, GameSession, Game } from "@/types/game"
import { motion, AnimatePresence } from "framer-motion"
import QRCode from "react-qr-code"
import { toast } from "@/hooks/use-toast"
import { useMobile } from "@/hooks/use-mobile"
import Image from "next/image"

interface WaitingRoomProps {
  game: Game
  session: GameSession
  currentPlayer?: Player
  connectionStatus: "connected" | "disconnected"
  soundEnabled: boolean
  onToggleSound: () => void
}

export default function WaitingRoom({
  game,
  session,
  currentPlayer,
  connectionStatus,
  soundEnabled,
  onToggleSound,
}: WaitingRoomProps) {
  const isMobile = useMobile()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showQR, setShowQR] = useState(false)
  const [showStats, setShowStats] = useState(true)

  // Обновление времени каждую секунду
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Обработка полноэкранного режима
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
        toast({
          title: "Полноэкранный режим",
          description: "Нажмите Esc для выхода",
        })
      } else {
        await document.exitFullscreen()
        setIsFullscreen(false)
      }
    } catch (error) {
      console.error("Ошибка переключения полноэкранного режима:", error)
      toast({
        title: "Ошибка",
        description: "Не удалось переключить полноэкранный режим",
        variant: "destructive",
      })
    }
  }, [])

  // Слушатель изменения полноэкранного режима
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  const getAvatarDisplay = (avatarId: string, size: "sm" | "md" | "lg" = "md") => {
    const avatar = AVATARS.find((a) => a.id === avatarId)
    if (!avatar) {
      const sizeClass = size === "sm" ? "w-8 h-8" : size === "md" ? "w-12 h-12" : "w-16 h-16"
      return <div className={`${sizeClass} rounded-full bg-gray-200 flex items-center justify-center`}>?</div>
    }

    const sizeClass = size === "sm" ? "w-8 h-8 text-lg" : size === "md" ? "w-12 h-12 text-2xl" : "w-16 h-16 text-3xl"
    return (
      <motion.div
        className={`${sizeClass} rounded-lg flex items-center justify-center ${avatar.color} shadow-lg border-2 border-white/50`}
        whileHover={{ scale: 1.1 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        {avatar.emoji}
      </motion.div>
    )
  }

  const getActivePlayers = (): Player[] => {
    if (!session?.players) return []
    return Object.values(session.players).filter((player) => player.isConnected && player.id !== "host")
  }

  const activePlayers = getActivePlayers()
  const gameUrl = `${window.location.origin}/join/${game.code}`

  const copyGameLink = async () => {
    try {
      await navigator.clipboard.writeText(gameUrl)
      toast({
        title: "Ссылка скопирована!",
        description: "Поделитесь ссылкой с друзьями",
      })
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать ссылку",
        variant: "destructive",
      })
    }
  }

  // ИСПРАВЛЕНО: Адаптивная верстка для десктопа
  if (!isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {/* Компактный заголовок для десктопа */}
        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-b border-white/20 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Image src="/main_logo.png" alt="MaksbukQuiz" width={32} height={32} className="rounded-lg" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">{game.title}</h1>
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-mono font-bold">Код: {game.code}</span>
                    <Badge variant={connectionStatus === "connected" ? "default" : "destructive"} className="text-xs">
                      {connectionStatus === "connected" ? (
                        <>
                          <Wifi className="w-3 h-3 mr-1" />
                          Онлайн
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-3 h-3 mr-1" />
                          Офлайн
                        </>
                      )}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <Users className="w-3 h-3 mr-1" />
                      {activePlayers.length}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {currentTime.toLocaleTimeString("ru-RU")}
                </div>
                <Button variant="ghost" size="sm" onClick={onToggleSound}>
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Основной контент в сетке */}
        <div className="max-w-7xl mx-auto p-6 grid grid-cols-12 gap-6 h-[calc(100vh-80px)]">
          {/* Левая колонка - Статус и информация */}
          <div className="col-span-4 space-y-4">
            {/* Статус игры */}
            <Card className="bg-gradient-to-r from-purple-500 to-blue-500 text-white border-0">
              <CardContent className="p-6">
                <div className="text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                    className="inline-block mb-3"
                  >
                    <Crown className="w-12 h-12 text-yellow-300" />
                  </motion.div>
                  <h2 className="text-2xl font-bold mb-2">Ожидание начала</h2>
                  <p className="text-white/90 mb-4">Ведущий скоро запустит игру</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <Target className="w-4 h-4" />
                      <span>{game.questions.length} вопросов</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>
                        {Math.round(game.questions.reduce((total, q) => total + (q.timeLimit || 30), 0) / 60)} мин
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Информация о текущем игроке */}
            {currentPlayer && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="w-5 h-5" />
                    Ваш профиль
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    {getAvatarDisplay(currentPlayer.avatar, "md")}
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{currentPlayer.nickname}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          <span>{currentPlayer.score} баллов</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Award className="w-3 h-3" />
                          <span>{(currentPlayer.answers || []).filter((a) => a.isCorrect).length} правильных</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-green-500">
                      Готов
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Информация об игре */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Star className="w-5 h-5" />
                  Об игре
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {game.description && <p className="text-sm text-muted-foreground">{game.description}</p>}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Вопросов:</span>
                    <Badge variant="secondary">{game.questions.length}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Категория:</span>
                    <Badge variant="outline" className="text-xs">
                      {game.category || "Общие"}
                    </Badge>
                  </div>
                </div>

                {game.categories && game.categories.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Категории:</p>
                    <div className="flex flex-wrap gap-1">
                      {game.categories.slice(0, 4).map((category) => (
                        <Badge key={category} variant="outline" className="text-xs">
                          {category}
                        </Badge>
                      ))}
                      {game.categories.length > 4 && (
                        <Badge variant="outline" className="text-xs">
                          +{game.categories.length - 4}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Центральная колонка - Список игроков */}
          <div className="col-span-5">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Игроки в комнате
                    <Badge variant="secondary">{activePlayers.length}</Badge>
                  </div>
                  {activePlayers.length > 0 && (
                    <Badge variant="outline" className="text-green-600">
                      Все готовы!
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[calc(100%-80px)]">
                <ScrollArea className="h-full">
                  <AnimatePresence>
                    {activePlayers.length === 0 ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                        <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">Пока нет других игроков</p>
                        <p className="text-gray-500 dark:text-gray-500">Поделитесь кодом игры с друзьями!</p>
                      </motion.div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {activePlayers.map((player, index) => (
                          <motion.div
                            key={player.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: index * 0.05 }}
                            className={`p-3 rounded-lg border-2 transition-all ${
                              player.id === currentPlayer?.id
                                ? "border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/20"
                                : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {getAvatarDisplay(player.avatar, "sm")}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                                    {player.nickname}
                                  </h4>
                                  {player.id === currentPlayer?.id && (
                                    <Badge variant="outline" className="text-xs">
                                      Вы
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mt-1">
                                  <div className="flex items-center gap-1">
                                    <Trophy className="w-3 h-3" />
                                    <span>{player.score}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Zap className="w-3 h-3 text-green-500" />
                                    <span>Готов</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Правая колонка - QR код и статус */}
          <div className="col-span-3 space-y-4">
            {/* QR код */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-center text-lg">Пригласить друзей</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <div className="bg-white p-3 rounded-lg inline-block shadow-inner">
                  <QRCode value={gameUrl} size={120} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Код игры:</p>
                  <p className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">{game.code}</p>
                </div>

                <div className="space-y-2">
                  <Button onClick={copyGameLink} variant="outline" size="sm" className="w-full">
                    <Copy className="w-4 h-4 mr-2" />
                    Скопировать ссылку
                  </Button>
                  <Button onClick={() => setShowQR(!showQR)} variant="ghost" size="sm" className="w-full">
                    <QrCode className="w-4 h-4 mr-2" />
                    {showQR ? "Скрыть QR" : "Показать QR"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Статус подключения */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="w-5 h-5" />
                  Статус
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                    className="inline-flex items-center gap-2 text-green-600 dark:text-green-400 mb-2"
                  >
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <span className="font-medium text-sm">Ожидание ведущего</span>
                  </motion.div>
                  <p className="text-xs text-muted-foreground">Игра начнется автоматически</p>
                </div>

                {activePlayers.length > 0 && (
                  <div>
                    <div className="flex justify-between text-xs mb-2">
                      <span>Игроков готово:</span>
                      <span>{activePlayers.length}</span>
                    </div>
                    <Progress value={Math.min(activePlayers.length * 10, 100)} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Мобильная версия (оригинальная)
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Заголовок с управлением */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
                  <Gamepad2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{game.title}</h1>
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <span>
                      Код: <span className="font-mono font-bold">{game.code}</span>
                    </span>
                    <Badge variant={connectionStatus === "connected" ? "default" : "destructive"}>
                      {connectionStatus === "connected" ? (
                        <>
                          <Wifi className="w-3 h-3 mr-1" />
                          Подключено
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-3 h-3 mr-1" />
                          Отключено
                        </>
                      )}
                    </Badge>
                  </div>
                </div>
              </motion.div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onToggleSound} className="hidden md:flex">
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>

              <Button variant="ghost" size="sm" onClick={toggleFullscreen} className="hidden md:flex">
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </Button>

              <div className="text-sm text-gray-600 dark:text-gray-400 hidden lg:block">
                {currentTime.toLocaleTimeString("ru-RU")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Основная информация */}
        <div className="lg:col-span-2 space-y-6">
          {/* Статус игры */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-gradient-to-r from-purple-500 to-blue-500 text-white border-0 shadow-xl">
              <CardContent className="p-6 md:p-8">
                <div className="text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
                    className="inline-block mb-4"
                  >
                    <Crown className="w-16 h-16 md:w-20 md:h-20 text-yellow-300" />
                  </motion.div>
                  <h2 className="text-2xl md:text-4xl font-bold mb-2">Ожидание начала игры</h2>
                  <p className="text-lg md:text-xl text-white/90 mb-4">Ведущий скоро запустит игру</p>
                  <div className="flex items-center justify-center gap-4 text-white/80">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      <span>{game.questions.length} вопросов</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      <span>{activePlayers.length} игроков</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Информация о текущем игроке */}
          {currentPlayer && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="border-2 border-purple-200 dark:border-purple-800 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <User className="w-5 h-5 text-purple-600" />
                    Ваш профиль
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    {getAvatarDisplay(currentPlayer.avatar, "lg")}
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{currentPlayer.nickname}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                        <div className="flex items-center gap-1">
                          <Trophy className="w-4 h-4" />
                          <span>{currentPlayer.score} баллов</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Award className="w-4 h-4" />
                          <span>{(currentPlayer.answers || []).filter((a) => a.isCorrect).length} правильных</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-green-500">
                      Готов к игре
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Список игроков */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span>Игроки в комнате</span>
                    <Badge variant="secondary">{activePlayers.length}</Badge>
                  </div>
                  {activePlayers.length > 0 && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">Все готовы к игре!</div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 md:h-80">
                  <AnimatePresence>
                    {activePlayers.length === 0 ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                        <Users className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <p className="text-gray-600 dark:text-gray-400 text-lg mb-2">Пока нет других игроков</p>
                        <p className="text-gray-500 dark:text-gray-500">Поделитесь кодом игры с друзьями!</p>
                      </motion.div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activePlayers.map((player, index) => (
                          <motion.div
                            key={player.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ delay: index * 0.1 }}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              player.id === currentPlayer?.id
                                ? "border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/20"
                                : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {getAvatarDisplay(player.avatar)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                                    {player.nickname}
                                  </h4>
                                  {player.id === currentPlayer?.id && (
                                    <Badge variant="outline" className="text-xs">
                                      Вы
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  <div className="flex items-center gap-1">
                                    <Trophy className="w-3 h-3" />
                                    <span>{player.score}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Zap className="w-3 h-3 text-green-500" />
                                    <span>Готов</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Боковая панель */}
        <div className="space-y-6">
          {/* QR код и ссылка */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-center">Пригласить друзей</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <div className="bg-white p-4 rounded-lg inline-block shadow-inner">
                  <QRCode value={gameUrl} size={160} />
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Код игры:</p>
                    <p className="text-3xl font-bold font-mono text-purple-600 dark:text-purple-400">{game.code}</p>
                  </div>

                  <Button onClick={copyGameLink} variant="outline" className="w-full">
                    Скопировать ссылку
                  </Button>

                  <Button onClick={() => setShowQR(!showQR)} variant="ghost" size="sm" className="w-full md:hidden">
                    {showQR ? "Скрыть QR" : "Показать QR"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Информация об игре */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Об игре
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {game.description && <p className="text-gray-600 dark:text-gray-400 text-sm">{game.description}</p>}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Вопросов:</span>
                    <Badge variant="secondary">{game.questions.length}</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Категория:</span>
                    <Badge variant="outline">{game.category || "Общие знания"}</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Сложность:</span>
                    <Badge variant="outline">
                      {game.difficulty === "easy" && "Легкая"}
                      {game.difficulty === "medium" && "Средняя"}
                      {game.difficulty === "hard" && "Сложная"}
                      {!game.difficulty && "Смешанная"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Прогресс подключения */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  Статус
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                    className="inline-flex items-center gap-2 text-green-600 dark:text-green-400 mb-2"
                  >
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                    <span className="font-medium">Ожидание ведущего</span>
                  </motion.div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Игра начнется автоматически</p>
                </div>

                {activePlayers.length > 0 && (
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Игроков готово:</span>
                      <span>{activePlayers.length}</span>
                    </div>
                    <Progress value={Math.min(activePlayers.length * 10, 100)} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Мобильные элементы управления */}
      <div className="fixed bottom-4 left-4 flex gap-2 md:hidden">
        <Button variant="outline" size="sm" onClick={onToggleSound} className="bg-white/80 backdrop-blur-sm">
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </Button>

        <Button variant="outline" size="sm" onClick={toggleFullscreen} className="bg-white/80 backdrop-blur-sm">
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  )
}
