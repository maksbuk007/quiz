/**
 * Формула расчета баллов за правильный ответ
 *
 * @param basePoints - Максимальное количество баллов за вопрос (установлено админом)
 * @param timeSpent - Время, затраченное на ответ (в миллисекундах)
 * @param timeLimit - Лимит времени на вопрос (в миллисекундах)
 * @returns Количество баллов с учетом затраченного времени
 */
export function calculatePoints(basePoints: number, timeSpent: number, timeLimit: number): number {
  // Валидация входных данных
  if (!Number.isFinite(basePoints) || basePoints <= 0) {
    console.warn("[v0] Invalid basePoints:", basePoints)
    return 0
  }

  if (!Number.isFinite(timeSpent) || timeSpent < 0) {
    console.warn("[v0] Invalid timeSpent:", timeSpent)
    timeSpent = 0
  }

  if (!Number.isFinite(timeLimit) || timeLimit <= 0) {
    console.warn("[v0] Invalid timeLimit:", timeLimit)
    return Math.floor(basePoints * 0.1) // Минимальные баллы
  }

  // Минимальное время для получения максимального балла (3% от лимита времени)
  const minTimeForMax = timeLimit * 0.03

  // Если ответили очень быстро - даем максимум баллов
  if (timeSpent <= minTimeForMax) {
    return basePoints
  }

  // Если время истекло или превысило лимит - даем минимум баллов
  if (timeSpent >= timeLimit) {
    return Math.floor(basePoints * 0.1)
  }

  // Линейная интерполяция между максимумом и минимумом
  const timeRatio = Math.max(0, (timeLimit - timeSpent) / (timeLimit - minTimeForMax))
  const minPoints = Math.floor(basePoints * 0.1)
  const calculatedPoints = Math.round(basePoints * timeRatio)

  return Math.max(minPoints, calculatedPoints)
}

/**
 * Получить текстовое описание формулы расчета баллов
 */
export function getPointsCalculationDescription(): string {
  return `
Формула расчета баллов:
- Ответ в первые 3% времени → максимальные баллы
- Ответ после истечения времени → минимум (10% от максимума)
- Промежуточное время → линейная интерполяция
  `.trim()
}
