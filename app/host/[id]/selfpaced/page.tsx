"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { doc, getDoc } from "firebase/firestore"
import { ref, onValue, update } from "firebase/database"
import { db, realtimeDb } from "@/lib/firebase/config"
import { GameService } from "@/lib/firebase/gameService"
import { AVATARS } from "@/components/ui/AvatarSelector"
import ThemeToggle from "@/components/ui/ThemeToggle"
import AnimatedLeaderboard from "@/components/game/AnimatedLeaderboard"
import PodiumCeremony from "@/components/game/PodiumCeremony"
import type { Game, GameSession, SelfPacedSettings } from "@/types/game"
import QRCode from "react-qr-code"
import {
  Play, Users, Trophy, ArrowLeft, Copy, Wifi, WifiOff,
  Loader2, CheckCircle, Clock, BarChart2, QrCode, UserX,
  Settings, Medal, Zap, Eye, Shuffle, SkipForward, ArrowRight,
  RotateCcw, List, Award, ChevronDown, AlertTriangle,
  TrendingUp, MoreHorizontal, Flag, Sparkles,
  FileText, Monitor, Radio, EyeOff, Target, Gauge,
} from "lucide-react"
import PlayerAnswersDialog from "@/components/game/PlayerAnswersDialog"
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"
import { SessionAnalyticsService } from "@/lib/services/sessionAnalyticsService"
import { motion, AnimatePresence } from "framer-motion"

const APP_URL = typeof window !== "undefined" ? window.location.origin : ""

