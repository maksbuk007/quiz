export class SoundService {
  private static audioContext: AudioContext | null = null
  private static enabled = true

  // Инициализация аудио контекста
  static async initialize(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

      // Проверяем настройки пользователя
      const savedSetting = localStorage.getItem("maxquiz-sounds-enabled")
      this.enabled = savedSetting !== "false"
    } catch (error) {
      console.warn("Не удалось инициализировать аудио:", error)
    }
  }

  // Включение/выключение звуков
  static setEnabled(enabled: boolean): void {
    this.enabled = enabled
    localStorage.setItem("maxquiz-sounds-enabled", enabled.toString())
  }

  static isEnabled(): boolean {
    return this.enabled
  }

  // Воспроизведение звука
  private static async playTone(
    frequency: number,
    duration: number,
    volume = 0.1,
    type: OscillatorType = "sine",
  ): Promise<void> {
    if (!this.enabled || !this.audioContext) return

    try {
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime)
      oscillator.type = type

      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration)

      oscillator.start(this.audioContext.currentTime)
      oscillator.stop(this.audioContext.currentTime + duration)
    } catch (error) {
      console.warn("Ошибка воспроизведения звука:", error)
    }
  }

  // Звук правильного ответа
  static async playCorrectAnswer(): Promise<void> {
    await this.playTone(800, 0.2, 0.15)
    setTimeout(() => this.playTone(1000, 0.2, 0.15), 100)
  }

  // Звук неправильного ответа
  static async playWrongAnswer(): Promise<void> {
    await this.playTone(300, 0.4, 0.2, "sawtooth")
  }

  // Звук нового сообщения в чате
  static async playNewMessage(): Promise<void> {
    await this.playTone(600, 0.1, 0.1)
  }

  // Звук присоединения игрока
  static async playPlayerJoined(): Promise<void> {
    await this.playTone(500, 0.15, 0.1)
    setTimeout(() => this.playTone(700, 0.15, 0.1), 150)
  }

  // Звук начала игры
  static async playGameStart(): Promise<void> {
    await this.playTone(400, 0.2, 0.15)
    setTimeout(() => this.playTone(500, 0.2, 0.15), 200)
    setTimeout(() => this.playTone(600, 0.3, 0.15), 400)
  }

  // Звук завершения игры
  static async playGameEnd(): Promise<void> {
    await this.playTone(800, 0.3, 0.2)
    setTimeout(() => this.playTone(600, 0.3, 0.2), 300)
    setTimeout(() => this.playTone(400, 0.5, 0.2), 600)
  }

  // Звук достижения
  static async playAchievement(): Promise<void> {
    await this.playTone(800, 0.2, 0.2)
    setTimeout(() => this.playTone(1000, 0.2, 0.2), 200)
    setTimeout(() => this.playTone(1200, 0.3, 0.2), 400)
  }

  // Звук предупреждения
  static async playWarning(): Promise<void> {
    await this.playTone(400, 0.1, 0.15)
    setTimeout(() => this.playTone(400, 0.1, 0.15), 150)
    setTimeout(() => this.playTone(400, 0.1, 0.15), 300)
  }

  // Звук тикания таймера (последние 5 секунд)
  static async playTick(): Promise<void> {
    await this.playTone(800, 0.05, 0.1)
  }

  // Звук окончания времени
  static async playTimeUp(): Promise<void> {
    await this.playTone(200, 0.8, 0.3, "square")
  }

  // Звук победы
  static async playVictory(): Promise<void> {
    const notes = [523, 659, 784, 1047] // C, E, G, C
    for (let i = 0; i < notes.length; i++) {
      setTimeout(() => this.playTone(notes[i], 0.3, 0.2), i * 200)
    }
  }

  // Звук нового вопроса
  static async playNewQuestion(): Promise<void> {
    await this.playTone(600, 0.2, 0.12)
    setTimeout(() => this.playTone(800, 0.2, 0.12), 100)
  }

  // Звук уведомления
  static async playNotification(): Promise<void> {
    await this.playTone(700, 0.15, 0.1)
  }
}
