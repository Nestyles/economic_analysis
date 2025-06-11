'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getAuthToken } from "@/lib/auth"

export default function Home() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  useEffect(() => {
    // Check if user is authenticated
    const token = getAuthToken()
    
    if (token) {
      // User is logged in, redirect to dashboard
      router.push('/dashboard')
    } else {
      // User is not logged in, redirect to login
      router.push('/login')
    }
    
    setIsChecking(false)
  }, [router])
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-2 text-gray-600">
          {isChecking ? "Checking authentication..." : "Redirecting..."}
        </p>
      </div>
    </div>
  );
}
