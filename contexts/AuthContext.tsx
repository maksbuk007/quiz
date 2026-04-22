"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { auth, db } from "@/lib/firebase/config"
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth"
import { doc, setDoc, getDoc } from "firebase/firestore"
import UserSessionService from "@/lib/services/userSessionService"

export type UserRole = "creator" | "admin" | "user"

interface User {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  emailVerified: boolean
  role: UserRole
  isAdmin?: boolean // Keep for backward compatibility
  createdAt?: number
}

interface AuthContextType {
  user: User | null
  loading: boolean
  isAdmin: boolean
  isCreator: boolean
  userRole: UserRole
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signUp: (email: string, password: string, displayName?: string) => Promise<void>
  logout: () => Promise<void>
  sendVerificationEmail: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const CREATOR_EMAIL = "bukatinmaksimilian6@gmail.com"
const ADMIN_EMAILS = ["skinia.ch@gmail.com", "bukatinmaksimilian6@gmail.com"]

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isCreator, setIsCreator] = useState(false)
  const [userRole, setUserRole] = useState<UserRole>("user")

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, "users", firebaseUser.uid))
        const userData = userDoc.data()

        let role: UserRole = userData?.role || "user"

        // Override with creator email check
        if (firebaseUser.email === CREATOR_EMAIL) {
          role = "creator"
        } else if (!userData?.role && ADMIN_EMAILS.includes(firebaseUser.email || "")) {
          // Backward compatibility: convert old admin emails to admin role
          role = "admin"
        }

        const user: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified,
          role,
          isAdmin: role === "creator" || role === "admin",
          createdAt: userData?.createdAt || Date.now(),
        }

        setUser(user)
        setIsAdmin(role === "creator" || role === "admin")
        setIsCreator(role === "creator")
        setUserRole(role)

        // Update user role in database if it changed
        if (userData?.role !== role) {
          await setDoc(doc(db, "users", firebaseUser.uid), { role }, { merge: true })
        }

        try {
          await UserSessionService.createSession(firebaseUser.uid, {
            userId: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || "Anonymous",
            active: true,
          })
        } catch (error) {
          console.error("Error managing session:", error)
        }
      } else {
        setUser(null)
        setIsAdmin(false)
        setIsCreator(false)
        setUserRole("user")
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error: any) {
      console.error("Sign in error:", error)
      throw new Error(error.message || "Failed to sign in")
    }
  }

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider()
      provider.addScope("https://www.googleapis.com/auth/userinfo.email")
      const result = await signInWithPopup(auth, provider)
      const user = result.user

      const userDoc = await getDoc(doc(db, "users", user.uid))
      if (!userDoc.exists()) {
        const role: UserRole =
          user.email === CREATOR_EMAIL ? "creator" : ADMIN_EMAILS.includes(user.email || "") ? "admin" : "user"

        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: Date.now(),
          role,
          isAdmin: role === "creator" || role === "admin",
          emailVerified: user.emailVerified,
        })
      }
    } catch (error: any) {
      console.error("Google sign in error:", error)
      throw new Error(error.message || "Failed to sign in with Google")
    }
  }

  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      const role: UserRole =
        user.email === CREATOR_EMAIL ? "creator" : ADMIN_EMAILS.includes(user.email || "") ? "admin" : "user"

      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        displayName: displayName || "Anonymous",
        createdAt: Date.now(),
        role,
        isAdmin: role === "creator" || role === "admin",
        emailVerified: false,
      })

      await sendEmailVerification(user)
    } catch (error: any) {
      console.error("Sign up error:", error)
      throw new Error(error.message || "Failed to sign up")
    }
  }

  const logout = async () => {
    try {
      if (user) {
        try {
          await UserSessionService.endSession(user.uid)
        } catch (sessionError) {
          console.warn("Warning: Could not end session, but proceeding with logout:", sessionError)
        }
      }
      await signOut(auth)
    } catch (error: any) {
      console.error("Logout error:", error)
      throw new Error(error.message || "Failed to logout")
    }
  }

  const sendVerificationEmail = async () => {
    if (auth.currentUser) {
      try {
        await sendEmailVerification(auth.currentUser)
      } catch (error: any) {
        console.error("Verification email error:", error)
        throw new Error(error.message || "Failed to send verification email")
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        isCreator,
        userRole,
        signIn,
        signInWithGoogle,
        signUp,
        logout,
        sendVerificationEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
