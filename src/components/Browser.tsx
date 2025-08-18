import React, { useState, useRef, useEffect } from 'react'
import { ArrowLeft, ArrowRight, RotateCw, Home, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Tab {
  id: string
  title: string
  url: string
  active: boolean
}

export default function Browser() {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: '1', title: 'New Tab', url: 'https://www.google.com', active: true }
  ])
  const [activeTabId, setActiveTabId] = useState('1')
  const [currentUrl, setCurrentUrl] = useState('https://www.google.com')
  const webviewRefs = useRef<{ [key: string]: HTMLIFrameElement | null }>({})

  const activeTab = tabs.find(tab => tab.id === activeTabId)

  const addNewTab = () => {
    const newTab: Tab = {
      id: Date.now().toString(),
      title: 'New Tab',
      url: 'https://www.google.com',
      active: false
    }
    setTabs(prev => prev.map(t => ({ ...t, active: false })).concat({ ...newTab, active: true }))
    setActiveTabId(newTab.id)
    setCurrentUrl(newTab.url)
  }

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) return
    
    const tabIndex = tabs.findIndex(t => t.id === tabId)
    const newTabs = tabs.filter(t => t.id !== tabId)
    
    if (tabId === activeTabId) {
      const newActiveTab = newTabs[Math.min(tabIndex, newTabs.length - 1)]
      setActiveTabId(newActiveTab.id)
      setCurrentUrl(newActiveTab.url)
      setTabs(newTabs.map(t => ({ ...t, active: t.id === newActiveTab.id })))
    } else {
      setTabs(newTabs)
    }
  }

  const switchTab = (tabId: string) => {
    setActiveTabId(tabId)
    const tab = tabs.find(t => t.id === tabId)
    if (tab) {
      setCurrentUrl(tab.url)
      setTabs(tabs.map(t => ({ ...t, active: t.id === tabId })))
    }
  }

  const navigate = (url: string) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    setCurrentUrl(url)
    setTabs(tabs.map(t => 
      t.id === activeTabId ? { ...t, url } : t
    ))
  }

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    navigate(currentUrl)
  }

  return (
    <div className="flex flex-col h-full bg-neutral-50">
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
              <span className="flex-1 text-sm truncate">{tab.title}</span>
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

      {/* Navigation Bar */}
      <div className="flex items-center gap-2 p-2 bg-white border-b">
        <button className="p-2 hover:bg-neutral-100 rounded">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button className="p-2 hover:bg-neutral-100 rounded">
          <ArrowRight className="w-4 h-4" />
        </button>
        <button className="p-2 hover:bg-neutral-100 rounded">
          <RotateCw className="w-4 h-4" />
        </button>
        <button className="p-2 hover:bg-neutral-100 rounded">
          <Home className="w-4 h-4" />
        </button>
        
        <form onSubmit={handleUrlSubmit} className="flex-1">
          <input
            type="text"
            value={currentUrl}
            onChange={(e) => setCurrentUrl(e.target.value)}
            className="w-full px-3 py-1.5 rounded-md border border-neutral-200 focus:outline-none focus:border-neutral-400"
            placeholder="Enter URL..."
          />
        </form>
      </div>

      {/* Browser Content */}
      <div className="flex-1 relative bg-white">
        {tabs.map(tab => (
          <iframe
            key={tab.id}
            ref={el => webviewRefs.current[tab.id] = el}
            src={tab.url}
            className={cn(
              "absolute inset-0 w-full h-full border-0",
              tab.id === activeTabId ? "block" : "hidden"
            )}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ))}
      </div>
    </div>
  )
}