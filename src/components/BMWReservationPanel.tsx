import React, { useState, useEffect } from 'react'
import { Car, User, Calendar, PlayCircle, StopCircle, CheckCircle, AlertCircle, RefreshCw, Clock } from 'lucide-react'

// Type definitions are in src/types/electron.d.ts

export default function BMWReservationPanel() {
  const [credentials, setCredentials] = useState({ username: '', password: '' })
  const [isRunning, setIsRunning] = useState(false)
  const [checkInterval, setCheckInterval] = useState(30)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [status, setStatus] = useState<string>('')
  const [availableSlots, setAvailableSlots] = useState<any[]>([])
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null)
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([])
  const [notificationEmail, setNotificationEmail] = useState<string>('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [programs, setPrograms] = useState<any[]>([])
  const [programsLastUpdated, setProgramsLastUpdated] = useState<string | null>(null)
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false)


  const login = async () => {
    if (!credentials.username || !credentials.password) {
      setStatus('⚠️ 아이디와 비밀번호를 입력하세요')
      return false
    }

    setStatus('로그인 시도 중...')
    try {
      const result = await window.electronAPI.bmw.autoLogin(credentials)
      
      // hCaptcha 감지된 경우
      if (result.captcha) {
        setStatus('🤖 hCaptcha 인증이 필요합니다! 브라우저에서 직접 체크해주세요.')
        
        // 사용자에게 알림
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('BMW 로그인', {
            body: 'hCaptcha 인증이 필요합니다. 브라우저에서 체크해주세요.',
            icon: '/bmw-logo.png'
          })
        }
        
        // hCaptcha 해결 대기 (수동)
        setStatus('⏳ hCaptcha 해결 대기 중... 완료 후 다시 로그인 버튼을 눌러주세요.')
        return false
      }
      
      if (result.success || result.step === 'login_complete' || result.step === 'login_complete_enter') {
        setStatus('✅ 로그인 성공!')
        setIsLoggedIn(true)
        return true
      } else {
        setStatus(`❌ 로그인 실패: ${result.error}`)
        setIsLoggedIn(false)
        return false
      }
    } catch (error) {
      setStatus(`❌ 오류: ${error}`)
      setIsLoggedIn(false)
      return false
    }
  }

  const checkReservation = async () => {
    setStatus('예약 가능 여부 확인 중...')
    setLastCheck(new Date())
    
    try {
      const result = await window.electronAPI.bmw.checkReservation(selectedPrograms)
      
      if (result.error) {
        setStatus(`❌ 확인 실패: ${result.error}`)
        return
      }

      if (result.available) {
        setAvailableSlots(result.slots)
        setStatus(`🎉 예약 가능! ${result.slots.length}개 슬롯 발견`)
        
        // 알림 표시
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('BMW 드라이빙 센터', {
            body: `예약 가능한 슬롯이 ${result.slots.length}개 있습니다!`,
            icon: '/bmw-logo.png'
          })
        }
      } else {
        setStatus('😔 현재 예약 가능한 슬롯이 없습니다')
        setAvailableSlots([])
      }
    } catch (error) {
      setStatus(`❌ 오류: ${error}`)
    }
  }

  const startMonitoring = async () => {
    if (selectedPrograms.length === 0) {
      setStatus('⚠️ 최소 1개 이상의 프로그램을 선택해주세요')
      return
    }
    
    if (!credentials.username || !credentials.password) {
      setStatus('⚠️ 로그인 정보를 입력해주세요')
      return
    }
    
    // 먼저 로그인
    setStatus('로그인 중...')
    const loginResult = await login()
    
    if (!loginResult || !isLoggedIn) {
      setStatus('❌ 로그인 실패')
      return
    }
    
    // 즉시 한 번 확인
    const programNames = selectedPrograms.join(', ')
    setStatus(`${programNames} 예약 확인 중...`)
    await checkReservation()
    
    // 주기적 확인 시작
    const id = setInterval(() => {
      checkReservation()
    }, checkInterval * 1000)
    
    setIntervalId(id)
    setIsRunning(true)
    setStatus(`🔄 ${programNames} 모니터링 중... (${checkInterval}초마다 확인)`)
  }

  const stopMonitoring = () => {
    if (intervalId) {
      clearInterval(intervalId)
      setIntervalId(null)
    }
    setIsRunning(false)
    setStatus('⏹️ 모니터링 중지됨')
  }

  // 프로그램 리스트 가져오기
  const fetchPrograms = async () => {
    setIsLoadingPrograms(true)
    setStatus('🔍 BMW 프로그램 리스트 가져오는 중...')
    
    // 기존 리스트 삭제
    setPrograms([])
    setProgramsLastUpdated(null)
    localStorage.removeItem('bmw-programs')
    
    try {
      const result = await window.electronAPI.bmw.fetchPrograms()
      
      if (result.success && result.programs.length > 0) {
        setPrograms(result.programs)
        setProgramsLastUpdated(result.timestamp)
        
        // 로컬 스토리지에 저장
        localStorage.setItem('bmw-programs', JSON.stringify({
          programs: result.programs,
          lastUpdated: result.timestamp
        }))
        
        setStatus(`✅ ${result.programs.length}개 프로그램 로드 완료`)
      } else {
        setStatus('⚠️ 프로그램을 찾을 수 없습니다')
      }
    } catch (error) {
      setStatus(`❌ 오류: ${error}`)
    } finally {
      setIsLoadingPrograms(false)
    }
  }

  useEffect(() => {
    // 알림 권한 요청
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // 로컬 스토리지에서 프로그램 리스트 로드
    const savedPrograms = localStorage.getItem('bmw-programs')
    if (savedPrograms) {
      const data = JSON.parse(savedPrograms)
      setPrograms(data.programs || [])
      setProgramsLastUpdated(data.lastUpdated)
      
      // 1주일 이상 지났으면 자동 업데이트
      const lastUpdate = new Date(data.lastUpdated)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      if (lastUpdate < weekAgo) {
        fetchPrograms()
      }
    } else {
      // 프로그램 리스트가 없으면 바로 가져오기
      fetchPrograms()
    }

    // 프로그램 업데이트 리스너
    window.electronAPI.bmw.onProgramsUpdated((data) => {
      setPrograms(data.programs)
      setProgramsLastUpdated(data.lastUpdated)
      localStorage.setItem('bmw-programs', JSON.stringify(data))
    })

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [intervalId])

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Car className="w-6 h-6 text-blue-600" />
        <span>BMW 드라이빙 센터 자동 예약</span>
      </div>

      {/* 프로그램 선택 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="w-4 h-4" />
            <span>희망 프로그램 선택</span>
          </div>
          <button
            onClick={fetchPrograms}
            disabled={isLoadingPrograms}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="프로그램 리스트 새로고침"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingPrograms ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {programsLastUpdated && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            <span>마지막 업데이트: {new Date(programsLastUpdated).toLocaleString('ko-KR')}</span>
          </div>
        )}
        
        <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-3">
          {programs.length > 0 ? (
            (() => {
              // 카테고리별로 그룹핑
              const grouped: { [key: string]: typeof programs } = {}
              programs.forEach(program => {
                const cat = program.category || '기타'
                if (!grouped[cat]) grouped[cat] = []
                grouped[cat].push(program)
              })
              
              const categoryOrder = ['Experience', 'Training', 'Owner', '기타']
              
              return categoryOrder.map(category => {
                const categoryPrograms = grouped[category]
                if (!categoryPrograms || categoryPrograms.length === 0) return null
                
                return (
                  <div key={category}>
                    <div className="text-xs font-semibold text-gray-600 mb-1">{category}</div>
                    <div className="space-y-1 ml-2">
                      {categoryPrograms.map((program, idx) => (
                        <label key={`${category}-${idx}`} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedPrograms.includes(program.name)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPrograms([...selectedPrograms, program.name])
                              } else {
                                setSelectedPrograms(selectedPrograms.filter(p => p !== program.name))
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm">{program.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              }).filter(Boolean)
            })()
          ) : (
            <div className="text-sm text-gray-500">
              프로그램 목록을 불러오는 중...
            </div>
          )}
        </div>
        
        {selectedPrograms.length > 0 && (
          <div className="text-xs text-blue-600 mt-1">
            {selectedPrograms.length}개 프로그램 선택됨
          </div>
        )}
        
        {programs.length === 0 && (
          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
            ⚠️ 프로그램 리스트가 없습니다. 위 새로고침 버튼을 클릭해주세요.
          </div>
        )}
      </div>

      {/* 로그인 정보 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <User className="w-4 h-4" />
          <span>로그인 정보</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="BMW ID (이메일)"
            value={credentials.username}
            onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
            className="flex-1 px-3 py-2 text-sm border rounded focus:outline-none focus:border-blue-400"
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={credentials.password}
            onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
            className="flex-1 px-3 py-2 text-sm border rounded focus:outline-none focus:border-blue-400"
          />
        </div>
        {!isLoggedIn ? (
          <button
            onClick={login}
            className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            로그인
          </button>
        ) : (
          <div className="text-sm text-green-600 text-center">
            ✅ 로그인 완료
          </div>
        )}
      </div>

      {/* 알림 설정 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <AlertCircle className="w-4 h-4" />
          <span>알림 설정</span>
        </div>
        <input
          type="email"
          placeholder="알림 받을 이메일"
          value={notificationEmail}
          onChange={(e) => setNotificationEmail(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:border-blue-400"
        />
        <div className="space-y-2">
          <label className="text-sm">확인 주기 (초)</label>
          <select
            value={checkInterval}
            onChange={(e) => setCheckInterval(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm border rounded focus:outline-none focus:border-blue-400"
          >
            <option value="30">30초마다</option>
            <option value="60">1분마다</option>
            <option value="120">2분마다</option>
            <option value="300">5분마다</option>
          </select>
        </div>
      </div>

      {/* 제어 버튼 */}
      <div className="space-y-3">
        {!isRunning ? (
          <button
            onClick={startMonitoring}
            className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center justify-center gap-2"
          >
            <PlayCircle className="w-5 h-5" />
            모니터링 시작
          </button>
        ) : (
          <button
            onClick={stopMonitoring}
            className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex items-center justify-center gap-2"
          >
            <StopCircle className="w-5 h-5" />
            모니터링 중지
          </button>
        )}
        
        <button
          onClick={checkReservation}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          즉시 확인
        </button>
      </div>

      {/* 상태 표시 */}
      <div className="space-y-2">
        <div className="p-3 bg-gray-100 rounded">
          <div className="text-sm font-medium mb-1">현재 상태</div>
          <div className="text-sm whitespace-pre-wrap">{status || '대기 중...'}</div>
        </div>
        
        {lastCheck && (
          <div className="text-xs text-gray-500">
            마지막 확인: {lastCheck.toLocaleTimeString()}
          </div>
        )}

        {availableSlots.length > 0 && (
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <div className="flex items-center gap-2 text-sm font-medium text-green-700 mb-2">
              <CheckCircle className="w-4 h-4" />
              예약 가능한 슬롯
            </div>
            <div className="space-y-1">
              {availableSlots.map((slot, idx) => (
                <div key={idx} className="text-sm">
                  📅 {slot.date}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}