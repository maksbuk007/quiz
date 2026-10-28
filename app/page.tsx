"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/AuthContext"
import AuthModal from "@/components/auth/AuthModal"
import ThemeToggle from "@/components/ui/ThemeToggle"
import UserProfile from "@/components/ui/UserProfile"
import { Play, Plus, Users, Trophy, Zap, Star, Crown, Sparkles, User, Settings } from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"

export default function HomePage() {
  const router = useRouter()
  const { user, isAdmin, loading } = useAuth()
  const [gameCode, setGameCode] = useState("")
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const handleJoinGame = () => {
    if (!gameCode.trim()) return
    router.push(`/join/${gameCode.trim().toUpperCase()}`)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleJoinGame()
    }
  }

  const features = [
    {
      icon: <Users className="w-8 h-8 text-blue-500" />,
      title: "Мультиплеер",
      description: "Играйте с друзьями в реальном времени",
    },
    {
      icon: <Trophy className="w-8 h-8 text-yellow-500" />,
      title: "Рейтинги",
      description: "Соревнуйтесь за первое место",
    },
    {
      icon: <Zap className="w-8 h-8 text-purple-500" />,
      title: "Быстрые игры",
      description: "Мгновенное подключение к играм",
    },
    {
      icon: <Star className="w-8 h-8 text-orange-500" />,
      title: "Достижения",
      description: "Получайте награды за успехи",
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Заголовок */}
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-white/20 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Image src="/main_logo.png" alt="SkiniyaQuiz" width={40} height={40} className="rounded-lg" />
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                    SkiniyaQuiz
                  </h1>
                  <p className="text-sm text-muted-foreground">Интерактивные викторины</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              {!loading && (
                <>
                  {user ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setProfileOpen(true)}>
                        <User className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">Профиль</span>
                      </Button>
                      {isAdmin && (
                        <Button onClick={() => router.push("/admin")} variant="outline" size="sm">
                          <Settings className="w-4 h-4 mr-2" />
                          <span className="hidden sm:inline">Admin Tools</span>
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button onClick={() => setAuthModalOpen(true)}>Войти</Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Главный блок */}
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="flex items-center justify-center gap-3 mb-6">
              <Crown className="w-12 h-12 text-yellow-500" />
              <h2 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
                MaksbukQuiz
              </h2>
              <Sparkles className="w-12 h-12 text-purple-500" />
            </div>
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              Создавайте и проводите интерактивные викторины в реальном времени. Соревнуйтесь с друзьями и получайте
              незабываемые эмоции!
            </p>
          </motion.div>

          {/* Кнопки действий */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col md:flex-row items-center justify-center gap-6 mb-12"
          >
            <Card className="w-full max-w-md shadow-xl border-2 border-purple-200 dark:border-purple-800">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2">
                  <Play className="w-5 h-5 text-green-500" />
                  Присоединиться к игре
                </CardTitle>
                <CardDescription>Введите код игры для участия</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Введите код игры"
                  value={gameCode}
                  onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                  onKeyPress={handleKeyPress}
                  className="text-center text-lg font-mono"
                  maxLength={6}
                />
                <Button
                  onClick={handleJoinGame}
                  disabled={!gameCode.trim()}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  size="lg"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Играть
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Особенности */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-16"
        >
          <h3 className="text-3xl font-bold text-center mb-12">Почему MaksbukQuiz?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 * index }}
                whileHover={{ scale: 1.05 }}
                className="group"
              >
                <Card className="h-full text-center hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-purple-200 dark:hover:border-purple-800">
                  <CardContent className="p-6">
                    <div className="flex justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                      {feature.icon}
                    </div>
                    <h4 className="text-xl font-semibold mb-2">{feature.title}</h4>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Как это работает */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mb-16"
        >
          <h3 className="text-3xl font-bold text-center mb-12">Как это работает</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h4 className="text-xl font-semibold mb-2">Создайте игру</h4>
              <p className="text-muted-foreground">Войдите как администратор и создайте викторину с вопросами</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h4 className="text-xl font-semibold mb-2">Пригласите игроков</h4>
              <p className="text-muted-foreground">Поделитесь кодом игры или QR-кодом с участниками</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h4 className="text-xl font-semibold mb-2">Играйте и побеждайте</h4>
              <p className="text-muted-foreground">Отвечайте на вопросы и соревнуйтесь за первое место</p>
            </div>
          </div>
        </motion.div>

        {/* Статистика */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center"
        >
          <Card className="bg-gradient-to-r from-purple-500 to-blue-500 text-white border-0">
            <CardContent className="p-8">
              <h3 className="text-3xl font-bold mb-8">MaksbukQuiz в цифрах</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                  <div className="text-4xl font-bold mb-2">∞</div>
                  <div className="text-lg opacity-90">Игр проведено</div>
                </div>
                <div>
                  <div className="text-4xl font-bold mb-2">∞</div>
                  <div className="text-lg opacity-90">Активных игроков</div>
                </div>
                <div>
                  <div className="text-4xl font-bold mb-2">∞</div>
                  <div className="text-lg opacity-90">Вопросов задано</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Модальные окна */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      {user && <UserProfile isOpen={profileOpen} onClose={() => setProfileOpen(false)} />}
    </div>
  )
}
