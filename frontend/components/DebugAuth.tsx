'use client'

import { useEffect, useState } from "react"
import { getAuthToken } from "@/lib/auth"

export default function DebugAuth() {
  const [tokenInfo, setTokenInfo] = useState<{
    token: string | null;
    allStorageKeys: string[];
  }>({
    token: null,
    allStorageKeys: []
  })

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = getAuthToken()
      const keys = Object.keys(localStorage)
      setTokenInfo({
        token,
        allStorageKeys: keys
      })
    }
  }, [])

  const clearAllStorage = () => {
    localStorage.clear()
    window.location.reload()
  }

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
      <h3 className="font-bold text-yellow-800">Debug Auth Info</h3>
      <div className="mt-2 text-sm">
        <p><strong>Current Token:</strong> {tokenInfo.token || 'None'}</p>
        <p><strong>All localStorage keys:</strong> {tokenInfo.allStorageKeys.join(', ') || 'None'}</p>
        <button 
          onClick={clearAllStorage}
          className="mt-2 px-3 py-1 bg-red-500 text-white rounded text-xs"
        >
          Clear All Storage & Reload
        </button>
      </div>
    </div>
  )
}
