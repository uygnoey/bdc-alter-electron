import React, { useState, useEffect } from 'react'
import { Car, User, Calendar, PlayCircle, StopCircle, CheckCircle, AlertCircle, RefreshCw, Clock } from 'lucide-react'

// Type definitions are in src/types/electron.d.ts

// 간단한 암호화/복호화 (실제로는 더 강력한 암호화 필요)
const encryptPassword = (password: string): string => {
  return btoa(password) // Base64 인코딩 (실제로는 더 강력한 암호화 사용 권장)
}

const decryptPassword = (encrypted: string): string => {
  try {
    return atob(encrypted) // Base64 디코딩
  } catch {
    return ''
  }
}

interface BMWReservationPanelProps {
  onSettingChange?: (setting: string, value: any) => void
  currentUrl?: string
}

export default function BMWReservationPanel({ 
  onSettingChange, 
  currentUrl
}: BMWReservationPanelProps) {
  const [credentials, setCredentials] = useState({ username: '', password: '' })
  const [isRunning, setIsRunning] = useState(false)
  const [checkInterval, setCheckInterval] = useState(30)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [status, setStatus] = useState<string>('')
  const [availableSlots, setAvailableSlots] = useState<any[]>([])
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null)
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([])
  const [notificationEmail, setNotificationEmail] = useState<string>('')
  // 로그인 상태 제거 - 모니터링 시작할 때만 로그인
  
  const [programs, setPrograms] = useState<string[]>([])
  const [programsLastUpdated, setProgramsLastUpdated] = useState<string | null>(null)
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false)


  // 계정 정보 저장
  const saveCredentials = () => {
    if (!credentials.username || !credentials.password) {
      setStatus('⚠️ 아이디와 비밀번호를 입력하세요')
      return false
    }

    // 계정 정보 저장 (비밀번호는 암호화)
    const encryptedCredentials = {
      username: credentials.username,
      password: encryptPassword(credentials.password)
    }
    localStorage.setItem('bmw-credentials', JSON.stringify(encryptedCredentials))
    setStatus('✅ 계정 정보 저장됨')
    return true
  }

  const checkReservation = async () => {
    if (selectedPrograms.length === 0) {
      setStatus('⚠️ 프로그램을 선택해주세요')
      return
    }
    
    setStatus('예약 가능 여부 확인 중...')
    setLastCheck(new Date())
    
    try {
      // 선택된 프로그램 정보 준비
      const selectedProgramData = programs.filter(p => selectedPrograms.includes(p.name))
      
      const result = await window.electronAPI.bmw.monitor({ 
        selectedPrograms: selectedProgramData 
      })
      
      if (!result.success) {
        setStatus(`❌ 확인 실패: ${result.message}`)
        return
      }

      if (result.hasAvailability) {
        setAvailableSlots(result.slots || [])
        setStatus(`🎉 예약 가능! ${result.count}개 슬롯 발견`)
        
        // 알림 표시
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('BMW 드라이빙 센터', {
            body: `예약 가능한 슬롯이 ${result.count}개 있습니다!`,
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
    
    // 계정 정보 저장
    saveCredentials()
    
    // 로그인 및 초기화
    setStatus('로그인 중...')
    console.log('🔐 모니터링 시작 - 로그인 시도:', { username: credentials.username })
    
    try {
      const result = await window.electronAPI.bmw.initialize(credentials)
      
      if (!result.success) {
        setStatus(`❌ 로그인 실패: ${result.message || '알 수 없는 오류'}`)
        return
      }
      
      setStatus('✅ 로그인 성공!')
      
      // 모니터링 시작 시에는 프로그램 목록 업데이트 불필요
      // 이미 선택된 프로그램으로 예약 확인만 진행
      
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
      
    } catch (error) {
      setStatus(`❌ 오류: ${error}`)
    }
  }

  const stopMonitoring = () => {
    if (intervalId) {
      clearInterval(intervalId)
      setIntervalId(null)
    }
    setIsRunning(false)
    setStatus('⏹️ 모니터링 중지됨')
  }

  // 프로그램 리스트 가져오기 (로그인 불필요)
  const fetchPrograms = async () => {
    setIsLoadingPrograms(true)
    setStatus('🔍 BMW 프로그램 리스트 가져오는 중...')
    
    try {
      // 로그인 없이 바로 프로그램 페이지에서 파싱
      const result = await window.electronAPI.bmw.fetchProgramsOnly()
      
      console.log('프로그램 가져오기 결과:', result)
      console.log('프로그램 개수:', result.programs?.length)
      console.log('프로그램 목록:', result.programs)
      
      if (result.success && result.programs && result.programs.length > 0) {
        setPrograms(result.programs)
        setProgramsLastUpdated(new Date().toISOString())
        
        // 로컬 스토리지에 저장
        localStorage.setItem('bmw-programs', JSON.stringify({
          programs: result.programs,
          lastUpdated: new Date().toISOString()
        }))
        
        setStatus(`✅ ${result.programs.length}개 프로그램 로드 완료`)
        console.log('프로그램이 state에 설정됨:', result.programs.length, '개')
      } else {
        setStatus('⚠️ 프로그램을 찾을 수 없습니다')
        console.log('프로그램을 찾지 못함:', result)
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

    // 저장된 계정 정보 로드 (비밀번호 복호화)
    const savedCredentials = localStorage.getItem('bmw-credentials')
    if (savedCredentials) {
      const encrypted = JSON.parse(savedCredentials)
      setCredentials({
        username: encrypted.username,
        password: decryptPassword(encrypted.password)
      })
    }

    // 로컬 스토리지에서 프로그램 리스트 로드
    const savedPrograms = localStorage.getItem('bmw-programs')
    if (savedPrograms) {
      const data = JSON.parse(savedPrograms)
      // 이전 형식(객체 배열)과 새 형식(문자열 배열) 모두 처리
      const programList = data.programs || []
      if (programList.length > 0 && typeof programList[0] === 'object') {
        // 이전 형식이면 name 필드만 추출
        setPrograms(programList.map((p: any) => p.name || p))
      } else {
        setPrograms(programList)
      }
      setProgramsLastUpdated(data.lastUpdated)
      
      // 1주일 이상 지났으면 자동 업데이트
      const lastUpdate = new Date(data.lastUpdated)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      if (lastUpdate < weekAgo && credentials.username && credentials.password) {
        fetchPrograms()
      }
    }

    // 프로그램 업데이트 리스너 (필요시 추가)
    // window.electronAPI.bmw.onProgramsUpdated?.((data) => {
    //   setPrograms(data.programs)
    //   setProgramsLastUpdated(data.lastUpdated)
    //   localStorage.setItem('bmw-programs', JSON.stringify(data))
    // })

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
        
        <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-1">
          {console.log('렌더링 시점 programs:', programs, 'length:', programs.length)}
          {programs.length > 0 ? (
            programs.map((program, idx) => (
              <label key={idx} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedPrograms.includes(program)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPrograms([...selectedPrograms, program])
                    } else {
                      setSelectedPrograms(selectedPrograms.filter(p => p !== program))
                    }
                  }}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm">{program}</span>
              </label>
            ))
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
        <button
          onClick={saveCredentials}
          className="w-full px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
        >
          계정 정보 저장
        </button>
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