export default function SelfPacedHostPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [game, setGame] = useState<Game | null>(null)
  const [session, setSession] = useState<GameSession | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected">("disconnected")
  const [showQR, setShowQR] = useState(false)
  const [started, setStarted] = useState(false)
  const [ending, setEnding] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<SelfPacedSettings | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  // Post-game views
  const [showLeaderboardView, setShowLeaderboardView] = useState(false)
  const [showPodiumView, setShowPodiumView] = useState(false)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const [viewingPlayerId, setViewingPlayerId] = useState<string | null>(null)

  const elapsedRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number | null>(null)

  const getAvatar = useCallback((avatarId: string, size = 32) => {
    const avatar = AVATARS.find((a) => a.id === avatarId)
    if (!avatar) return (
      <div style={{ width: size, height: size }} className="rounded-lg bg-muted flex items-center justify-center text-xs shrink-0">?</div>
    )
    return (
      <div style={{ width: size, height: size, fontSize: size * 0.55 }}
        className={`rounded-lg flex items-center justify-center shrink-0 ${avatar.color}`}>
        {avatar.emoji}
      </div>
    )
  }, [])

  useEffect(() => {
    if (!id) return
    getDoc(doc(db, "games", id)).then((snap) => {
      if (snap.exists()) setGame({ id: snap.id, ...snap.data() } as Game)
      setLoading(false)
    })
  }, [id])

  useEffect(() => {
    if (!id) return
    const sessionRef = ref(realtimeDb, `sessions/${id}`)
    const unsub = onValue(sessionRef, (snap) => {
      const data = snap.val() as GameSession | null
      setSession(data)
      setConnectionStatus("connected")
      if (data?.status === "active" && !started) {
        setStarted(true)
        if (!startTimeRef.current) startTimeRef.current = Date.now() - ((data.startTime ? Date.now() - data.startTime : 0))
      }
      if (data?.selfPacedSettings && !settingsDraft) {
        setSettingsDraft(data.selfPacedSettings)
      }
    })
    return () => unsub()
  }, [id, started, settingsDraft])

  useEffect(() => {
    if (!started || session?.status === "finished" || session?.timersFrozenAt) return
    if (!startTimeRef.current) startTimeRef.current = Date.now()
    elapsedRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (startTimeRef.current ?? Date.now())) / 1000))
    }, 1000)
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current) }
  }, [started, session?.status, session?.timersFrozenAt])

  // ─── Derived stats ────────────────────────────────────────────────────────
  const allPlayers = Object.values(session?.players ?? {}).filter((p) => !p.isHost && p.id !== "host" && !p.isKicked)
  const sorted = [...allPlayers].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  const finishedCount = allPlayers.filter((p) => p.selfPaced?.finished).length
  const totalPlayers = allPlayers.length
  const totalQuestions = game?.questions.length ?? 1
  const completionRate = totalPlayers > 0 ? Math.round((finishedCount / totalPlayers) * 100) : 0
  const overallAccuracy = totalPlayers > 0
    ? Math.round(
        allPlayers.reduce((sum, p) => {
          const answers = Array.isArray(p.answers) ? p.answers : []
          if (answers.length === 0) return sum
          const correct = answers.filter((a: any) => a.isCorrect).length
          return sum + (correct / answers.length) * 100
        }, 0) / Math.max(allPlayers.filter((p) => (p.answers?.length ?? 0) > 0).length, 1),
      )
    : 0
  const activePlayers = allPlayers.filter((p) => !p.selfPaced?.finished).length
  const leaderboardBroadcasting = session?.broadcastView === "leaderboard"
  const podiumBroadcasting = session?.broadcastView === "podium"

  const avgProgress =
    totalPlayers > 0
      ? allPlayers.reduce((sum, p) => sum + (p.selfPaced?.currentIndex ?? 0) / totalQuestions, 0) / totalPlayers
      : 0

  const joinUrl = `${APP_URL}/join/${game?.code ?? ""}`

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
  }

  const handleStart = async () => {
    if (!game) return
    try {
      await GameService.startSelfPacedGame(game.id, game.questions.length)
      setStarted(true)
      startTimeRef.current = Date.now()
      toast({ title: "Игра запущена", description: "Участники могут начинать отвечать" })
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" })
    }
  }

  const handleFinish = async () => {
    if (!game || !session) return
    setEnding(true)
    try {
      if (elapsedRef.current) {
        clearInterval(elapsedRef.current)
        elapsedRef.current = null
      }
      try { await SessionAnalyticsService.saveCompletedSession(game, session) } catch {}
      await GameService.finishSelfPacedGame(game.id)
      toast({ title: "Игра завершена", description: "Все таймеры остановлены, результаты сохранены" })
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" })
    } finally {
      setEnding(false)
    }
  }

  // Broadcast leaderboard / podium to every player's screen and show the
  // corresponding view on the host as well.
  const handleBroadcastLeaderboard = async () => {
    if (!game) return
    try {
      await GameService.setBroadcastView(game.id, "leaderboard")
      setShowLeaderboardView(true)
      toast({ title: "Лидерборд отправлен игрокам", description: "Участники видят таблицу в реальном времени" })
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" })
    }
  }

  const handleBroadcastPodium = async () => {
    if (!game) return
    try {
      await GameService.setBroadcastView(game.id, "podium")
      toast({ title: "Пьедестал отправлен игрокам", description: "Топ-3 открыт только на экранах игроков" })
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" })
    }
  }

  const clearBroadcast = async () => {
    if (!game) return
    try {
      await GameService.setBroadcastView(game.id, null)
    } catch { /* non-fatal */ }
  }

  const closeLeaderboardView = async () => {
    setShowLeaderboardView(false)
    if (session?.broadcastView === "leaderboard") await clearBroadcast()
  }

  const closePodiumView = async () => {
    setShowPodiumView(false)
    if (session?.broadcastView === "podium") await clearBroadcast()
  }

  const openScreenWindow = () => {
    if (typeof window === "undefined" || !game) return
    const url = `/host/${game.id}/selfpaced/screen`
    window.open(url, "_blank", "noopener,width=1400,height=900")
  }

  const handleRestart = async () => {
    if (!game) return
    setRestarting(true)
    setConfirmRestart(false)
    try {
      await GameService.fullRestartGame(game.id)
      setStarted(false)
      startTimeRef.current = null
      setElapsed(0)
      setShowLeaderboardView(false)
      setShowPodiumView(false)
      toast({ title: "Игра перезапущена", description: "Все игроки могут зайти заново" })
    } catch (err: any) {
      toast({ title: "Ошибка перезапуска", description: err.message, variant: "destructive" })
    } finally {
      setRestarting(false)
    }
  }

  const handleKick = async (playerId: string, nickname: string) => {
    if (!game) return
    try {
      await GameService.kickPlayer(game.id, playerId)
      toast({ title: "Игрок исключён", description: `${nickname} удалён из игры` })
    } catch (err: any) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" })
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(joinUrl)
    toast({ title: "Ссылка скопирована" })
  }

  const saveSettings = async () => {
    if (!id || !settingsDraft) return
    setSavingSettings(true)
    try {
      await update(ref(realtimeDb, `sessions/${id}`), { selfPacedSettings: settingsDraft })
      toast({ title: "Настройки сохранены" })
      setShowSettings(false)
    } catch {
      toast({ title: "Ошибка сохранения", variant: "destructive" })
    } finally {
      setSavingSettings(false)
    }
  }

  const toggleSetting = (key: keyof SelfPacedSettings) => {
    setSettingsDraft((prev) => prev ? { ...prev, [key]: !prev[key] } : prev)
  }

  const settingItems: { key: keyof SelfPacedSettings; label: string; description: string; icon: React.ReactNode }[] = [
    { key: "randomizeOrder", label: "Случайный порядок вопросов", description: "У каждого участника свой порядок", icon: <Shuffle className="w-4 h-4" /> },
    { key: "shuffleAnswers", label: "Перемешать варианты ответов", description: "Ответы в случайном порядке у каждого", icon: <ArrowRight className="w-4 h-4" /> },
    { key: "showCorrectAnswers", label: "Показывать правильный ответ", description: "Игрок видит верный ответ после своего", icon: <Eye className="w-4 h-4" /> },
    { key: "showRankAfterAnswer", label: "Показывать место в рейтинге", description: "Место среди участников в шапке вопроса", icon: <Medal className="w-4 h-4" /> },
    { key: "timeLimitPerQuestion", label: "Таймер на вопрос", description: "Лимит времени из настроек вопроса", icon: <Clock className="w-4 h-4" /> },
    { key: "autoAdvance", label: "Автопереход к следующему", description: "Без кнопки «Далее» после ответа", icon: <Zap className="w-4 h-4" /> },
    { key: "allowSkip", label: "Разрешить пропуск вопроса", description: "0 очков за пропущенный вопрос", icon: <SkipForward className="w-4 h-4" /> },
  ]

  // ─── RENDER ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const settings = session?.selfPacedSettings
  const isFinished = session?.status === "finished"

  // ─── PODIUM VIEW ──────────────────────────────────────────────────────────
  if (showPodiumView && isFinished) {
    const broadcasting = session?.broadcastView === "podium"
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={closePodiumView}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-foreground">Пьедестал почёта</span>
          {broadcasting && (
            <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600 ml-2">
              <Radio className="w-3 h-3" /> Транслируется игрокам
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-2">
            {broadcasting ? (
              <Button variant="outline" size="sm" onClick={clearBroadcast} className="gap-1.5">
                <EyeOff className="w-4 h-4" /> Скрыть у игроков
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleBroadcastPodium} className="gap-1.5">
                <Radio className="w-4 h-4" /> Показать игрокам
              </Button>
            )}
          </div>
        </div>
        <PodiumCeremony players={sorted} onComplete={closePodiumView} />
      </div>
    )
  }

  // ─── LEADERBOARD VIEW ─────────────────────────────────────────────────────
  if (showLeaderboardView) {
    const broadcasting = session?.broadcastView === "leaderboard"
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={closeLeaderboardView}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-semibold flex-1 text-foreground truncate">Таблица лидеров — {game?.title}</span>
          {broadcasting ? (
            <Button variant="outline" size="sm" onClick={clearBroadcast} className="gap-1.5">
              <EyeOff className="w-4 h-4" /> Скрыть у игроков
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleBroadcastLeaderboard} className="gap-1.5">
              <Radio className="w-4 h-4" /> Показать игрокам
            </Button>
          )}
          <ThemeToggle />
        </div>
        <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5">
          <AnimatedLeaderboard
            players={session?.players ?? {}}
            showAnimation={true}
            showScoreChanges={false}
            showPositionChanges={false}
            maxItems={50}
            compact={false}
            title={isFinished ? "Итоговый рейтинг" : "Текущий рейтинг"}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-card sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-semibold text-foreground truncate text-sm sm:text-base">{game?.title}</h1>
              <Badge variant="outline" className="text-xs shrink-0 gap-1">
                <Zap className="w-3 h-3" /> В своём темпе
              </Badge>
              {isFinished && (
                <Badge className="text-xs bg-green-600 text-white shrink-0">Завершена</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
              <span className="flex items-center gap-1">
                {connectionStatus === "connected"
                  ? <Wifi className="w-3 h-3 text-green-500" />
                  : <WifiOff className="w-3 h-3 text-destructive" />}
                {connectionStatus === "connected" ? "Подключено" : "Нет связи"}
              </span>
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {totalPlayers} игроков</span>
              {started && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatElapsed(elapsed)}</span>}
              {started && <span className="text-muted-foreground">{game?.questions.length} вопросов</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {started && !isFinished && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(!showSettings)}
                className={showSettings ? "text-primary" : ""}
                title="Настройки сессии"
              >
                <Settings className="w-5 h-5" />
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>

        {/* Live settings panel */}
        <AnimatePresence>
          {showSettings && settingsDraft && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-border"
            >
              <div className="max-w-7xl mx-auto px-4 py-4 space-y-3">
                <p className="text-sm font-medium text-foreground">Настройки сессии (применяются в реальном времени)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {settingItems.map(({ key, label, description, icon }) => (
                    <div key={key} className="flex items-start gap-3 p-3 bg-muted/40 rounded-xl">
                      <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground leading-tight">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{description}</p>
                      </div>
                      <Switch
                        checked={settingsDraft[key] as boolean}
                        onCheckedChange={() => toggleSetting(key)}
                        className="shrink-0"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <Button variant="outline" size="sm" onClick={() => { setShowSettings(false); setSettingsDraft(session?.selfPacedSettings ?? null) }}>Отмена</Button>
                  <Button size="sm" onClick={saveSettings} disabled={savingSettings}>
                    {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : "Сохранить"}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ─── Main grid ──────────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-5 grid lg:grid-cols-[1fr_340px] gap-5">

        {/* LEFT */}
        <div className="space-y-4 min-w-0">

          {/* ─── LOBBY ──────────────────────────────────────────────────── */}
          {!started ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Зал ожидания
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-2">
                        Игроки заходят по коду или QR, после чего вы сможете запустить сессию.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        <Users className="w-3.5 h-3.5 mr-1" />
                        {totalPlayers} игроков
                      </Badge>
                      <Badge variant="outline">
                        Вопросов: {game?.questions.length ?? 0}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-xl border bg-muted/30 p-6 text-center space-y-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Код для входа</p>
                    <p className="text-5xl font-black tracking-[0.2em] text-foreground font-mono">{game?.code}</p>
                    <p className="text-xs text-muted-foreground break-all">{joinUrl}</p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={copyLink}>
                        <Copy className="w-3.5 h-3.5" /> Скопировать ссылку
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowQR(!showQR)}>
                        <QrCode className="w-3.5 h-3.5" /> {showQR ? "Скрыть QR" : "Показать QR"}
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={openScreenWindow}>
                        <Monitor className="w-3.5 h-3.5" /> Режим экрана
                      </Button>
                    </div>
                    <AnimatePresence>
                      {showQR && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          className="flex justify-center pt-2"
                        >
                          <div className="p-3 bg-white rounded-xl inline-block shadow-sm">
                            <QRCode value={joinUrl} size={168} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {settings && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">Как пройдёт эта сессия</p>
                        <Badge variant="secondary">
                          {settingItems.filter(({ key }) => settings[key]).length} активных правил
                        </Badge>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {settingItems.map(({ key, label, description, icon }) => (
                          <div key={key} className="rounded-lg border bg-card p-4 flex items-start gap-3">
                            <div className={`mt-0.5 shrink-0 ${settings[key] ? "text-primary" : "text-muted-foreground"}`}>
                              {icon}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
                              <p className="text-xs text-muted-foreground mt-1 leading-tight">{description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    size="lg"
                    className="w-full gap-2"
                    onClick={handleStart}
                    disabled={totalPlayers === 0}
                  >
                    <Play className="w-4 h-4" />
                    {totalPlayers === 0 ? "Ожидание участников..." : `Запустить игру (${totalPlayers})`}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Подготовка к старту</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Подключилось</p>
                      <p className="mt-2 text-3xl font-bold">{totalPlayers}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Вопросов</p>
                      <p className="mt-2 text-3xl font-bold">{game?.questions.length ?? 0}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Статус</p>
                      <p className="mt-2 text-lg font-semibold text-foreground">Готова к запуску</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            /* ─── ACTIVE / FINISHED ─────────────────────────────────── */
            <div className="space-y-5">
              {/* ── Главная панель управления (аналог "Управление игрой" в классическом режиме) ── */}
              <Card className="overflow-hidden border-2">
                <CardHeader className="bg-gradient-to-br from-primary/5 via-transparent to-amber-500/5 pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">Панель управления игрой</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {isFinished
                            ? "Сессия завершена — результаты сохранены"
                            : "Сессия идёт — участники проходят тест в своём темпе"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="gap-1">
                        <Users className="w-3 h-3" /> {totalPlayers}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <CheckCircle className="w-3 h-3 text-green-500" /> {finishedCount}/{totalPlayers}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Clock className="w-3 h-3 text-amber-500" /> {formatElapsed(elapsed)}
                      </Badge>
                      {isFinished ? (
                        <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                          <CheckCircle className="w-3 h-3" /> Завершена
                        </Badge>
                      ) : (
                        <Badge className="gap-1 bg-amber-500 text-white hover:bg-amber-500">
                          <Zap className="w-3 h-3" /> Активна
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {/* Primary action row */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="lg"
                      variant="outline"
                      className="gap-2 flex-1 min-w-[180px] h-11 border-primary/30"
                      onClick={() => setShowLeaderboardView(true)}
                    >
                      <List className="w-4 h-4 text-primary" />
                      Показать лидерборд
                    </Button>
                    <Button
                      size="lg"
                      className="gap-2 flex-1 min-w-[180px] h-11 bg-amber-500 hover:bg-amber-600 text-white"
                      onClick={handleBroadcastPodium}
                      disabled={!isFinished}
                    >
                      <Award className="w-4 h-4" />
                      {podiumBroadcasting ? "Пьедестал у игроков" : "Показать пьедестал топ-3"}
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="gap-2 flex-1 min-w-[180px] h-11 border-sky-500/30"
                      onClick={openScreenWindow}
                    >
                      <Monitor className="w-4 h-4 text-sky-600" />
                      Экран
                    </Button>
                    {!isFinished ? (
                      <Button
                        size="lg"
                        variant="destructive"
                        className="gap-2 flex-1 min-w-[180px] h-11"
                        onClick={handleFinish}
                        disabled={ending}
                      >
                        {ending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                        Завершить игру
                      </Button>
                    ) : !confirmRestart ? (
                      <Button
                        size="lg"
                        variant="outline"
                        className="gap-2 flex-1 min-w-[180px] h-11"
                        onClick={() => setConfirmRestart(true)}
                      >
                        <RotateCcw className="w-4 h-4" />
                        Перезапустить игру
                      </Button>
                    ) : null}

                    {/* "Дополнительно" dropdown, analog of classic mode */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="lg" variant="outline" className="gap-2 h-11 shrink-0">
                          <MoreHorizontal className="w-4 h-4" />
                          <span className="hidden sm:inline">Дополнительно</span>
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-60">
                        <DropdownMenuLabel>Настройки сессии</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setShowSettings(!showSettings)}>
                          <Settings className="w-4 h-4 mr-2" />
                          {showSettings ? "Скрыть настройки" : "Показать настройки"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowQR(!showQR)}>
                          <QrCode className="w-4 h-4 mr-2" />
                          {showQR ? "Скрыть QR-код" : "Показать QR-код"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={openScreenWindow}>
                          <Monitor className="w-4 h-4 mr-2" />
                          Открыть режим экрана
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={copyLink}>
                          <Copy className="w-4 h-4 mr-2" />
                          Скопировать ссылку
                        </DropdownMenuItem>
                        {isFinished && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setConfirmRestart(true)} className="text-amber-600">
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Перезапустить игру
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Restart confirmation */}
                  <AnimatePresence>
                    {confirmRestart && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border border-destructive/40 rounded-xl p-3 space-y-2 bg-destructive/5">
                          <div className="flex items-center gap-2 text-sm text-destructive font-medium">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            Все игроки и результаты будут сброшены. Продолжить?
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1" onClick={() => setConfirmRestart(false)}>
                              Отмена
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="flex-1 gap-1.5"
                              onClick={handleRestart}
                              disabled={restarting}
                            >
                              {restarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                              Перезапустить
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* QR code inline */}
                  <AnimatePresence>
                    {showQR && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-muted/40 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
                          <div className="p-3 bg-white rounded-xl shrink-0">
                            <QRCode value={joinUrl} size={128} />
                          </div>
                          <div className="min-w-0 flex-1 text-center sm:text-left">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Код</p>
                            <p className="text-3xl font-black tracking-[0.18em] font-mono text-foreground">{game?.code}</p>
                            <p className="text-xs text-muted-foreground break-all mt-2">{joinUrl}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>

              {/* ── Красивый дашборд прогресса ───────────────────────── */}
              <Card className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Gauge className="w-4 h-4" /> Прогресс сессии
                    </CardTitle>
                    <Badge variant="secondary" className="gap-1">
                      <TrendingUp className="w-3 h-3" /> {Math.round(avgProgress * 100)}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
                    {[
                      {
                        label: "Участников",
                        value: totalPlayers,
                        icon: <Users className="w-4 h-4" />,
                        accent: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                      },
                      {
                        label: "Завершили",
                        value: `${finishedCount}/${totalPlayers}`,
                        icon: <CheckCircle className="w-4 h-4" />,
                        accent: "bg-green-500/10 text-green-600 dark:text-green-400",
                      },
                      {
                        label: "Средний прогресс",
                        value: `${Math.round(avgProgress * 100)}%`,
                        icon: <BarChart2 className="w-4 h-4" />,
                        accent: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
                      },
                      {
                        label: "Точность",
                        value: `${overallAccuracy}%`,
                        icon: <Target className="w-4 h-4" />,
                        accent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                      },
                      {
                        label: "Время",
                        value: formatElapsed(elapsed),
                        icon: <Clock className="w-4 h-4" />,
                        accent: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                      },
                    ].map(({ label, value, icon, accent }) => (
                      <div
                        key={label}
                        className="bg-card border border-border rounded-xl p-3 flex items-center gap-3"
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
                          {icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground truncate">{label}</p>
                          <p className="text-xl font-bold text-foreground truncate">{value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground font-medium">Завершили тест</span>
                          <span className="font-semibold text-foreground">
                            {completionRate}%
                          </span>
                        </div>
                      <Progress value={completionRate} className="h-2.5" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground font-medium">Средний прогресс</span>
                        <span className="font-semibold text-foreground">{Math.round(avgProgress * 100)}%</span>
                      </div>
                      <Progress value={avgProgress * 100} className="h-2" />
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3 pt-1">
                      <div className="rounded-xl border border-border bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">Сейчас в процессе</p>
                        <p className="mt-1 text-lg font-bold text-foreground">{activePlayers}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">Трансляция</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {podiumBroadcasting ? "Пьедестал у игроков" : leaderboardBroadcasting ? "Лидерборд у игроков" : "Нет активной"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">Экран зала</p>
                        <Button variant="ghost" size="sm" className="mt-1 h-auto px-0 text-sm text-sky-600" onClick={openScreenWindow}>
                          Открыть отдельное окно
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Карточка участников с кнопкой просмотра ответов ─── */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4" /> Детальный прогресс
                    </CardTitle>
                    <Badge variant="secondary">{totalPlayers} игроков</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {allPlayers.length === 0 ? (
                    <div className="text-center py-10 px-4">
                      <Users className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Нет участников в этой сессии</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {sorted.map((p, i) => {
                        const done = p.selfPaced?.currentIndex ?? 0
                        const pct = (done / totalQuestions) * 100
                        const finished = p.selfPaced?.finished ?? false
                        const accuracy =
                          p.answers && p.answers.length > 0
                            ? Math.round((p.answers.filter((a: any) => a.isCorrect).length / p.answers.length) * 100)
                            : null
                        const medalIconColor = ["text-amber-500", "text-slate-400", "text-orange-600"][i]

                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors group"
                          >
                            <div className="w-8 flex items-center justify-center shrink-0">
                              {i < 3 ? (
                                <Trophy className={`w-5 h-5 ${medalIconColor}`} />
                              ) : (
                                <span className="text-sm font-bold text-muted-foreground">#{i + 1}</span>
                              )}
                            </div>
                            {getAvatar(p.avatar ?? "", 40)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-foreground truncate">
                                  {p.nickname ?? p.name}
                                </span>
                                {finished && (
                                  <Badge className="text-[10px] h-4 px-1.5 bg-green-600 text-white hover:bg-green-600">
                                    <CheckCircle className="w-2.5 h-2.5 mr-0.5" />
                                    готово
                                  </Badge>
                                )}
                                {accuracy !== null && <span className="text-[11px] text-muted-foreground">{accuracy}% точно</span>}
                                {!finished && (
                                  <span className="text-[11px] text-muted-foreground">
                                    {pct < 35 ? "старт" : pct < 80 ? "в процессе" : "финальный рывок"}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <Progress value={pct} className="h-1.5 flex-1" />
                                <span className="text-xs font-medium text-muted-foreground shrink-0 tabular-nums">
                                  {done}/{totalQuestions}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 min-w-[60px]">
                              <p className="text-base font-bold text-foreground tabular-nums">
                                {(p.score ?? 0).toLocaleString()}
                              </p>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">очков</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => setViewingPlayerId(p.id)}
                                title="Просмотреть все ответы"
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => handleKick(p.id, p.nickname ?? p.name ?? "")}
                                title="Исключить из игры"
                              >
                                <UserX className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* RIGHT: Live leaderboard sidebar */}
        <div className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            {started ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" /> Рейтинг
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-200px)]">
                    <div className="px-3 pb-4 space-y-1.5">
                      {sorted.length === 0 ? (
                        <p className="text-center text-sm text-muted-foreground py-10">Нет участников</p>
                      ) : sorted.map((p, i) => {
                        const done = p.selfPaced?.currentIndex ?? 0
                        const pct = (done / totalQuestions) * 100
                        const isFinished = p.selfPaced?.finished ?? false
                        const medalColors = ["text-amber-500", "text-slate-400", "text-orange-600"]

                        return (
                          <motion.div
                            key={p.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            {i < 3 ? (
                              <Trophy className={`w-4 h-4 shrink-0 ${medalColors[i]}`} />
                            ) : (
                              <span className="w-4 text-center text-xs font-bold text-muted-foreground shrink-0">#{i + 1}</span>
                            )}
                            {getAvatar(p.avatar ?? "", 30)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <p className="text-xs font-medium text-foreground truncate">{p.nickname ?? p.name}</p>
                                {isFinished && <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />}
                              </div>
                              <Progress value={pct} className="h-1 mt-1" />
                            </div>
                            <p className="text-xs font-bold text-foreground shrink-0">{(p.score ?? 0).toLocaleString()}</p>
                          </motion.div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Присоединение к игре</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center space-y-4">
                    <div className="text-center">
                      <p className="text-lg font-medium mb-2">Код игры:</p>
                      <div className="text-3xl font-bold tracking-wider bg-primary/10 py-2 px-4 rounded-lg font-mono">
                        {game?.code}
                      </div>
                    </div>

                    <div className="p-4 bg-white rounded-lg shadow-sm">
                      <QRCode value={joinUrl} size={150} />
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={copyLink}>
                        <Copy className="w-4 h-4 mr-1" />
                        Ссылка
                      </Button>
                      <Button variant="outline" size="sm" onClick={openScreenWindow}>
                        <Monitor className="w-4 h-4 mr-1" />
                        Экран
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Игроки ({totalPlayers})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {allPlayers.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Пока нет игроков</p>
                        <p className="text-sm">Поделитесь кодом игры: <strong>{game?.code}</strong></p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {allPlayers.map((player) => (
                          <div key={player.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3 min-w-0">
                              {getAvatar(player.avatar ?? "", 34)}
                              <div className="min-w-0">
                                <div className="font-medium truncate">{player.nickname ?? player.name}</div>
                                <div className="text-xs text-muted-foreground">Готов к старту</div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleKick(player.id, player.nickname ?? player.name ?? "")}
                              title="Исключить"
                            >
                              <UserX className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Dialog: просмотр всех ответов конкретного игрока */}
      {viewingPlayerId && game && session?.players?.[viewingPlayerId] && (
        <PlayerAnswersDialog
          isOpen={!!viewingPlayerId}
          onClose={() => setViewingPlayerId(null)}
          player={session.players[viewingPlayerId] as any}
          questions={game.questions}
          gameId={game.id}
        />
      )}
    </div>
  )
}
