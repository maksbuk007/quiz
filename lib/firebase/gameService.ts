import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore"
import { ref, set, get, update, onValue, remove } from "firebase/database"
import { realtimeDb, db } from "./config"
import type { Game, GameSession, Player, ChatMessage, PlayerAnswer } from "@/types/game"

export class GameService {
  // Создание новой игры
  static async createGame(gameData: Omit<Game, "id" | "createdAt" | "updatedAt">): Promise<string> {
    try {
      console.log("Создание новой игры:", gameData.title)

      const gameRef = doc(collection(db, "games"))
      const game: Game = {
        ...gameData,
        id: gameRef.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await setDoc(gameRef, game)
      console.log("Игра создана с ID:", gameRef.id)

      return gameRef.id
    } catch (error) {
      console.error("Ошибка создания игры:", error)
      throw new Error("Не удалось создать игру")
    }
  }

  // Получение игры по ID
  static async getGameById(gameId: string): Promise<Game | null> {
    try {
      console.log("Загрузка игры:", gameId)

      const gameDoc = await getDoc(doc(db, "games", gameId))
      if (!gameDoc.exists()) {
        console.log("Игра не найдена:", gameId)
        return null
      }

      const game = { id: gameDoc.id, ...gameDoc.data() } as Game
      console.log("Игра загружена:", game.title)
      return game
    } catch (error) {
      console.error("Ошибка загрузки игры:", error)
      throw new Error("Не удалось загрузить игру")
    }
  }

  // ИСПРАВЛЕНО: Добавлен метод getGame как алиас
  static async getGame(gameId: string): Promise<Game | null> {
    return this.getGameById(gameId)
  }

  // Поиск игры по коду
  static async findGameByCode(code: string): Promise<Game | null> {
    try {
      const upperCode = code.toUpperCase()
      console.log("Ищем игру с кодом:", upperCode)

      const gamesRef = collection(db, "games")
      const q = query(gamesRef, where("code", "==", upperCode))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        console.log("Игра не найдена")
        return null
      }

      const doc = querySnapshot.docs[0]
      const game = {
        id: doc.id,
        ...doc.data(),
      } as Game

      console.log("Найдена игра:", game.title)
      return game
    } catch (error) {
      console.error("Ошибка поиска игры:", error)
      return null
    }
  }

  // Создание сессии игры
  static async createSession(gameId: string, hostId: string, gameCode: string): Promise<void> {
    const sessionRef = ref(realtimeDb, `sessions/${gameId}`)
    const session: GameSession = {
      gameId,
      hostId,
      code: gameCode,
      status: "waiting",
      currentQuestionIndex: 0,
      players: {},
      createdAt: Date.now(),
      showResults: false,
      showLeaderboard: false,
    }

    await set(sessionRef, session)
  }

