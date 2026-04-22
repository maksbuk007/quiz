"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { doc, getDoc } from "firebase/firestore"
import { ref, onValue } from "firebase/database"
import { db, realtimeDb } from "@/lib/firebase/config"
import { GameService } from "@/lib/firebase/gameService"
import { AVATARS } from "@/components/ui/AvatarSelector"
import type { Game, GameSession, Question, Player, SelfPacedSettings } from "@/types/game"
import { calculateScore, checkAnswer, buildQuestionOrder, seededShuffleArray } from "@/lib/utils/gameUtils"
import {
  Clock,
  CheckCircle,
  XCircle,
  Trophy,
  Loader2,
  ChevronRight,
  SkipForward,
  Medal,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import PodiumCeremony from "@/components/game/PodiumCeremony"
import AnimatedLeaderboard from "@/components/game/AnimatedLeaderboard"

type Phase = "waiting" | "question" | "finished" | "game_over"

export default function SelfPacedPlayerPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const playerId = searchParams.get("playerId") ?? ""
  const nickname = searchParams.get("nickname") ?? "Игрок"

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [game, setGame] = useState<Game | null>(null)
  const [session, setSession] = useState<GameSession | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [settings, setSettings] = useState<SelfPacedSettings | null>(null)

  const [phase, setPhase] = useState<Phase>("waiting")
  const [questionOrder, setQuestionOrder] = useState<number[]>([])
  // shuffled display order for answer options (per question, local only)
  const [displayOptionOrder, setDisplayOptionOrder] = useState<number[]>([])
  const [currentQPos, setCurrentQPos] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [questionStartTime, setQuestionStartTime] = useState(0)

  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([])
  const [textAnswer, setTextAnswer] = useState("")
  const [answered, setAnswered] = useState(false)
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false)
  const [lastPoints, setLastPoints] = useState(0)
  const [correctIndices, setCorrectIndices] = useState<number[]>([])

  const [totalScore, setTotalScore] = useState(0)
  const [rank, setRank] = useState<number | null>(null)
  const [totalPlayers, setTotalPlayers] = useState(0)

  const [timeLeft, setTimeLeft] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const autoAdvanceRef = useRef<NodeJS.Timeout | null>(null)
  const initializedRef = useRef(false)

  const getAvatarDisplay = useCallback((avatarId: string, size = "md") => {
    const avatar = AVATARS.find((a) => a.id === avatarId)
    const sizeClass = size === "sm" ? "w-8 h-8 text-lg" : "w-12 h-12 text-2xl"
    if (!avatar) return <div className={`${sizeClass} rounded-full bg-muted flex items-center justify-center`}>?</div>
    return (
      <div className={`${sizeClass} rounded-xl flex items-center justify-center ${avatar.color}`}>
        {avatar.emoji}
      </div>
    )
  }, [])

  // Build display option order when question changes
  const buildDisplayOrder = useCallback((q: Question, shuffle: boolean) => {
    const indices = q.options?.map((_, i) => i) ?? []
    if (!shuffle) return indices
    const seed = `${id}:${playerId}:${q.id}:${q.question}`
    return seededShuffleArray(indices, seed)
  }, [id, playerId])

  // Load game
  useEffect(() => {
    if (!id) return
    getDoc(doc(db, "games", id)).then((snap) => {
      if (snap.exists()) setGame({ id: snap.id, ...snap.data() } as Game)
      else setError("Игра не найдена")
      setLoading(false)
    })
  }, [id])

  // Subscribe to session
  useEffect(() => {
    if (!id) return
    const sessionRef = ref(realtimeDb, `sessions/${id}`)
    const unsub = onValue(sessionRef, (snap) => {
      const data = snap.val() as GameSession | null
      setSession(data)
      if (data?.selfPacedSettings) setSettings(data.selfPacedSettings)
      if (data?.status === "finished" || data?.timersFrozenAt) {
        // Host finished the game — kill every in-flight timer immediately so
        // the player does not keep counting down or auto-advancing.
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        if (autoAdvanceRef.current) { clearTimeout(autoAdvanceRef.current); autoAdvanceRef.current = null }
        if (phase !== "game_over" && phase !== "finished") setPhase("game_over")
      }
    })
    return () => unsub()
  }, [id, phase])

  // Subscribe to own player data
  useEffect(() => {
    if (!id || !playerId) return
    const playerRef = ref(realtimeDb, `sessions/${id}/players/${playerId}`)
    const unsub = onValue(playerRef, (snap) => {
      const data = snap.val() as Player | null
      if (data) {
        setPlayer(data)
        setTotalScore(data.score ?? 0)
      }
    })
    return () => unsub()
  }, [id, playerId])

  // Compute rank
  useEffect(() => {
    if (!session?.players) return
    const all = Object.values(session.players).filter((p) => !p.isHost && p.id !== "host")
    setTotalPlayers(all.length)
    const sorted = [...all].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    const idx = sorted.findIndex((p) => p.id === playerId)
    setRank(idx >= 0 ? idx + 1 : null)
  }, [session?.players, playerId, totalScore])

  // Initialize question order once session becomes active
  useEffect(() => {
    if (!game || !session || initializedRef.current) return
    if (session.status !== "active") return

    initializedRef.current = true
    const sp = session.selfPacedSettings
    const existingProgress = player?.selfPaced
    const totalQs = game.questions.length

    if (existingProgress) {
      // Defensive: validate the stored order — if the game was edited and
      // the saved order now has duplicates or missing indices, repair it.
      const safeOrder = buildQuestionOrder(totalQs, sp?.randomizeOrder ?? false, existingProgress.questionOrder)
      setQuestionOrder(safeOrder)
      const pos = Math.min(Math.max(existingProgress.currentIndex ?? 0, 0), safeOrder.length)
      setCurrentQPos(pos)
      if (existingProgress.finished || pos >= safeOrder.length) { setPhase("finished"); return }
      const q = game.questions[safeOrder[pos]]
      setCurrentQuestion(q)
      setDisplayOptionOrder(buildDisplayOrder(q, sp?.shuffleAnswers ?? false))
      setPhase("question")
      setQuestionStartTime(Date.now())
      return
    }

    // Collect already-assigned orders from other players so we pick a
    // maximally different one — players experience visibly distinct sequences.
    const otherOrders = Object.values(session.players ?? {})
      .filter((p) => p.id !== playerId && !p.isHost && Array.isArray(p.selfPaced?.questionOrder))
      .map((p) => p.selfPaced!.questionOrder)

    const order = buildQuestionOrder(totalQs, sp?.randomizeOrder ?? false, undefined, otherOrders)
    setQuestionOrder(order)
    setCurrentQPos(0)
    const q = game.questions[order[0]]
    setCurrentQuestion(q)
    setDisplayOptionOrder(buildDisplayOrder(q, sp?.shuffleAnswers ?? false))
    setPhase("question")
    setQuestionStartTime(Date.now())
    GameService.initPlayerSelfPacedProgress(id!, playerId, order).catch(console.error)
  }, [game, session, player, id, playerId, buildDisplayOrder])

  // Timer per question
  useEffect(() => {
    if (phase !== "question" || !currentQuestion || !settings?.timeLimitPerQuestion || answered || session?.timersFrozenAt) return
    const limit = currentQuestion.timeLimit ?? 30
    setTimeLeft(limit)
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          submitAnswer([], "", false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase, currentQuestion?.id, answered, settings?.timeLimitPerQuestion, session?.timersFrozenAt])

  const advanceToNext = useCallback(() => {
    if (!game) return
    const nextPos = currentQPos + 1
    // questionOrder is the canonical shuffled/ordered list — each index appears exactly once
    if (nextPos >= questionOrder.length) {
      setPhase("finished")
      return
    }
    const realQuestionIndex = questionOrder[nextPos]
    const nextQ = game.questions[realQuestionIndex]
    setCurrentQPos(nextPos)
    setCurrentQuestion(nextQ)
    setDisplayOptionOrder(buildDisplayOrder(nextQ, settings?.shuffleAnswers ?? false))
    setSelectedAnswers([])
    setTextAnswer("")
    setAnswered(false)
    setCorrectIndices([])
    setPhase("question")
    setQuestionStartTime(Date.now())
  }, [game, currentQPos, questionOrder, settings?.shuffleAnswers, buildDisplayOrder])

  const submitAnswer = useCallback(
    async (selectedIdx: number[], text: string, _userInitiated: boolean) => {
      if (!game || !currentQuestion || answered || phase !== "question") return
      setAnswered(true)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      const timeSpent = (Date.now() - questionStartTime) / 1000
      const timeLimit = currentQuestion.timeLimit ?? 30

      // Map display indices back to real indices for correctness check
      const realSelectedIdx = selectedIdx.map((dispIdx) => displayOptionOrder[dispIdx])

      let isCorrect = false
      if (currentQuestion.type === "TEXT_INPUT") {
        isCorrect = checkAnswer(text, currentQuestion.correctAnswers as string[])
      } else if (currentQuestion.type === "MULTIPLE_SELECT") {
        isCorrect = checkAnswer(realSelectedIdx, currentQuestion.correctAnswers as number[])
      } else {
        isCorrect = realSelectedIdx.length > 0 && checkAnswer(realSelectedIdx[0], currentQuestion.correctAnswers as number[])
      }

      const points = calculateScore(isCorrect, currentQuestion.points ?? 1000, timeSpent, timeLimit)
      const nextQPos = currentQPos + 1
      const finished = nextQPos >= questionOrder.length

      setLastAnswerCorrect(isCorrect)
      setLastPoints(points)
      // Store correct display indices for highlight
      const correctReal = currentQuestion.correctAnswers as number[]
      const correctDisplay = correctReal.map((ri) => displayOptionOrder.indexOf(ri)).filter((i) => i >= 0)
      setCorrectIndices(correctDisplay)

      // Use the same `answer` field shape as the classic mode so that
      // analytics, answer distribution and the host "player answers" dialog
      // work identically for self-paced sessions.
      const answerValue: number[] | string =
        currentQuestion.type === "TEXT_INPUT" ? text : realSelectedIdx

      const answerRecord = {
        questionId: currentQuestion.id,
        questionIndex: questionOrder[currentQPos],
        answer: answerValue,
        // Legacy aliases so old code paths (if any) still see the data.
        selectedAnswers: realSelectedIdx,
        textAnswer: text,
        isCorrect,
        points,
        timeSpent: Math.round(timeSpent * 1000),
        submittedAt: Date.now(),
        timestamp: Date.now(),
      }

      await GameService.submitSelfPacedAnswer(id!, playerId, answerRecord as any, nextQPos, questionOrder.length)

      // Auto-advance or wait for user
      if (settings?.autoAdvance) {
        const delay = (settings.showCorrectAnswers || settings.showRankAfterAnswer) ? 2200 : 1200
        autoAdvanceRef.current = setTimeout(() => {
          if (finished) setPhase("finished")
          else advanceToNext()
        }, delay)
      }
    },
    [game, currentQuestion, answered, phase, questionStartTime, questionOrder, currentQPos,
     displayOptionOrder, id, playerId, settings, advanceToNext],
  )

  const handleAnswer = () => {
    if (currentQuestion?.type === "TEXT_INPUT") submitAnswer([], textAnswer, true)
    else submitAnswer(selectedAnswers, "", true)
  }

  const toggleAnswer = (displayIdx: number) => {
    if (answered) return
    if (currentQuestion?.type === "MULTIPLE_SELECT") {
      setSelectedAnswers((prev) =>
        prev.includes(displayIdx) ? prev.filter((i) => i !== displayIdx) : [...prev, displayIdx],
      )
    } else {
      setSelectedAnswers([displayIdx])
    }
  }

  useEffect(() => () => { if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current) }, [])
  useEffect(() => {
    if (!session?.timersFrozenAt) return
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current)
      autoAdvanceRef.current = null
    }
  }, [session?.timersFrozenAt])

  // ─── Helper: get button style for an answer option ───────────────────────
  const getOptionStyle = (displayIdx: number): string => {
    const isSelected = selectedAnswers.includes(displayIdx)
    const isCorrect = correctIndices.includes(displayIdx)

    if (!answered) {
      return isSelected
        ? "border-primary bg-primary/10 text-foreground"
        : "border-border bg-card hover:border-muted-foreground text-foreground"
    }

    // Post-answer coloring
    const showColors = settings?.showCorrectAnswers ?? true
    if (showColors) {
      if (isCorrect) return "border-green-500 bg-green-500/15 text-foreground"
      if (isSelected && !isCorrect) return "border-red-500 bg-red-500/15 text-foreground"
      return "border-border bg-card opacity-50 text-foreground"
    } else {
      // No correct-answer reveal: just show selected in neutral accent
      if (isSelected) return "border-blue-500 bg-blue-500/15 text-foreground"
      return "border-border bg-card opacity-50 text-foreground"
    }
  }

  const getOptionIcon = (displayIdx: number) => {
    if (!answered) {
      const isSelected = selectedAnswers.includes(displayIdx)
      return (
        <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors ${isSelected ? "border-primary bg-primary" : "border-muted-foreground"}`}>
          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
        </div>
      )
    }
    const showColors = settings?.showCorrectAnswers ?? true
    const isCorrect = correctIndices.includes(displayIdx)
    const isSelected = selectedAnswers.includes(displayIdx)
    if (!showColors) {
      return isSelected
        ? <div className="w-5 h-5 rounded-full bg-blue-500 shrink-0 mt-0.5 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white" /></div>
        : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground shrink-0 mt-0.5" />
    }
    if (isCorrect) return <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
    if (isSelected) return <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
    return <div className="w-5 h-5 rounded-full border-2 border-muted-foreground shrink-0 mt-0.5" />
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="p-6">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
            <p className="text-foreground font-medium">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (phase === "waiting") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 gap-6">
        <div className="text-center space-y-2">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <h2 className="text-xl font-semibold text-foreground">Ожидание начала игры</h2>
          <p className="text-muted-foreground text-sm">Ведущий скоро запустит викторину</p>
        </div>
        <Card className="w-full max-w-xs">
          <CardContent className="p-4 flex items-center gap-3">
            {getAvatarDisplay(player?.avatar ?? "")}
            <div>
              <p className="font-medium text-foreground">{nickname}</p>
              <p className="text-xs text-muted-foreground">Вы подключены</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ─── Host-broadcasted views override local phase ─────────────────────────
  // When admin clicks "Show podium" / "Show leaderboard" in the control panel,
  // the session gets a `broadcastView` flag that every player mirrors.
  if (session?.broadcastView === "leaderboard") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
          <Trophy className="w-5 h-5 text-amber-500" />
          <span className="font-semibold text-foreground truncate">Итоги — {game?.title}</span>
          <Badge variant="outline" className="ml-auto text-xs">Транслирует ведущий</Badge>
        </div>
        <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5">
          <AnimatedLeaderboard
            players={session.players ?? {}}
            showAnimation={true}
            showScoreChanges={false}
            showPositionChanges={false}
            maxItems={50}
            compact={false}
            title="Текущий рейтинг"
            currentPlayerId={playerId}
          />
        </div>
      </div>
    )
  }

  if (session?.broadcastView === "podium") {
    const allPlayers = Object.values(session?.players ?? {}).filter((p) => !p.isHost)
    const sorted = [...allPlayers].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    return (
      <div className="min-h-screen bg-background">
        <PodiumCeremony players={sorted} />
      </div>
    )
  }

  if (phase === "game_over") {
    const allPlayers = Object.values(session?.players ?? {}).filter((p) => !p.isHost)
    const sorted = [...allPlayers].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    return (
      <div className="min-h-screen bg-background">
        <PodiumCeremony players={sorted} />
      </div>
    )
  }

  if (phase === "finished") {
    const allPlayers = Object.values(session?.players ?? {}).filter((p) => !p.isHost && p.id !== "host")
    const sorted = [...allPlayers].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    const myRank = sorted.findIndex((p) => p.id === playerId) + 1
    const finishedCount = allPlayers.filter((p) => p.selfPaced?.finished).length

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 gap-5">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-2"
        >
          <Trophy className="w-16 h-16 text-amber-500 mx-auto" />
          <h2 className="text-2xl font-bold text-foreground">Тест пройден!</h2>
          <p className="text-muted-foreground text-sm">Ожидайте, пока завершат другие участники</p>
        </motion.div>

        <div className="w-full max-w-sm space-y-3">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ваш счёт</span>
                <span className="font-bold text-foreground text-lg">{totalScore.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Место в рейтинге</span>
                <span className="font-semibold text-foreground">#{myRank} из {totalPlayers}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Завершили тест</span>
                <span className="font-semibold text-foreground">{finishedCount} / {totalPlayers}</span>
              </div>
              <Progress value={(finishedCount / Math.max(totalPlayers, 1)) * 100} className="h-2" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Текущий рейтинг</h3>
              <div className="space-y-2">
                {sorted.slice(0, 10).map((p, i) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 p-2 rounded-lg text-sm ${p.id === playerId ? "bg-primary/10 ring-1 ring-primary" : "bg-muted/30"}`}
                  >
                    <span className="w-5 text-center font-bold text-muted-foreground">#{i + 1}</span>
                    {getAvatarDisplay(p.avatar ?? "", "sm")}
                    <span className="flex-1 font-medium text-foreground truncate">{p.nickname ?? p.name}</span>
                    <span className="font-bold text-foreground">{(p.score ?? 0).toLocaleString()}</span>
                    {p.selfPaced?.finished && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!currentQuestion) return null

  const timeLimitForQ = currentQuestion.timeLimit ?? 30
  const timePercent = settings?.timeLimitPerQuestion ? (timeLeft / timeLimitForQ) * 100 : 100
  const displayTimeLeft = timeLeft
  const progress = (currentQPos / Math.max(questionOrder.length, 1)) * 100
  const isLastQuestion = currentQPos + 1 >= questionOrder.length

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar — identical layout to classic mode */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card">
        <Badge variant="outline" className="font-mono text-xs">
          {currentQPos + 1} / {questionOrder.length}
        </Badge>

        <div className="flex items-center gap-3">
          {settings?.showRankAfterAnswer && rank !== null && (
            <div className="flex items-center gap-1">
              <Medal className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold text-foreground">#{rank}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-sm text-foreground">{totalScore.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto p-4 max-w-2xl relative">
        {/* Full-screen answer overlay (replaces card when answered) */}
        <AnimatePresence>
          {answered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center space-y-6"
              >
                {/* Success checkmark animation */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: "spring", damping: 15, stiffness: 200 }}
                  className="w-20 h-20 rounded-full bg-green-500/20 mx-auto flex items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.25 }}
                    className="text-green-500"
                  >
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                </motion.div>

                {/* Success message */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-2"
                >
                  <h3 className="text-2xl font-bold">Ответ отправлен!</h3>
                  <p className="text-sm text-muted-foreground">Твой ответ успешно записан</p>
                </motion.div>

                {/* Points gained (if correct) */}
                {lastAnswerCorrect && lastPoints > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-green-500/10 border border-green-500/30 rounded-lg py-3 px-4"
                  >
                    <div className="text-3xl font-bold text-green-600">+{lastPoints.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">очков начислено</div>
                  </motion.div>
                )}

                {/* Answered count */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="pt-2"
                >
                  <div className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {Object.values(session?.players ?? {}).filter((p) => {
                        const answers = Array.isArray(p.answers) ? p.answers : []
                        return answers.length > 0 && !p.isHost
                      }).length}
                    </span>
                    <span> {(() => {
                      const count = Object.values(session?.players ?? {}).filter((p) => {
                        const answers = Array.isArray(p.answers) ? p.answers : []
                        return answers.length > 0 && !p.isHost
                      }).length
                      if (count % 10 === 1 && count % 100 !== 11) return " участник"
                      if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return " участника"
                      return " участников"
                    })()} ответили на этот вопрос</span>
                  </div>
                </motion.div>

                {/* Next button (if no auto-advance) */}
                {!settings?.autoAdvance && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="pt-2"
                  >
                    <p className="text-xs text-muted-foreground mb-3">Ожидаем дальнейших указаний ведущего...</p>
                    <div className="w-12 h-12 rounded-full border-2 border-muted border-t-primary animate-spin mx-auto" />
                  </motion.div>
                )}

                {/* Auto-advance progress */}
                {settings?.autoAdvance && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="pt-2 space-y-2"
                  >
                    <p className="text-xs text-muted-foreground">Переход к следующему вопросу...</p>
                    <div className="w-32 h-1 bg-muted rounded-full mx-auto overflow-hidden">
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2 }}
                      />
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Question Card — only shown when not answered */}
        {!answered && (
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Вопрос</CardTitle>
                {settings?.timeLimitPerQuestion && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span className={`font-bold ${displayTimeLeft <= 5 ? "text-red-500" : ""}`}>{displayTimeLeft}с</span>
                  </div>
                )}
              </div>
              {/* Timer progress bar */}
              {settings?.timeLimitPerQuestion && (
                <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={`absolute top-0 left-0 h-full ${
                      displayTimeLeft <= 5 ? "bg-red-500" : displayTimeLeft <= 10 ? "bg-yellow-500" : "bg-green-500"
                    }`}
                    animate={{ width: `${timePercent}%` }}
                    transition={{ ease: "linear", duration: 0.9 }}
                  />
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Image */}
              {currentQuestion.imageUrl && (
                <div className="text-center">
                  <img
                    src={currentQuestion.imageUrl}
                    alt="Изображение к вопросу"
                    className="max-w-full h-auto max-h-64 mx-auto rounded-lg shadow-md"
                  />
                </div>
              )}

              {/* Question text */}
              <div className="text-xl font-medium text-center p-4 bg-muted rounded-lg">
                {currentQuestion.question}
              </div>

              {/* Answer options */}
              {currentQuestion.type === "TEXT_INPUT" ? (
                <div className="space-y-3">
                  <input
                    type={currentQuestion.numbersOnly ? "number" : "text"}
                    value={textAnswer}
                    onChange={(e) => {
                      const v = e.target.value
                      if (currentQuestion.numbersOnly && v && !/^\d*\.?\d*$/.test(v)) return
                      setTextAnswer(v)
                    }}
                    onKeyDown={(e) => e.key === "Enter" && !answered && textAnswer.trim() && handleAnswer()}
                    placeholder={currentQuestion.numbersOnly ? "Введите число" : "Введите ваш ответ"}
                    disabled={answered}
                    className="w-full p-4 text-lg rounded-[12px] border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                    autoFocus
                  />
                  {currentQuestion.numbersOnly && (
                    <p className="text-xs text-muted-foreground">Только числовой ввод</p>
                  )}
                </div>
              ) : (
                <div className={`grid gap-3 ${
                  currentQuestion.options?.every((o) => o.length <= 20) && (currentQuestion.options?.length ?? 0) <= 4
                    ? "grid-cols-2"
                    : "grid-cols-1 sm:grid-cols-2"
                }`}>
                  {displayOptionOrder.map((realIdx, displayIdx) => {
                    const option = currentQuestion.options?.[realIdx] ?? ""
                    return (
                      <Button
                        key={realIdx}
                        variant={selectedAnswers.includes(displayIdx) ? "default" : "outline"}
                        className="w-full text-left justify-start h-auto min-h-[3.5rem] p-4 transition-all duration-200 hover:scale-[1.02] whitespace-normal"
                        onClick={() => toggleAnswer(displayIdx)}
                      >
                        <div className="flex items-start gap-3 w-full min-w-0">
                          {getOptionIcon(displayIdx)}
                          <span className="flex-1 min-w-0 break-words text-left leading-relaxed [overflow-wrap:anywhere] [word-break:break-word] whitespace-normal">
                            {option}
                          </span>
                        </div>
                      </Button>
                    )
                  })}
                </div>
              )}

              {/* Bottom row: score info + answer button */}
              <div className="flex justify-between items-center mt-2">
                <div className="text-sm text-muted-foreground">
                  Баллов за правильный ответ: {currentQuestion.points?.toLocaleString()}
                </div>

                <Button
                  onClick={handleAnswer}
                  size="lg"
                  className="px-8"
                  disabled={currentQuestion.type === "TEXT_INPUT" ? !textAnswer.trim() : selectedAnswers.length === 0}
                >
                  Ответить
                </Button>
              </div>

              {/* Skip button */}
              {settings?.allowSkip && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full gap-1 text-muted-foreground"
                  onClick={() => submitAnswer([], "", true)}
                >
                  <SkipForward className="w-4 h-4" /> Пропустить вопрос
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
