import React, { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight, RotateCw, Home, Plus, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import SettingsPanel from './SettingsPanel'

interface Tab {
  id: string
  title: string
  url: string
  active: boolean
  loading?: boolean
}

declare global {
  interface Window {
    electronAPI: {
      platform: string
      browser: {
        createTab: (url: string) => Promise<{ id: string; url: string }>
        switchTab: (id: string) => Promise<boolean>
        closeTab: (id: string) => Promise<boolean>
        navigate: (data: { id?: string; url: string }) => Promise<boolean>
        goBack: (id?: string) => Promise<boolean>
        goForward: (id?: string) => Promise<boolean>
        reload: (id?: string) => Promise<boolean>
        onUrlChanged: (callback: (data: { id: string; url: string }) => void) => void
        onTitleChanged: (callback: (data: { id: string; title: string }) => void) => void
        onLoadingState: (callback: (data: { id: string; loading: boolean }) => void) => void
      }
    }
  }
}

export default function ElectronBrowser() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [currentUrl, setCurrentUrl] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!window.electronAPI) {
      console.error('Electron API not available')
      return
    }

    window.electronAPI.browser.onUrlChanged(({ id, url }) => {
      setTabs(prev => prev.map(tab => 
        tab.id === id ? { ...tab, url } : tab
      ))
      if (id === activeTabId) {
        setCurrentUrl(url)
        setUrlInput(url)
      }
    })

    window.electronAPI.browser.onTitleChanged(({ id, title }) => {
      setTabs(prev => prev.map(tab => 
        tab.id === id ? { ...tab, title } : tab
      ))
    })

    window.electronAPI.browser.onLoadingState(({ id, loading }) => {
      setTabs(prev => prev.map(tab => 
        tab.id === id ? { ...tab, loading } : tab
      ))
    })

    if (!initialized) {
      addNewTab()
      setInitialized(true)
    }
  }, [initialized])

  const addNewTab = async () => {
    if (!window.electronAPI) return
    
    const url = 'https://driving-center.bmw.co.kr'
    const { id } = await window.electronAPI.browser.createTab(url)
    
    const newTab: Tab = {
      id,
      title: 'BMW Driving Center',
      url,
      active: true
    }
    
    setTabs(prev => prev.map(t => ({ ...t, active: false })).concat(newTab))
    setActiveTabId(id)
    setCurrentUrl(url)
    setUrlInput(url)
  }

  const closeTab = async (tabId: string) => {
    if (!window.electronAPI || tabs.length === 1) return
    
    await window.electronAPI.browser.closeTab(tabId)
    
    const tabIndex = tabs.findIndex(t => t.id === tabId)
    const newTabs = tabs.filter(t => t.id !== tabId)
    
    if (tabId === activeTabId && newTabs.length > 0) {
      const newActiveTab = newTabs[Math.min(tabIndex, newTabs.length - 1)]
      setActiveTabId(newActiveTab.id)
      setCurrentUrl(newActiveTab.url)
      setUrlInput(newActiveTab.url)
      await window.electronAPI.browser.switchTab(newActiveTab.id)
      setTabs(newTabs.map(t => ({ ...t, active: t.id === newActiveTab.id })))
    } else {
      setTabs(newTabs)
    }
  }

  const switchTab = async (tabId: string) => {
    if (!window.electronAPI) return
    
    await window.electronAPI.browser.switchTab(tabId)
    setActiveTabId(tabId)
    
    const tab = tabs.find(t => t.id === tabId)
    if (tab) {
      setCurrentUrl(tab.url)
      setUrlInput(tab.url)
      setTabs(tabs.map(t => ({ ...t, active: t.id === tabId })))
    }
  }

  const navigate = async (url: string) => {
    if (!window.electronAPI || !activeTabId) return
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    
    await window.electronAPI.browser.navigate({ id: activeTabId, url })
    setCurrentUrl(url)
    setUrlInput(url)
  }

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    navigate(urlInput)
  }

  const goBack = async () => {
    if (!window.electronAPI || !activeTabId) return
    await window.electronAPI.browser.goBack(activeTabId)
  }

  const goForward = async () => {
    if (!window.electronAPI || !activeTabId) return
    await window.electronAPI.browser.goForward(activeTabId)
  }

  const reload = async () => {
    if (!window.electronAPI || !activeTabId) return
    await window.electronAPI.browser.reload(activeTabId)
  }

  const goHome = () => {
    navigate('https://www.google.com')
  }

  const activeTab = tabs.find(tab => tab.id === activeTabId)

  const handleSettingChange = (setting: string, value: any) => {
    console.log('Setting changed:', setting, value)
    // TODO: Apply settings to BrowserView
  }

  return (
    <div className="flex h-full">
      {/* Left Panel - Settings (50%) */}
      <div className="w-1/2 h-full">
        <SettingsPanel onSettingChange={handleSettingChange} />
      </div>

      {/* Right Panel - Browser (50%) */}
      <div className="w-1/2 h-full flex flex-col bg-neutral-50">
        {/* Tab Bar */}
        <div className="flex items-center bg-neutral-200 p-1 gap-1">
          <div className="flex flex-1 items-center gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <div
                key={tab.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer min-w-[150px] max-w-[200px] group",
                  tab.id === activeTabId ? "bg-white shadow-sm" : "bg-neutral-100 hover:bg-neutral-50"
                )}
                onClick={() => switchTab(tab.id)}
              >
                {tab.loading && <Loader2 className="w-3 h-3 animate-spin" />}
                <span className="flex-1 text-sm truncate">{tab.title || 'Loading...'}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:bg-neutral-200 rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addNewTab}
            className="p-1 hover:bg-neutral-300 rounded"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>


        {/* Browser Content Placeholder */}
        <div className="flex-1 bg-white flex items-center justify-center text-neutral-400">
          <div className="text-center">
            <p className="text-sm">Browser content is displayed in Electron BrowserView</p>
            <p className="text-xs mt-1">The web content appears in the right panel</p>
          </div>
        </div>
      </div>
    </div>
  )
}