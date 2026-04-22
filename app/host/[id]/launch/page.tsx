"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { doc, getDoc } from "firebase/firestore"
import { ref, get } from "firebase/database"
import { db, realtimeDb } from "@/lib/firebase/config"
import { GameService } from "@/lib/firebase/gameService"
import { useAuth } from "@/contexts/AuthContext"
import type { Game, SelfPacedSettings } from "@/types/game"
import {
  ArrowLeft,
  Play,
  Users,
  Zap,
  Shuffle,
  Eye,
  Trophy,
  SkipForward,
  Clock,
  Loader2,
  ChevronRight,
  ArrowRight,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"

const DEFAULT_SELF_PACED: SelfPacedSettings = {
  randomizeOrder: false,
  shuffleAnswers: false,
  showCorrectAnswers: true,
  showRankAfterAnswer: true,
  allowSkip: false,
  timeLimitPerQuestion: true,
  autoAdvance: false,
}

type Mode = "synchronized" | "self_paced"

export default function LaunchPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, isAdmin } = useAuth()

  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [launching, setLaunching] = useState(false)
  const [selectedMode, setSelectedMode] = useState<Mode>("synchronized")
  const [selfPacedSettings, setSelfPacedSettings] = useState<SelfPacedSettings>(DEFAULT_SELF_PACED)

  useEffect(() => {
    if (!id) return
    // Enforce single active session per game: if an unfinished session already
    // exists, redirect the admin straight to the correct admin panel instead
    // of letting them start a new one.
    let cancelled = false
    const init = async () => {
      try {
        const [gameSnap, sessionSnap] = await Promise.all([
          getDoc(doc(db, "games", id)),
          get(ref(realtimeDb, `sessions/${id}`)),
        ])
        if (cancelled) return
        if (gameSnap.exists()) setGame({ id: gameSnap.id, ...gameSnap.data() } as Game)

        const sessionData = sessionSnap.val() as { status?: string; mode?: string } | null
        if (sessionData && sessionData.status && sessionData.status !== "finished") {
          const target =
            sessionData.mode === "self_paced" ? `/host/${id}/selfpaced` : `/host/${id}`
          router.replace(target)
          return
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [id, router])

  const handleLaunch = async () => {
    if (!game || !user) return
    setLaunching(true)
    try {
      if (selectedMode === "synchronized") {
        // Standard mode – create/reuse session and go to existing host panel
        await GameService.createSession(game.id, user.uid, game.code)
        router.push(`/host/${game.id}`)
      } else {
        // Self-paced mode
        await GameService.createSelfPacedSession(game.id, user.uid, game.code, selfPacedSettings)
        router.push(`/host/${game.id}/selfpaced`)
      }
    } catch (err: any) {
      console.error("Launch error:", err)
      toast({ title: "Ошибка запуска", description: err.message, variant: "destructive" })
      setLaunching(false)
    }
  }

  const toggle = (key: keyof SelfPacedSettings) =>
    setSelfPacedSettings((prev) => ({ ...prev, [key]: !prev[key] }))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Игра не найдена</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-foreground truncate">Запуск: {game.title}</h1>
            <p className="text-sm text-muted-foreground">{game.questions?.length ?? 0} вопросов · код {game.code}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Mode selection */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Выберите режим игры</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Synchronized */}
            <button
              onClick={() => setSelectedMode("synchronized")}
              className={`text-left rounded-xl border-2 p-5 transition-colors ${
                selectedMode === "synchronized"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-muted-foreground"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">В одном темпе</span>
                    <Badge variant="secondary" className="text-xs">Классический</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Все участники отвечают на один вопрос одновременно. Ведущий управляет переходами между вопросами.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {["Единое время на вопрос", "Ведущий контролирует темп", "Результаты после каждого вопроса"].map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>

            {/* Self-paced */}
            <button
              onClick={() => setSelectedMode("self_paced")}
              className={`text-left rounded-xl border-2 p-5 transition-colors ${
                selectedMode === "self_paced"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-muted-foreground"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">В своем темпе</span>
                    <Badge className="text-xs bg-amber-500 text-white hover:bg-amber-600">Новый</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Каждый участник проходит вопросы самостоятельно. Ответил — идёт дальше. Быстрее ответил — больше баллов.
                  </p>
                  <ul className="mt-2 space-y-1">
                    {["Индивидуальный темп", "Больше очков за скорость", "Настраиваемые параметры"].map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Self-paced settings */}
        {selectedMode === "self_paced" && (
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Настройки режима «В своём темпе»</CardTitle>
              <CardDescription>Выберите, как будет проходить игра для каждого участника</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* randomizeOrder */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <Shuffle className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <Label htmlFor="sp-shuffle" className="font-medium cursor-pointer">Перемешать вопросы</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      У каждого участника вопросы выдаются в случайном порядке
                    </p>
                  </div>
                </div>
                <Switch
                  id="sp-shuffle"
                  checked={selfPacedSettings.randomizeOrder}
                  onCheckedChange={() => toggle("randomizeOrder")}
                />
              </div>

              <div className="border-t border-border" />

              {/* showCorrectAnswers */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <Eye className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <Label htmlFor="sp-answers" className="font-medium cursor-pointer">Показывать правильный ответ</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      После ответа участник видит, что было правильно
                    </p>
                  </div>
                </div>
                <Switch
                  id="sp-answers"
                  checked={selfPacedSettings.showCorrectAnswers}
                  onCheckedChange={() => toggle("showCorrectAnswers")}
                />
              </div>

              <div className="border-t border-border" />

              {/* showRankAfterAnswer */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <Trophy className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <Label htmlFor="sp-rank" className="font-medium cursor-pointer">Показывать место в рейтинге</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      После каждого ответа участник видит своё текущее место среди других
                    </p>
                  </div>
                </div>
                <Switch
                  id="sp-rank"
                  checked={selfPacedSettings.showRankAfterAnswer}
                  onCheckedChange={() => toggle("showRankAfterAnswer")}
                />
              </div>

              <div className="border-t border-border" />

              {/* shuffleAnswers */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <ArrowRight className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <Label htmlFor="sp-shuffle-answers" className="font-medium cursor-pointer">Перемешать варианты ответов</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ответы показываются в случайном порядке у каждого участника (в базу данных не записывается)
                    </p>
                  </div>
                </div>
                <Switch
                  id="sp-shuffle-answers"
                  checked={selfPacedSettings.shuffleAnswers}
                  onCheckedChange={() => toggle("shuffleAnswers")}
                />
              </div>

              <div className="border-t border-border" />

              {/* timeLimitPerQuestion */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <Clock className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <Label htmlFor="sp-timer" className="font-medium cursor-pointer">Таймер на вопрос</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Использовать лимит времени из настроек каждого вопроса. При истечении — переход к следующему
                    </p>
                  </div>
                </div>
                <Switch
                  id="sp-timer"
                  checked={selfPacedSettings.timeLimitPerQuestion}
                  onCheckedChange={() => toggle("timeLimitPerQuestion")}
                />
              </div>

              <div className="border-t border-border" />

              {/* autoAdvance */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <Zap className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <Label htmlFor="sp-auto" className="font-medium cursor-pointer">Автопереход к следующему вопросу</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      После ответа участник автоматически переходит дальше. Без кнопки «Следующий вопрос»
                    </p>
                  </div>
                </div>
                <Switch
                  id="sp-auto"
                  checked={selfPacedSettings.autoAdvance}
                  onCheckedChange={() => toggle("autoAdvance")}
                />
              </div>

              <div className="border-t border-border" />

              {/* allowSkip */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <SkipForward className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <Label htmlFor="sp-skip" className="font-medium cursor-pointer">Разрешить пропуск вопроса</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Участник может пропустить вопрос — засчитывается как неверный ответ (0 очков)
                    </p>
                  </div>
                </div>
                <Switch
                  id="sp-skip"
                  checked={selfPacedSettings.allowSkip}
                  onCheckedChange={() => toggle("allowSkip")}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Launch button */}
        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={handleLaunch}
            disabled={launching}
            className="px-8 gap-2"
          >
            {launching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {launching ? "Создание сессии..." : "Запустить игру"}
            {!launching && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </main>
    </div>
  )
}