  // Подписка на обновления сессии
  static subscribeToSession(gameId: string, callback: (session: GameSession | null) => void): () => void {
    const sessionRef = ref(realtimeDb, `sessions/${gameId}`)
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val()
      callback(data)
    })

    return unsubscribe
  }

  // Добавление игрока в сессию
  static async addPlayerToSession(gameId: string, player: Player): Promise<void> {
    const playerRef = ref(realtimeDb, `sessions/${gameId}/players/${player.id}`)
    await set(playerRef, player)
  }

  // Удаление игрока из сессии
  static async removePlayerFromSession(gameId: string, playerId: string): Promise<void> {
    const playerRef = ref(realtimeDb, `sessions/${gameId}/players/${playerId}`)
    await remove(playerRef)
  }

  // Присоединение игрока к игре
  static async joinGame(gameId: string, player: Player): Promise<void> {
    try {
      console.log("Добавляем игрока в сессию:", player.id)

      const sessionRef = ref(realtimeDb, `sessions/${gameId}`)
      const playerRef = ref(realtimeDb, `sessions/${gameId}/players/${player.id}`)

      await update(playerRef, {
        ...player,
        joinedAt: Date.now(),
        lastActivity: Date.now(),
      })

      console.log("Игрок успешно добавлен в сессию:", player.id)
    } catch (error) {
      console.error("Ошибка присоединения к игре:", error)
      throw new Error("Не удалось присоединиться к игре")
    }
  }

  // Обновление статуса игрока
  static async updatePlayerStatus(gameId: string, playerId: string, updates: Partial<Player>): Promise<void> {
    const playerRef = ref(realtimeDb, `sessions/${gameId}/players/${playerId}`)
    await update(playerRef, updates)
  }

  // Отправка ответа игрока
  static async submitAnswer(gameId: string, playerId: string, answer: PlayerAnswer): Promise<void> {
    try {
      console.log("Отправка ответа игрока:", playerId, answer.questionId)

      const playerRef = ref(realtimeDb, `sessions/${gameId}/players/${playerId}`)

      // Получаем текущие данные игрока
      const snapshot = await new Promise<any>((resolve, reject) => {
        onValue(playerRef, resolve, reject, { onlyOnce: true })
      })

      const playerData = snapshot.val()
      if (!playerData) {
        throw new Error("Игрок не найден")
      }

      const currentAnswers = playerData.answers || []
      const newAnswers = [...currentAnswers, answer]
      const newScore = (playerData.score || 0) + answer.points

      await update(playerRef, {
        answers: newAnswers,
        score: newScore,
        lastActivity: Date.now(),
      })

      console.log("Ответ игрока сохранен:", playerId, "Новый счет:", newScore)
    } catch (error) {
      console.error("Ошибка отправки ответа:", error)
      throw new Error("Не удалось отправить ответ")
    }
  }

  // Отправка сообщения в чат
  static async sendChatMessage(gameId: string, messageData: Omit<ChatMessage, "id">): Promise<string> {
    try {
      console.log("Отправка сообщения в чат:", messageData.message)

      const chatRef = ref(realtimeDb, `sessions/${gameId}/chatMessages`)
      const newMessageRef = ref(chatRef, Date.now().toString())

      const messageWithId = {
        ...messageData,
        id: newMessageRef.key,
        timestamp: messageData.timestamp || Date.now(),
      }

      await set(newMessageRef, messageWithId)
      console.log("Сообщение отправлено в чат с ID:", newMessageRef.key)

      return newMessageRef.key as string
    } catch (error) {
      console.error("Ошибка отправки сообщения:", error)
      throw new Error("Не удалось отправить сообщение")
    }
  }

  // Очистка чата
  static async clearChat(gameId: string): Promise<void> {
    try {
      console.log("[v0] Очистка чата для игры:", gameId)
      const chatRef = ref(realtimeDb, `sessions/${gameId}/chat`)
      await remove(chatRef)
      console.log("[v0] Чат успешно очищен")
    } catch (error) {
      console.error("Ошибка очистки чата:", error)
      throw new Error("Не удалось очистить чат")
    }
  }

  // Удаление сообщения из чата
  static async deleteMessage(gameId: string, messageId: string): Promise<void> {
    try {
      console.log("[v0] Удаление сообщения:", messageId, "из игры:", gameId)
      const messageRef = ref(realtimeDb, `sessions/${gameId}/chat/${messageId}`)
      await remove(messageRef)
      console.log("[v0] Сообщение успешно удалено")
    } catch (error) {
      console.error("Ошибка удаления сообщения:", error)
      throw new Error("Не удалось удалить сообщение")
    }
  }

  // Начало игры
  static async startGame(gameId: string): Promise<void> {
    const sessionRef = ref(realtimeDb, `sessions/${gameId}`)
    const snapshot = await get(sessionRef)
    const session = snapshot.val()

    if (!session) {
      throw new Error("Сессия не найдена")
    }

    await update(sessionRef, {
      status: "active",
      currentQuestionIndex: 0,
      questionStartTime: Date.now(),
      sessionId: `${gameId}_${Date.now()}`, // Unique session ID
      startTime: Date.now(), // Session start time for analytics
      phase: "QUESTION",
    })
  }

  // Переход к следующему вопросу
  static async nextQuestion(gameId: string, questionIndex?: number): Promise<void> {
    try {
      console.log("Переход к вопросу:", questionIndex)

      const sessionRef = ref(realtimeDb, `sessions/${gameId}`)

      // Получаем текущую сессию
      const snapshot = await new Promise<any>((resolve, reject) => {
        onValue(sessionRef, resolve, reject, { onlyOnce: true })
      })

      const session = snapshot.val() as GameSession
      const nextIndex = questionIndex ?? session.currentQuestionIndex + 1

      await update(sessionRef, {
        status: "active",
        currentQuestionIndex: nextIndex,
        questionStartTime: Date.now(),
        showResults: false,
        showLeaderboard: false,
        showPodium: false,
      })

      console.log("Переход к вопросу выполнен:", nextIndex)
    } catch (error) {
      console.error("Ошибка перехода к вопросу:", error)
      throw new Error("Не удалось перейти к следующему вопросу")
    }
  }

  // Показ результатов вопроса
  static async showResults(gameId: string): Promise<void> {
    try {
      console.log("Показ результатов вопроса для игры:", gameId)

      const sessionRef = ref(realtimeDb, `sessions/${gameId}`)
      await update(sessionRef, {
        status: "active",
        showResults: true,
        showLeaderboard: false,
        showPodium: false,
      })

      console.log("Результаты вопроса показаны:", gameId)
    } catch (error) {
      console.error("Ошибка показа результатов:", error)
      throw new Error("Не удалось показать результаты")
    }
  }

  // Показ лидерборда
  static async showLeaderboard(gameId: string): Promise<void> {
    try {
      console.log("Показ лидерборда для игры:", gameId)

      const sessionRef = ref(realtimeDb, `sessions/${gameId}`)
      await update(sessionRef, {
        status: "active",
        showResults: false,
        showLeaderboard: true,
        showPodium: false,
      })

      console.log("Лидерборд показан:", gameId)
    } catch (error) {
      console.error("Ошибка показа лидерборда:", error)
      throw new Error("Не удалось показать лидерборд")
    }
  }

  // Пауза игры
  static async pauseGame(gameId: string): Promise<void> {
    try {
      console.log("Пауза игры:", gameId)

      const sessionRef = ref(realtimeDb, `sessions/${gameId}`)
      await update(sessionRef, {
        status: "paused",
        showResults: false,
        showLeaderboard: false,
        showPodium: false,
      })

      console.log("Игра поставлена на паузу:", gameId)
    } catch (error) {
      console.error("Ошибка паузы игры:", error)
      throw new Error("Не удалось поставить игру на паузу")
    }
  }

  // Завершение игры
  static async finishGame(gameId: string): Promise<void> {
    try {
      console.log("Завершение игры:", gameId)

      const sessionRef = ref(realtimeDb, `sessions/${gameId}`)

      await update(sessionRef, {
        status: "finished",
        showResults: false,
        showLeaderboard: false,
        showPodium: true,
        finishedAt: Date.now(),
        completedAt: Date.now(), // For session analytics
      })

      console.log("Игра завершена:", gameId)
    } catch (error) {
      console.error("Ошибка завершения игры:", error)
      throw new Error("Не удалось завершить игру")
    }
  }

  // Окончание игры (алиас для совместимости)
  static async endGame(gameId: string): Promise<void> {
    const sessionRef = ref(realtimeDb, `sessions/${gameId}`)
    await update(sessionRef, {
      status: "finished",
      showResults: false,
      showLeaderboard: false,
      completedAt: Date.now(),
    })
  }

  // Исключение игрока
  static async kickPlayer(gameId: string, playerId: string, reason = "Нарушение правил"): Promise<void> {
    try {
      console.log("Исключение игрока:", playerId, "Причина:", reason)

      const playerRef = ref(realtimeDb, `sessions/${gameId}/players/${playerId}`)
      await update(playerRef, {
        isKicked: true,
        kickReason: reason,
        kickedAt: Date.now(),
        isConnected: false,
      })

      // Добавляем системное сообщение
      await this.sendChatMessage(gameId, {
        playerId: "system",
        playerName: "Система",
        playerAvatar: "",
        message: `Игрок был исключен из игры. Причина: ${reason}`,
        timestamp: Date.now(),
        type: "system",
      })

      console.log("Игрок исключен:", playerId)
    } catch (error) {
      console.error("Ошибка исключения игрока:", error)
      throw new Error("Не удалось исключить игрока")
    }
  }

  // Полный перезапуск игры
  static async fullRestartGame(gameId: string): Promise<void> {
    try {
      console.log("Полный перезапуск игры:", gameId)

      const sessionRef = ref(realtimeDb, `sessions/${gameId}`)

      // Получаем текущую сессию для сохранения базовых данных
      const snapshot = await get(sessionRef)
      const currentSession = snapshot.val()
      if (!currentSession) {
        throw new Error("Сессия не найдена")
      }

      const playersRef = ref(realtimeDb, `sessions/${gameId}/players`)
      await remove(playersRef)

      const cleanSession: GameSession = {
        gameId: currentSession.gameId,
        code: currentSession.code,
        status: "waiting",
        players: {},
        currentQuestionIndex: 0,
        leaderboard: [],
        hostId: currentSession.hostId,
        chat: {},
        notifications: [],
        showResults: false,
        showLeaderboard: false,
        showPodium: false,
        createdAt: currentSession.createdAt,
        phase: "WAITING",
        mode: currentSession.mode,
        selfPacedSettings: currentSession.selfPacedSettings,
        broadcastView: null,
        broadcastViewAt: Date.now(),
        timersFrozenAt: null,
      }

      await set(sessionRef, cleanSession)

      console.log("Игра полностью перезапущена:", gameId)
    } catch (error) {
      console.error("Ошибка полного перезапуска игры:", error)
      throw new Error("Не удалось перезапустить игру")
    }
  }

  // Получение всех игр пользователя
  static async getUserGames(userId: string): Promise<Game[]> {
    try {
      console.log("Загрузка игр пользователя:", userId)

      const gamesRef = collection(db, "games")
      const q = query(gamesRef, where("createdBy", "==", userId), orderBy("updatedAt", "desc"))
      const querySnapshot = await getDocs(q)

      const games = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Game[]

      console.log("Загружено игр:", games.length)
      return games
    } catch (error) {
      console.error("Ошибка загрузки игр пользователя:", error)
      throw new Error("Не удалось загрузить игры")
    }
  }

  // Обновление игры
  static async updateGame(gameId: string, updates: Partial<Game>): Promise<void> {
    try {
      console.log("Обновление игры:", gameId)

      // Фильтруем undefined значения
      const cleanUpdates = Object.fromEntries(Object.entries(updates).filter(([_, value]) => value !== undefined))

      const gameRef = doc(db, "games", gameId)
      await updateDoc(gameRef, {
        ...cleanUpdates,
        updatedAt: Date.now(),
      })

      console.log("Игра обновлена:", gameId)
    } catch (error) {
      console.error("Ошибка обновления игры:", error)
      throw new Error("Не удалось обновить игру")
    }
  }

  // Удаление игры
  static async deleteGame(gameId: string): Promise<void> {
    try {
      console.log("Удаление игры:", gameId)

      // Удаляем игру из Firestore
      const gameRef = doc(db, "games", gameId)
      await deleteDoc(gameRef)

      // Удаляем сессию из Realtime Database
      const sessionRef = ref(realtimeDb, `sessions/${gameId}`)
      await remove(sessionRef)

      console.log("Игра удалена:", gameId)
    } catch (error) {
      console.error("Ошибка удаления игры:", error)
      throw new Error("Не удалось удалить игру")
    }
  }

  // ─── Self-paced mode ────────────────────────────────────────────────────────

  static async createSelfPacedSession(
    gameId: string,
    hostId: string,
    gameCode: string,
    settings: import("@/types/game").SelfPacedSettings,
  ): Promise<void> {
    const sessionRef = ref(realtimeDb, `sessions/${gameId}`)
    const session = {
      gameId,
      hostId,
      code: gameCode,
      status: "waiting",
      mode: "self_paced",
      selfPacedSettings: settings,
      currentQuestionIndex: 0,
      players: {},
      createdAt: Date.now(),
      showResults: false,
      showLeaderboard: false,
      showPodium: false,
      phase: "WAITING",
      chat: {},
      leaderboard: [],
      timersFrozenAt: null,
    }
    await set(sessionRef, session)
  }

  static async startSelfPacedGame(gameId: string, _questionCount: number): Promise<void> {
    const sessionRef = ref(realtimeDb, `sessions/${gameId}`)
    await update(sessionRef, {
      status: "active",
      phase: "QUESTION",
      sessionId: `${gameId}_${Date.now()}`,
      startTime: Date.now(),
      timersFrozenAt: null,
    })
  }

  static async initPlayerSelfPacedProgress(
    gameId: string,
    playerId: string,
    questionOrder: number[],
  ): Promise<void> {
    const playerRef = ref(realtimeDb, `sessions/${gameId}/players/${playerId}`)
    const progress: import("@/types/game").PlayerSelfPacedProgress = {
      questionOrder,
      currentIndex: 0,
      finished: false,
      questionStartTimes: { 0: Date.now() },
    }
    await update(playerRef, { selfPaced: progress })
  }

  static async submitSelfPacedAnswer(
    gameId: string,
    playerId: string,
    answer: import("@/types/game").PlayerAnswer,
    nextIndex: number,
    totalQuestions: number,
  ): Promise<void> {
    const playerRef = ref(realtimeDb, `sessions/${gameId}/players/${playerId}`)
    const snapshot = await get(playerRef)
    const playerData = snapshot.val()
    if (!playerData) throw new Error("Player not found")

    const currentAnswers: any[] = Array.isArray(playerData.answers) ? playerData.answers : []
    const newScore = (playerData.score || 0) + answer.points
    const finished = nextIndex >= totalQuestions

    await update(playerRef, {
      answers: [...currentAnswers, answer],
      score: newScore,
      lastActivity: Date.now(),
      lastQuestionDelta: answer.points,
      [`selfPaced/currentIndex`]: nextIndex,
      [`selfPaced/finished`]: finished,
      ...(finished ? { [`selfPaced/finishedAt`]: Date.now() } : {}),
      ...(!finished ? { [`selfPaced/questionStartTimes/${nextIndex}`]: Date.now() } : {}),
    })
  }

  static async finishSelfPacedGame(gameId: string): Promise<void> {
    const sessionRef = ref(realtimeDb, `sessions/${gameId}`)
    const now = Date.now()
    await update(sessionRef, {
      status: "finished",
      phase: "FINISHED",
      showPodium: true,
      completedAt: now,
      finishedAt: now,
      // Clear any host-broadcasted view — admin can re-trigger the podium
      // explicitly via the control panel.
      broadcastView: null,
      broadcastViewAt: now,
      timersFrozenAt: now,
    })
  }

  /**
   * Broadcast a view (podium / leaderboard) to every connected player of a
   * self-paced session. Pass null to clear the broadcast.
   */
  static async setBroadcastView(
    gameId: string,
    view: "podium" | "leaderboard" | null,
  ): Promise<void> {
    const sessionRef = ref(realtimeDb, `sessions/${gameId}`)
    await update(sessionRef, {
      broadcastView: view,
      broadcastViewAt: Date.now(),
    })
  }
}

