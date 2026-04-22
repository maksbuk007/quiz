import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase/config"

export function generateGameCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function generateUniqueGameCode(): Promise<string> {
  let code: string
  let isUnique = false
  let attempts = 0
  const maxAttempts = 10

  do {
    code = generateGameCode()
    try {
      const gamesRef = collection(db, "games")
      const q = query(gamesRef, where("code", "==", code))
      const querySnapshot = await getDocs(q)
      isUnique = querySnapshot.empty
      attempts++
    } catch (error) {
      console.error("Ошибка проверки уникальности кода:", error)
      attempts++
    }
  } while (!isUnique && attempts < maxAttempts)

  if (!isUnique) {
    throw new Error("Не удалось сгенерировать уникальный код игры")
  }

  return code
}

/**
 * Unbiased Fisher–Yates shuffle.
 * Guarantees each element appears exactly once (a permutation of the input).
 */
export function shuffleArray<T>(array: T[]): T[] {
  if (!Array.isArray(array) || array.length <= 1) return Array.isArray(array) ? [...array] : []

  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Deterministic shuffle for stable per-player/per-question ordering.
 * The same seed always produces the same permutation, which is useful for
 * self-paced answer options so they do not visually "jump" on re-render.
 */
export function seededShuffleArray<T>(array: T[], seed: string): T[] {
  if (!Array.isArray(array) || array.length <= 1) return Array.isArray(array) ? [...array] : []

  const shuffled = [...array]
  let state = hashSeed(seed)

  for (let i = shuffled.length - 1; i > 0; i--) {
    state = mulberry32(state)
    const j = Math.floor(state * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled
}

/**
 * Build a per-player question order for self-paced mode.
 * Guarantees the returned array is a permutation of [0..total-1] — every index
 * appears exactly once, no duplicates and nothing is dropped.
 *
 * If a stored order is passed, it is validated and repaired when it is missing
 * indices or contains duplicates / stale values (e.g. after the game was edited).
 *
 * When `otherOrders` is provided and `existing` is not, the chosen random order
 * is maximally different (position-wise) from already-assigned orders so players
 * experience as distinct a sequence as possible.
 */
export function buildQuestionOrder(
  total: number,
  randomize: boolean,
  existing?: number[],
  otherOrders?: number[][],
): number[] {
  if (!Number.isFinite(total) || total <= 0) return []
  const allIndices = Array.from({ length: total }, (_, i) => i)

  if (existing && Array.isArray(existing)) {
    // Keep only in-range unique indices, then append any missing ones at the end.
    const seen = new Set<number>()
    const cleaned: number[] = []
    for (const idx of existing) {
      if (typeof idx === "number" && idx >= 0 && idx < total && !seen.has(idx)) {
        cleaned.push(idx)
        seen.add(idx)
      }
    }
    if (cleaned.length === total) return cleaned
    const missing = allIndices.filter((i) => !seen.has(i))
    const appended = randomize ? shuffleArray(missing) : missing
    return [...cleaned, ...appended]
  }

  if (!randomize) return allIndices

  // Filter usable existing orders (same length, valid permutations)
  const existingValid = dedupeOrders(
    (otherOrders ?? []).filter((o) => Array.isArray(o) && o.length === total && new Set(o).size === total),
  )

  if (existingValid.length === 0) {
    return shuffleArray(allIndices)
  }

  return buildMaximallyDifferentOrder(total, existingValid)
}

/**
 * Given a list of existing orders (each a permutation of [0..total-1]),
 * generate a new permutation that maximises the minimum Hamming distance
 * (number of positions where values differ) to every existing one. This
 * makes the player-perceived difference between individual orders as
 * dramatic as possible without guaranteeing a strict derangement.
 */
export function buildMaximallyDifferentOrder(total: number, existingOrders: number[][]): number[] {
  const allIndices = Array.from({ length: total }, (_, i) => i)
  if (total <= 1) return allIndices

  const uniqueExisting = dedupeOrders(existingOrders)
  const exactUniquenessStillPossible = uniqueExisting.length < countPossiblePermutations(total)
  const existingMetas = uniqueExisting.map((order) => ({
    order,
    orderKey: order.join(","),
    positions: buildPositionMap(order),
  }))
  const existingKeys = new Set(existingMetas.map((meta) => meta.orderKey))

  const candidates = generateCandidateOrders(allIndices, uniqueExisting)
  let bestOrder: number[] | null = null
  let bestScore: ReturnType<typeof scoreOrder> | null = null

  for (const candidate of candidates) {
    const score = scoreOrder(candidate, existingMetas, existingKeys, exactUniquenessStillPossible)
    if (!bestScore || isScoreBetter(score, bestScore)) {
      bestOrder = candidate
      bestScore = score
    }
  }

  if (bestOrder) {
    return bestOrder
  }

  // Fallback: if candidate generation somehow failed, still return a valid
  // permutation. Prefer a non-duplicate when mathematically possible.
  for (let i = 0; i < 256; i++) {
    const candidate = shuffleArray(allIndices)
    const key = candidate.join(",")
    if (!exactUniquenessStillPossible || !existingKeys.has(key)) {
      return candidate
    }
  }

  return shuffleArray(allIndices)
}

function scoreOrder(
  order: number[],
  existing: Array<{ order: number[]; orderKey: string; positions: number[] }>,
  existingKeys: Set<string>,
  exactUniquenessStillPossible: boolean,
): {
  isUnique: number
  minHamming: number
  sumHamming: number
  minDisplacement: number
  sumDisplacement: number
} {
  const orderKey = order.join(",")
  let minH = Number.POSITIVE_INFINITY
  let sumH = 0
  let minDisplacement = Number.POSITIVE_INFINITY
  let sumDisplacement = 0

  for (const other of existing) {
    let h = 0
    let displacement = 0

    for (let i = 0; i < order.length; i++) {
      const value = order[i]
      if (value !== other.order[i]) h++
      displacement += Math.abs(i - other.positions[value])
    }

    if (h < minH) minH = h
    if (displacement < minDisplacement) minDisplacement = displacement
    sumH += h
    sumDisplacement += displacement
  }
  if (minH === Number.POSITIVE_INFINITY) minH = order.length
  if (minDisplacement === Number.POSITIVE_INFINITY) minDisplacement = order.length * order.length

  return {
    isUnique: exactUniquenessStillPossible && existingKeys.has(orderKey) ? 0 : 1,
    minHamming: minH,
    sumHamming: sumH,
    minDisplacement,
    sumDisplacement,
  }
}

function isScoreBetter(
  a: ReturnType<typeof scoreOrder>,
  b: ReturnType<typeof scoreOrder>,
): boolean {
  if (a.isUnique !== b.isUnique) return a.isUnique > b.isUnique
  if (a.minHamming !== b.minHamming) return a.minHamming > b.minHamming
  if (a.minDisplacement !== b.minDisplacement) return a.minDisplacement > b.minDisplacement
  if (a.sumHamming !== b.sumHamming) return a.sumHamming > b.sumHamming
  return a.sumDisplacement > b.sumDisplacement
}

function generateCandidateOrders(allIndices: number[], existingOrders: number[][]): number[][] {
  const candidates: number[][] = []
  const seen = new Set<string>()

  const push = (candidate: number[]) => {
    const key = candidate.join(",")
    if (candidate.length !== allIndices.length || seen.has(key)) return
    seen.add(key)
    candidates.push(candidate)
  }

  const bases = dedupeOrders([
    shuffleArray(allIndices),
    allIndices,
    [...allIndices].reverse(),
    interleaveFromEnds(allIndices),
    ...existingOrders.slice(0, 3).map((order) => shuffleArray(order)),
  ])

  for (const base of bases) {
    for (let shift = 0; shift < allIndices.length; shift++) {
      push(rotateArray(base, shift))
      push(rotateArray([...base].reverse(), shift))
    }
  }

  const randomBudget = Math.min(256, Math.max(96, allIndices.length * 20))
  for (let i = 0; i < randomBudget; i++) {
    push(shuffleArray(allIndices))
  }

  return candidates
}

function rotateArray<T>(array: T[], shift: number): T[] {
  if (array.length === 0) return []
  const normalized = ((shift % array.length) + array.length) % array.length
  if (normalized === 0) return [...array]
  return [...array.slice(normalized), ...array.slice(0, normalized)]
}

function interleaveFromEnds<T>(array: T[]): T[] {
  const result: T[] = []
  let left = 0
  let right = array.length - 1
  while (left <= right) {
    result.push(array[left])
    if (left !== right) result.push(array[right])
    left += 1
    right -= 1
  }
  return result
}

function buildPositionMap(order: number[]): number[] {
  const positions = Array.from({ length: order.length }, () => -1)
  for (let i = 0; i < order.length; i++) {
    positions[order[i]] = i
  }
  return positions
}

function dedupeOrders(orders: number[][]): number[][] {
  const seen = new Set<string>()
  const result: number[][] = []
  for (const order of orders) {
    const key = order.join(",")
    if (seen.has(key)) continue
    seen.add(key)
    result.push([...order])
  }
  return result
}

function countPossiblePermutations(total: number): number {
  if (total <= 1) return 1
  if (total > 10) return Number.POSITIVE_INFINITY
  let result = 1
  for (let i = 2; i <= total; i++) result *= i
  return result
}

function hashSeed(seed: string): number {
  let hash = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 3432918353)
    hash = (hash << 13) | (hash >>> 19)
  }
  return (hash >>> 0) || 1
}

function mulberry32(seed: number): number {
  let t = (seed += 0x6d2b79f5)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/**
 * Рассчитывает баллы за ответ на основе времени
 */
export function calculateScore(isCorrect: boolean, basePoints: number, timeSpent: number, timeLimit: number): number {
  if (!isCorrect || typeof basePoints !== "number" || basePoints <= 0) return 0
  if (typeof timeSpent !== "number" || typeof timeLimit !== "number") return basePoints

  // Если ответил за первые 3% времени - максимальные баллы
  const minTimeForMax = timeLimit * 0.03

  if (timeSpent <= minTimeForMax) {
    return basePoints
  }

  // Линейная обратная зависимость от времени
  const timeRatio = Math.max(0, (timeLimit - timeSpent) / (timeLimit - minTimeForMax))
  const minPoints = Math.floor(basePoints * 0.1) // Минимум 10% от базовых баллов

  return Math.max(minPoints, Math.round(basePoints * timeRatio))
}

/**
 * Форматирует время в читаемый вид
 */
export function formatTime(milliseconds: number): string {
  if (typeof milliseconds !== "number" || milliseconds < 0) return "0с"

  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  return `${remainingSeconds}с`
}

/**
 * Проверяет правильность ответа
 */
export function checkAnswer(userAnswer: any, correctAnswers: any[]): boolean {
  if (!correctAnswers || !Array.isArray(correctAnswers) || correctAnswers.length === 0) return false

  if (Array.isArray(userAnswer)) {
    // Для множественного выбора
    if (userAnswer.length !== correctAnswers.length) return false
    return userAnswer.every((answer) => correctAnswers.includes(answer))
  }

  if (typeof userAnswer === "string") {
    // Для текстовых ответов (регистронезависимо)
    const normalizedUserAnswer = userAnswer.toLowerCase().trim()
    return correctAnswers.some((answer) => {
      if (typeof answer === "string") {
        return answer.toLowerCase().trim() === normalizedUserAnswer
      }
      return answer.toString().toLowerCase().trim() === normalizedUserAnswer
    })
  }

  // Для одиночного выбора
  return correctAnswers.includes(userAnswer)
}

/**
 * Генерирует уникальный ID для игрока
 */
export function generatePlayerId(): string {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Генерирует уникальный ID для вопроса
 */
export function generateQuestionId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Валидирует код игры
 */
export function validateGameCode(code: string): boolean {
  if (typeof code !== "string") return false
  return /^[A-Z0-9]{6}$/.test(code)
}

/**
 * Нормализует никнейм игрока
 */
export function normalizeNickname(nickname: string): string {
  if (typeof nickname !== "string") return ""
  return nickname.trim().slice(0, 20)
}

/**
 * Безопасно получает массив
 */
export function safeArray<T>(value: any): T[] {
  if (Array.isArray(value)) return value
  return []
}

/**
 * Безопасно получает объект
 */
export function safeObject<T>(value: any): Record<string, T> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value
  return {}
}

/**
 * Безопасно получает число
 */
export function safeNumber(value: any, defaultValue = 0): number {
  if (typeof value === "number" && !isNaN(value)) return value
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    if (!isNaN(parsed)) return parsed
  }
  return defaultValue
}

/**
 * Безопасно получает строку
 */
export function safeString(value: any, defaultValue = ""): string {
  if (typeof value === "string") return value
  if (value !== null && value !== undefined) return String(value)
  return defaultValue
}

/**
 * Безопасно получает булево значение
 */
export function safeBoolean(value: any, defaultValue = false): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "string") return value.toLowerCase() === "true"
  if (typeof value === "number") return value !== 0
  return defaultValue
}

/**
 * Генерирует случайный код (алиас для generateGameCode для обратной совместимости)
 */
export function generateRandomCode(): string {
  return generateGameCode()
}

// Экспорт для обратной совместимости
