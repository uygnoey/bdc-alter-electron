import React from 'react'
import Browser from '@/components/Browser'
import ElectronBrowser from '@/components/ElectronBrowser'
import '@/styles/globals.css'

function App() {
  const isElectron = typeof window !== 'undefined' && window.electronAPI
  
  return (
    <div className="h-screen w-screen bg-background">
      {isElectron ? <ElectronBrowser /> : <Browser />}
    </div>
  )
}

export default App