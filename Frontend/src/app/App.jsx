import React, { useEffect, useState } from 'react'
import AppRoutes from './routes'
import SplashScreen from '@/shared/components/SplashScreen.jsx'
import { publicGetOnce } from '@food/api'

function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [isSplashDecisionReady, setIsSplashDecisionReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let mounted = true

    publicGetOnce('/food/landing/settings/public')
      .then((response) => {
        if (!mounted) return
        const settings = response?.data?.data || {}
        setShowSplash(settings.showSplashScreen !== false)
      })
      .catch(() => {
        if (!mounted) return
        setShowSplash(true)
      })
      .finally(() => {
        if (mounted) setIsSplashDecisionReady(true)
      })

    return () => {
      mounted = false
    }
  }, [])

  const handleSplashFinish = () => {
    setShowSplash(false)
  }

  // Normal Loading Spinner (if needed in future)
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white dark:bg-[#0a0a0a]">
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 border-4 border-[#7e3866]/10 rounded-full" />
          <div className="absolute inset-0 border-4 border-t-[#7e3866] rounded-full animate-spin" />
        </div>
        <h1 className="text-2xl font-black text-[#7e3866] italic uppercase tracking-tighter mt-6">ZIGGYBITES</h1>
      </div>
    )
  }

  if (!isSplashDecisionReady) {
    return null
  }

  return (
    <>
      {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
      <AppRoutes />
    </>
  )
}

export default App
