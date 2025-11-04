'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { API_CONFIG } from '@/config/api'

interface UserPreferences {
  userId: number
  colorScheme: 'standard' | 'graded'
  tableHeaderPadding: string
  tableDataPadding: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [colorScheme, setColorScheme] = useState<'standard' | 'graded'>('standard')
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string>('')

  useEffect(() => {
    // Load current user from localStorage
    const userId = localStorage.getItem('currentUserId')
    if (userId) {
      setCurrentUserId(parseInt(userId))
      loadUserPreferences(parseInt(userId))
    }
  }, [])

  const loadUserPreferences = async (userId: number) => {
    try {
      const response = await fetch(API_CONFIG.ENDPOINTS.USER_PREFERENCES(userId))
      if (response.ok) {
        const prefs = await response.json()
        if (prefs) {
          setColorScheme(prefs.color_scheme || 'standard')
        }
      }
    } catch (error) {
      console.error('Failed to load preferences:', error)
    }
  }

  const savePreferences = async () => {
    if (!currentUserId) {
      setSaveMessage('⚠️ Please select a user first')
      setTimeout(() => setSaveMessage(''), 3000)
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch(API_CONFIG.ENDPOINTS.USER_PREFERENCES(currentUserId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          color_scheme: colorScheme,
        })
      })

      if (response.ok) {
        setSaveMessage('✅ Settings saved successfully!')
        // Save to localStorage for immediate use
        localStorage.setItem('colorScheme', colorScheme)
      } else {
        setSaveMessage('❌ Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save preferences:', error)
      setSaveMessage('❌ Error saving settings')
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(''), 3000)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white border-2 border-gray-400 rounded-lg shadow-lg mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-lg border-b-2 border-gray-300">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">⚙️ Settings</h1>
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 bg-white text-blue-600 rounded-md font-semibold hover:bg-gray-100 transition-colors"
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        <div className="bg-white border-2 border-gray-300 rounded-lg shadow-lg p-6">
          <div className="space-y-6">
            {/* Color Scheme Section */}
            <div className="border-b pb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">📊 Display Settings</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    Color Scheme for Performance Intervals
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg border-2 border-transparent hover:border-blue-200 transition-all">
                      <input
                        type="radio"
                        name="colorScheme"
                        value="standard"
                        checked={colorScheme === 'standard'}
                        onChange={(e) => setColorScheme(e.target.value as 'standard' | 'graded')}
                        className="w-5 h-5 mt-1"
                      />
                      <div className="flex-1">
                        <div className="text-base font-semibold text-gray-800">Standard Colors</div>
                        <div className="text-sm text-gray-600 mt-1">
                          Simple color scheme: 0% = grey, positive = green, negative = red
                        </div>
                        <div className="flex gap-2 mt-2">
                          <span className="px-2 py-1 bg-gray-300 text-gray-700 rounded text-xs">0.00%</span>
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">+5.00%</span>
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">-5.00%</span>
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-3 rounded-lg border-2 border-transparent hover:border-blue-200 transition-all">
                      <input
                        type="radio"
                        name="colorScheme"
                        value="graded"
                        checked={colorScheme === 'graded'}
                        onChange={(e) => setColorScheme(e.target.value as 'standard' | 'graded')}
                        className="w-5 h-5 mt-1"
                      />
                      <div className="flex-1">
                        <div className="text-base font-semibold text-gray-800">Graded Colors (Every 3%)</div>
                        <div className="text-sm text-gray-600 mt-1">
                          Color intensity increases every 3%: Light → Medium → Dark → Bold
                        </div>
                        <div className="mt-2 space-y-1 text-xs">
                          <div className="flex gap-2">
                            <span className="text-gray-500 w-16">0-3%:</span>
                            <span className="text-green-400">+2.5%</span>
                            <span className="text-red-400">-2.5%</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-gray-500 w-16">3-6%:</span>
                            <span className="text-green-500">+4.5%</span>
                            <span className="text-red-500">-4.5%</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-gray-500 w-16">6-9%:</span>
                            <span className="text-green-600 font-semibold">+7.5%</span>
                            <span className="text-red-600 font-semibold">-7.5%</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-gray-500 w-16">9%+:</span>
                            <span className="text-green-700 font-bold">+10%</span>
                            <span className="text-red-700 font-bold">-10%</span>
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {currentUserId ? `User ID: ${currentUserId}` : 'No user selected'}
              </div>
              <div className="flex items-center gap-3">
                {saveMessage && (
                  <span className="text-sm font-medium">{saveMessage}</span>
                )}
                <button
                  onClick={savePreferences}
                  disabled={isSaving || !currentUserId}
                  className={`px-6 py-3 rounded-lg font-bold text-white transition-all ${
                    isSaving || !currentUserId
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {isSaving ? '💾 Saving...' : '💾 Save Settings'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <div className="text-2xl">ℹ️</div>
            <div className="flex-1 text-sm text-blue-900">
              <p className="font-semibold mb-1">About Settings</p>
              <p>Your preferences are saved to your user profile and will be applied automatically when you log in.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
