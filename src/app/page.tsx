'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    // Show splash screen for 2 seconds
    const splashTimer = setTimeout(() => {
      setShowSplash(false)
    }, 2000)

    return () => clearTimeout(splashTimer)
  }, [])

  useEffect(() => {
    if (status === 'loading' || showSplash) return // Still loading or showing splash

    if (session) {
      router.push('/dashboard')
    } else {
      router.push('/auth/login')
    }
  }, [session, status, router, showSplash])

  // Show splash screen during loading and initial 2-second display
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="text-center animate-fade-in">
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto bg-white rounded-2xl shadow-2xl flex items-center justify-center animate-bounce">
            <svg
              className="w-16 h-16 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
        </div>
        <h1 className="text-6xl font-bold text-white mb-4 tracking-tight">TokoKu</h1>
        <p className="text-xl text-white/90 font-medium">Modern Point of Sale System</p>
        <div className="mt-8 flex justify-center">
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            <div className="w-3 h-3 bg-white rounded-full animate-pulse delay-150"></div>
            <div className="w-3 h-3 bg-white rounded-full animate-pulse delay-300"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
