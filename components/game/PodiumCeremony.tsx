"use client"

import { useEffect, useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trophy, Star, Sparkles, PartyPopper, Home, RotateCcw, Flame, Zap, Medal } from "lucide-react"
import { AVATARS } from "@/components/ui/AvatarSelector"
import type { Player } from "@/types/game"
import confetti from "canvas-confetti"

interface PodiumCeremonyProps {
  players: Player[]
  currentPlayer?: Player
  onComplete?: () => void
}

export default function PodiumCeremonyFixed({ players, currentPlayer, onComplete }: PodiumCeremonyProps) {
  const [showCelebration, setShowCelebration] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [showStats, setShowStats] = useState(false)
  const [particlesActive, setParticlesActive] = useState(false)
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"))
    }

    checkTheme()

    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })

    return () => observer.disconnect()
  }, [])

  const topPlayers = players.slice(0, 3)

  const getAvatarDisplay = (avatarId: string | undefined, size: "sm" | "md" | "lg" = "md") => {
    const avatar = AVATARS.find((a) => a.id === avatarId)
    const sizeMap = {
      sm: {
        mobile: { width: 40, height: 40, fontSize: 20 },
        tablet: { width: 54, height: 54, fontSize: 27 },
        desktop: { width: 68, height: 68, fontSize: 34 },
      },
      md: {
        mobile: { width: 68, height: 68, fontSize: 34 },
        tablet: { width: 95, height: 95, fontSize: 54 },
        desktop: { width: 122, height: 122, fontSize: 68 },
      },
      lg: {
        mobile: { width: 82, height: 82, fontSize: 41 },
        tablet: { width: 109, height: 109, fontSize: 68 },
        desktop: { width: 150, height: 150, fontSize: 85 },
      },
    }

    const isMobile = typeof window !== "undefined" && window.innerWidth < 640
    const isTablet = typeof window !== "undefined" && window.innerWidth >= 640 && window.innerWidth < 1024
    const screenSize = isMobile ? "mobile" : isTablet ? "tablet" : "desktop"
    const s = sizeMap[size][screenSize]

    if (!avatar) {
      return (
        <div
          style={{
            width: s.width,
            height: s.height,
            borderRadius: 16,
            background: "rgb(209, 213, 219)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            fontSize: s.fontSize,
          }}
        >
          <span style={{ color: "rgb(107, 114, 128)" }}>?</span>
        </div>
      )
    }

    return (
      <div
        className={avatar.color}
        style={{
          width: s.width,
          height: s.height,
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          fontSize: s.fontSize,
        }}
      >
        {avatar.emoji}
      </div>
    )
  }

  const fireConfetti = useCallback(() => {
    const duration = 3000
    const animationEnd = Date.now() + duration
    const colors = ["#FFD700", "#FFA500", "#FF6347", "#9370DB", "#00CED1"]

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now()
      if (timeLeft <= 0) return clearInterval(interval)

      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      })
    }, 50)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setShowCelebration(true)

    const step1 = setTimeout(() => {
      setCurrentStep(1)
      setParticlesActive(true)
    }, 600)
    const step2 = setTimeout(() => setCurrentStep(2), 1800)
    const step3 = setTimeout(() => {
      setCurrentStep(3)
      fireConfetti()
    }, 3000)
    const step4 = setTimeout(() => setShowStats(true), 5000)

    return () => {
      clearTimeout(step1)
      clearTimeout(step2)
      clearTimeout(step3)
      clearTimeout(step4)
    }
  }, [showCelebration, fireConfetti])

  const getPlayerForPosition = (position: number) => {
    if (position === 0) return topPlayers[0]
    if (position === 1) return topPlayers[1]
    if (position === 2) return topPlayers[2]
    return null
  }

  const getMedalIcon = (position: number) => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640
    const isTablet = typeof window !== "undefined" && window.innerWidth >= 640 && window.innerWidth < 1024

    const sizes = {
      0: isMobile ? 40 : isTablet ? 56 : 72,
      1: isMobile ? 36 : isTablet ? 48 : 64,
      2: isMobile ? 32 : isTablet ? 40 : 56,
    }
    const colors = { 0: "#facc15", 1: "#cbd5e1", 2: "#fb923c" }
    return (
      <Medal
        style={{
          width: sizes[position as keyof typeof sizes],
          height: sizes[position as keyof typeof sizes],
          color: colors[position as keyof typeof colors],
        }}
      />
    )
  }

  const renderPodiumPlace = (position: number, order: string, stepRequired: number) => {
    const player = getPlayerForPosition(position)
    if (!player) return null

    const isMobile = typeof window !== "undefined" && window.innerWidth < 640
    const isTablet = typeof window !== "undefined" && window.innerWidth >= 640 && window.innerWidth < 1024

    // Proper podium proportions: 1st is tallest, 2nd is shortest, 3rd is medium
    // position 0 = 1st place (renders at order-2 center, tallest)
    // position 1 = 2nd place (renders at order-1 left, shortest)
    // position 2 = 3rd place (renders at order-3 right, medium)
    const heights = {
      0: isMobile ? 160 : isTablet ? 280 : 340,     // 1st place - tallest 
      1: isMobile ? 100 : isTablet ? 195 : 240,     // 2nd place - shortest 
      2: isMobile ? 70 : isTablet ? 140 : 170,      // 3rd place - medium
    }
    const widths = {
      0: isMobile ? 100 : isTablet ? 175 : 220,
      1: isMobile ? 85 : isTablet ? 155 : 180,
      2: isMobile ? 75 : isTablet ? 140 : 165,
    }

    const numberFontSizes = {
      0: isMobile ? 95 : isTablet ? 120 : 130, // Размер для 1-го места
      1: isMobile ? 65 : isTablet ? 90 : 100, // Размер для 2-го места
      2: isMobile ? 40 : isTablet ? 75 : 85, // Размер для 3-го места
    }

    const numberLeftMargin = {
      0: isMobile ? "26%" : isTablet ? "35%" : "35%",
      1: isMobile ? "25%" : isTablet ? "30%" : "31%",
      2: isMobile ? "33%" : isTablet ? "31%" : "33%",
    }

    // Premium podium colors with metallic effects
    const podiumColors = {
      0: {
        // 1st place - Gold
        light: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)",
        dark: "linear-gradient(135deg, #d97706 0%, #b45309 50%, #92400e 100%)",
      },
      1: {
        // 2nd place - Silver
        light: "linear-gradient(135deg, #e5e7eb 0%, #d1d5db 50%, #9ca3af 100%)",
        dark: "linear-gradient(135deg, #9ca3af 0%, #6b7280 50%, #4b5563 100%)",
      },
      2: {
        // 3rd place - Bronze
        light: "linear-gradient(135deg, #fb923c 0%, #f97316 50%, #dc2626 100%)",
        dark: "linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #7f1d1d 100%)",
      },
    }

    // Top surface reflects the medal colors
    const topSurfaceColors = position === 0 
      ? {
          light: "linear-gradient(to bottom, rgba(253, 224, 71, 0.9), rgba(251, 191, 36, 0.8))",
          dark: "linear-gradient(to bottom, rgba(217, 119, 6, 0.9), rgba(180, 83, 9, 0.8))",
        }
      : position === 1
      ? {
          light: "linear-gradient(to bottom, rgba(229, 231, 235, 0.9), rgba(209, 213, 219, 0.8))",
          dark: "linear-gradient(to bottom, rgba(156, 163, 175, 0.9), rgba(107, 114, 128, 0.8))",
        }
      : {
          light: "linear-gradient(to bottom, rgba(251, 146, 60, 0.9), rgba(249, 115, 22, 0.8))",
          dark: "linear-gradient(to bottom, rgba(220, 38, 38, 0.9), rgba(185, 28, 28, 0.8))",
        }

    const numberColors = { 0: "#facc15", 1: "#e2e8f0", 2: "#fb923c" }
    const avatarSize = position === 0 ? "lg" : position === 1 ? "md" : "sm"

    return (
      <motion.div
        initial={{ opacity: 0, y: 200, scale: 0.5 }}
        animate={{
          opacity: currentStep >= stepRequired ? 1 : 0,
          y: currentStep >= stepRequired ? 0 : 200,
          scale: currentStep >= stepRequired ? 1 : 0.5,
        }}
        transition={{ duration: 0.8, type: "spring", stiffness: 100, damping: 15 }}
        className={`flex flex-col items-center ${order} relative`}
        style={{
          transformStyle: "preserve-3d",
          WebkitTransformStyle: "preserve-3d",
        }}
      >
        {currentStep >= stepRequired && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, type: "spring", delay: 0.3 }}
            style={{ marginBottom: isMobile ? 8 : isTablet ? 16 : 24, position: "relative", zIndex: 10 }}
          >
            {getMedalIcon(position)}
          </motion.div>
        )}

        <motion.div
          initial={{ scale: 0 }}
          animate={currentStep >= stepRequired ? { scale: 1 } : { scale: 0 }}
          transition={{ duration: 0.5, type: "spring", delay: 0.4 }}
          style={{ position: "relative", zIndex: 10, marginBottom: isMobile ? 8 : isTablet ? 16 : 24 }}
        >
          {getAvatarDisplay(player?.avatar, avatarSize)}

          {position === 0 && currentStep >= 3 && (
            <div style={{ position: "absolute", inset: -8, pointerEvents: "none" }}>
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{
                    scale: [0.8, 2.8, 3],
                    opacity: [0, 0.8, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Number.POSITIVE_INFINITY,
                    delay: i * 2,
                    ease: "easeOut",
                  }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    border: "4px solid #facc15",
                    borderRadius: "9999px",
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>

        {currentStep >= stepRequired && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              style={{ marginBottom: isMobile ? 8 : isTablet ? 16 : 24, zIndex: 10 }}
            >
              <p
                style={{
                  fontSize: isMobile ? 12 : isTablet ? 14 : 16,
                  fontWeight: 700,
                  textAlign: "center",
                  padding: "0 8px",
                  color: isDark ? "#ffffff" : "#111827",
                }}
              >
                {player?.nickname || "Anonim"}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              style={{ marginBottom: isMobile ? 8 : isTablet ? 16 : 24, zIndex: 10 }}
            >
              <Badge 
                className={`
                  bg-white text-gray-900 border-2 border-gray-200 font-bold shadow-lg
                  ${isMobile ? "px-2 py-0.5 text-[10px]" : isTablet ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-base"}
                `}
              >
                <Trophy className={`${isMobile ? "w-3 h-3 mr-1" : "w-4 h-4 mr-1.5"}`} />
                {player?.score || 0}
              </Badge>

            </motion.div>
          </>
        )}

        <motion.div
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{
            scaleY: currentStep >= stepRequired ? 1 : 0,
            opacity: currentStep >= stepRequired ? 1 : 0,
          }}
          transition={{ duration: 0.7, delay: 0.3, type: "spring", stiffness: 100 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: heights[position as keyof typeof heights],
            width: widths[position as keyof typeof widths],
            // borderRadius: "16px 16px 0 0",
            borderRadius: "16px 16px 0 0",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            transformOrigin: "bottom",
            background: isDark
              ? podiumColors[position as keyof typeof podiumColors].dark
              : podiumColors[position as keyof typeof podiumColors].light,
            transformStyle: "preserve-3d",
            WebkitTransformStyle: "preserve-3d",
          }}
        >
          {/* Smooth top surface with inset shadow for depth 
           <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 20,
              top: -10,
              borderRadius: "60% 60% 20% 20% / 100% 100% 10% 10%",
              background: isDark ? topSurfaceColors.dark : topSurfaceColors.light,
              boxShadow: "inset 0 2px 6px rgba(255, 255, 255, 0.2), inset 0 -2px 4px rgba(0, 0, 0, 0.2), 0 4px 8px rgba(0, 0, 0, 0.3)",
            }}
          /> 
          */}

          <div
            style={{
              position: "absolute",
              left: 0,
              // top: 14,
              top: 0,
              bottom: 0,
              width: 40,
              background: "linear-gradient(to right, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.1), transparent)",
              borderTopLeftRadius: 16,
            }}
          />

          <div
            style={{
              position: "absolute",
              right: 0,
              // top: 14,
              top: 0,
              bottom: 0,
              width: 40,
              background: "linear-gradient(to left, rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.15), transparent)",
              borderTopRightRadius: 16,
            }}
          />

          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: isMobile ? "35%" : "30%",
              background: "linear-gradient(to top, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.25), transparent)",
              pointerEvents: "none",
            }}
          />

          {/* Position number */}
          <motion.span
            initial={{ scale: 0, rotate: -90 }}
            animate={currentStep >= stepRequired ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -90 }}
            transition={{ duration: 0.6, delay: 0.5, type: "spring" }}
            style={{
              fontWeight: 900,
              color: numberColors[position as keyof typeof numberColors],
              fontSize: numberFontSizes[position as keyof typeof numberFontSizes],
              position: "absolute",
              top: "30%",
              left: numberLeftMargin[position as keyof typeof numberLeftMargin],
              transform: "translate(-50%, -50%)",
              zIndex: 10,
              textShadow: "0 4px 12px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)",
              lineHeight: 1,
            }}
          >
            {position + 1}
          </motion.span>

          {/* Player name on podium */}
          {/* 
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 8 }}
            animate={currentStep >= stepRequired ? { scale: 1, opacity: 1, y: 0 } : { scale: 0, opacity: 0, y: 8 }}
            transition={{ duration: 0.5, delay: 0.8, type: "spring", stiffness: 120 }}
            style={{
              position: "absolute",
              bottom: isMobile ? 8 : 12,
              left: isMobile ? 4 : 8,
              right: isMobile ? 4 : 8,
              textAlign: "center",
              zIndex: 20,
              padding: "0 6px",
            }}
          >
            <p
              style={{
                fontSize: isMobile ? 10 : isTablet ? 12 : 13,
                fontWeight: 800,
                color: isDark ? "#ffffff" : "#000000",
                margin: 0,
                padding: 0,
                textShadow: isDark 
                  ? "0 1px 3px rgba(0, 0, 0, 0.8), 0 2px 4px rgba(0, 0, 0, 0.6)" 
                  : "0 1px 2px rgba(255, 255, 255, 0.5)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "100%",
                lineHeight: 1.2,
              }}
            >
              {player?.nickname || "Anonim"}
            </p>
          </motion.div> */}
        </motion.div>
      </motion.div>
    )
  }

  if (topPlayers.length === 0) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
        style={{ background: isDark ? "#020617" : "#eff6ff" }}
      >
        <div className="text-center">
          <Trophy className="w-24 h-24 text-yellow-500 dark:text-yellow-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Игра завершена!</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-8 text-lg">Нет участников для награждения</p>
          {onComplete && (
            <Button onClick={onComplete} size="lg">
              <Home className="w-5 h-5 mr-2" />
              Закрыть
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 flex flex-col justify-start z-50 overflow-y-auto"
      style={{ background: isDark ? "#020617" : "#eff6ff" }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: particlesActive ? 0.4 : 0 }}
          transition={{ duration: 1 }}
          className="absolute top-0 left-1/4 w-1 h-full bg-gradient-to-b from-blue-300/40 dark:from-blue-400/30 to-transparent blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: particlesActive ? 0.5 : 0 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-full bg-gradient-to-b from-blue-200/50 dark:from-blue-300/40 to-transparent blur-3xl"
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: particlesActive ? 0.4 : 0 }}
          transition={{ duration: 1, delay: 0.1 }}
          className="absolute top-0 right-1/4 w-1 h-full bg-gradient-to-b from-blue-300/40 dark:from-blue-400/30 to-transparent blur-3xl"
        />

        {particlesActive &&
          [...Array(40)].map((_, i) => {
            const colors = [
              "bg-yellow-400",
              "bg-red-400",
              "bg-blue-400",
              "bg-purple-400",
              "bg-orange-400",
              "bg-pink-400",
            ]
            const shapes = ["w-2 h-3", "w-3 h-2", "w-2 h-2"]
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: -20, x: `${20 + Math.random() * 60}vw`, rotate: Math.random() * 360 }}
                animate={{ opacity: [0, 1, 1, 0], y: "110vh", rotate: Math.random() * 720 }}
                transition={{
                  duration: 4 + Math.random() * 3,
                  delay: Math.random() * 2,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "linear",
                }}
                className={`absolute ${colors[i % colors.length]} ${shapes[i % shapes.length]} rounded-sm`}
              />
            )
          })}
      </div>

      <div className="max-h-[85vh] min-h-[85vh] flex flex-col justify-center items-center">
        <div className="relative w-full max-w-6xl mx-auto px-2 sm:px-4 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-1 sm:mb-2 lg:mb-4"
          >
            <div className="flex items-center justify-center gap-2 sm:gap-4 md:gap-6 lg:gap-8 xl:gap-10 mb-1 sm:mb-2 lg:mb-3">
              <motion.div
                animate={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              >
                <PartyPopper className="w-5 h-5 sm:w-10 sm:h-10 lg:w-16 lg:h-16 xl:w-20 xl:h-20 text-yellow-500 dark:text-yellow-400" />
              </motion.div>
              <h1
                className="text-2xl sm:text-4xl lg:text-6xl xl:text-7xl font-black"
                style={{
                  color: isDark ? "#ffffff" : "#111827", // Added missing comma
                  fontWeight: 900,
                }}
              >
                ПОБЕДИТЕЛИ
              </h1>
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              >
                <Sparkles className="w-5 h-5 sm:w-10 sm:h-10 lg:w-16 lg:h-16 xl:w-20 xl:h-20 text-purple-500 dark:text-purple-400" />
              </motion.div>
            </div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-xs sm:text-base lg:text-xl xl:text-2xl font-medium"
              style={{ color: isDark ? "#d1d5db" : "#374151" }}
            >
              Топ-3 игроков этой сессии
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex items-end justify-center gap-2 sm:gap-4 md:gap-6 lg:gap-8 xl:gap-10 px-1 sm:px-2"
            style={{
              transformStyle: "preserve-3d",
              perspective: "1000px",
              WebkitTransformStyle: "preserve-3d",
              WebkitPerspective: "1000px",
            }}
          >
            {renderPodiumPlace(1, "order-1", 2)}
            {renderPodiumPlace(0, "order-2", 3)}
            {renderPodiumPlace(2, "order-3", 1)}
          </motion.div>
        </div>
      </div>

      <div className="relative w-full max-w-6xl mx-auto px-2 sm:px-4 lg:px-8 pb-8 mt-4 sm:mt-6 lg:mt-8">
        <AnimatePresence>
          {showStats && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.95 }}
              transition={{ duration: 0.6 }}
            >
              <div
                className="p-3 sm:p-6 lg:p-10 xl:p-12 max-w-3xl mx-auto shadow-2xl"
                style={{
                  background: isDark ? "#1e293b" : "#ffffff",
                  borderColor: isDark ? "#475569" : "#e5e7eb",
                  borderWidth: "2px",
                  borderStyle: "solid",
                  borderRadius: "24px",
                  backdropFilter: "blur(12px)",
                }}
              >
                <motion.h3
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-base sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-center mb-3 sm:mb-6 lg:mb-10"
                  style={{ color: isDark ? "#ffffff" : "#111827" }}
                >
                  🎉 Спасибо за игру! 🎉
                </motion.h3>

                <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-8 mb-4 sm:mb-6 lg:mb-8">
                  {[
                    {
                      icon: <Zap className="w-4 h-4 sm:w-6 sm:h-6 lg:w-8 lg:h-8 xl:w-10 xl:h-10" />,
                      value: players.length,
                      label: "Участников",
                      color: "text-yellow-500 dark:text-yellow-400",
                    },
                    {
                      icon: <Flame className="w-4 h-4 sm:w-6 sm:h-6 lg:w-8 lg:h-8 xl:w-10 xl:h-10" />,
                      value: Math.max(...players.map((p) => p.score)),
                      label: "Макс. очков",
                      color: "text-orange-500 dark:text-orange-400",
                    },
                    {
                      icon: <Star className="w-4 h-4 sm:w-6 sm:h-6 lg:w-8 lg:h-8 xl:w-10 xl:h-10" />,
                      value: Math.round(players.reduce((acc, p) => acc + p.score, 0) / players.length),
                      label: "Средний балл",
                      color: "text-emerald-500 dark:text-emerald-400",
                    },
                  ].map((stat, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 + i * 0.1, type: "spring" }}
                      className="text-center"
                    >
                      <div className={`${stat.color} mb-1 sm:mb-2 flex justify-center`}>{stat.icon}</div>
                      <div
                        className="text-xl sm:text-2xl lg:text-4xl xl:text-5xl font-black mb-0.5 sm:mb-1"
                        style={{ color: isDark ? "#ffffff" : "#111827" }}
                      >
                        {stat.value}
                      </div>
                      <div
                        className="text-xs sm:text-sm lg:text-base xl:text-lg font-medium"
                        style={{ color: isDark ? "#9ca3af" : "#6b7280" }}
                      >
                        {stat.label}
                      </div>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="flex flex-col sm:flex-row gap-3 justify-center"
                >
                  {onComplete && (
                    <Button onClick={onComplete} size="lg" className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Home className="w-5 h-5 mr-2" />
                      Выйти
                    </Button>
                  )}
                  <Button onClick={() => window.location.reload()} size="lg" variant="outline">
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Посмотреть ещё раз
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