// Экспорт отдельных функций для обратной совместимости
export const createGame = GameService.createGame.bind(GameService)
export const getGameById = GameService.getGameById.bind(GameService)
export const getGame = GameService.getGame.bind(GameService)
export const findGameByCode = GameService.findGameByCode.bind(GameService)
export const createSession = GameService.createSession.bind(GameService)
export const subscribeToSession = GameService.subscribeToSession.bind(GameService)
export const joinGame = GameService.joinGame.bind(GameService)
export const updatePlayerStatus = GameService.updatePlayerStatus.bind(GameService)
export const submitAnswer = GameService.submitAnswer.bind(GameService)
export const sendChatMessage = GameService.sendChatMessage.bind(GameService)
export const clearChat = GameService.clearChat.bind(GameService)
export const deleteMessage = GameService.deleteMessage.bind(GameService)
export const startGame = GameService.startGame.bind(GameService)
export const nextQuestion = GameService.nextQuestion.bind(GameService)
export const showResults = GameService.showResults.bind(GameService)
export const showLeaderboard = GameService.showLeaderboard.bind(GameService)
export const pauseGame = GameService.pauseGame.bind(GameService)
export const finishGame = GameService.finishGame.bind(GameService)
export const endGame = GameService.endGame.bind(GameService)
export const kickPlayer = GameService.kickPlayer.bind(GameService)
export const fullRestartGame = GameService.fullRestartGame.bind(GameService)
export const getUserGames = GameService.getUserGames.bind(GameService)
export const updateGame = GameService.updateGame.bind(GameService)
export const deleteGame = GameService.deleteGame.bind(GameService)

export const createSelfPacedSession = GameService.createSelfPacedSession.bind(GameService)
export const startSelfPacedGame = GameService.startSelfPacedGame.bind(GameService)
export const initPlayerSelfPacedProgress = GameService.initPlayerSelfPacedProgress.bind(GameService)
export const submitSelfPacedAnswer = GameService.submitSelfPacedAnswer.bind(GameService)
export const finishSelfPacedGame = GameService.finishSelfPacedGame.bind(GameService)
export const setBroadcastView = GameService.setBroadcastView.bind(GameService)

export default GameService
