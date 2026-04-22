"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import UserProfile from "@/components/ui/UserProfile"
import AuthModal from "@/components/auth/AuthModal"
import { User, LogIn } from "lucide-react"

export function ProfileButton() {
  const { user } = useAuth()
  const [showProfile, setShowProfile] = useState(false)
  const [showAuth, setShowAuth] = useState(false)

  const handleProfileClick = () => {
    if (user) {
      setShowProfile(true)
    } else {
      setShowAuth(true)
    }
  }

  return (
    <>
      <Button onClick={handleProfileClick} variant="outline" size="sm" className="profile-button gap-2">
        {user ? (
          <>
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Профиль</span>
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Авторизация</span>
          </>
        )}
      </Button>

      <UserProfile isOpen={showProfile} onClose={() => setShowProfile(false)} />
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </>
  )
}

export default ProfileButton
