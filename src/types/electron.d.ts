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
        toggleDevTools: (id?: string) => Promise<boolean>
        onUrlChanged: (callback: (data: { id: string; url: string }) => void) => void
        onTitleChanged: (callback: (data: { id: string; title: string }) => void) => void
        onLoadingState: (callback: (data: { id: string; loading: boolean }) => void) => void
      }
      bmw: {
        analyzeSite: () => Promise<any>
        autoLogin: (credentials: { username: string; password: string }) => Promise<any>
        checkReservation: (programs: string[]) => Promise<any>
        fetchPrograms: () => Promise<any>
        onProgramsUpdated: (callback: (data: any) => void) => void
        // 새로운 API
        initialize: (credentials: { username: string; password: string }) => Promise<any>
        monitor: (params: { selectedPrograms: any[] }) => Promise<any>
        navigate: (params: { url: string }) => Promise<any>
        fetchProgramsOnly: () => Promise<any>
        stopMonitoring: () => Promise<any>
      }
    }
  }
}

export {}