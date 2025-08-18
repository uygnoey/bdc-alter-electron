import React from 'react'
import ElectronBrowser from '@/components/ElectronBrowser'
import '@/styles/globals.css'

function App() {
  const isElectron = typeof window !== 'undefined' && window.electronAPI
  
  if (!isElectron) {
    return (
      <div className="h-screen w-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Electron 환경에서만 실행 가능합니다</h1>
          <p className="text-gray-600">이 애플리케이션은 Electron 데스크톱 앱으로만 사용할 수 있습니다.</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="h-screen w-screen bg-background">
      <ElectronBrowser />
    </div>
  )
}

export default App