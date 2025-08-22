import React, { useState, useEffect, useRef } from 'react'
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
  const isRunningRef = useRef(false) // while 루프에서 사용할 ref
  const currentParsingIdRef = useRef(0) // 현재 실행 중인 파싱 ID
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
    
    // 중지 신호 확인
    if (!isRunningRef.current) {
      console.log('checkReservation 시작 전 중지됨')
      return
    }
    
    // 파싱 ID 생성 (이 파싱 작업을 식별)
    const parsingId = ++currentParsingIdRef.current
    console.log(`파싱 시작 ID: ${parsingId}`)
    
    setStatus('예약 가능 여부 확인 중...')
    setLastCheck(new Date())
    
    try {
      // 선택된 프로그램명 배열 전달 (문자열 배열)
      const result = await window.electronAPI.bmw.monitor({ 
        selectedPrograms: selectedPrograms  // 선택된 프로그램명들 
      })
      
      // 이 파싱이 여전히 유효한지 확인 (중지되었거나 새 파싱이 시작되었을 수 있음)
      if (!isRunningRef.current || parsingId !== currentParsingIdRef.current) {
        console.log(`파싱 ID ${parsingId} 무시됨 (현재 ID: ${currentParsingIdRef.current}, 실행 중: ${isRunningRef.current})`)
        return
      }
      
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
      // 오류 발생 시에도 파싱 ID 확인
      if (!isRunningRef.current || parsingId !== currentParsingIdRef.current) {
        console.log(`파싱 ID ${parsingId} 오류 무시됨`)
        return
      }
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
    
    // 먼저 isRunning을 true로 설정 (버튼 즉시 변경)
    setIsRunning(true)
    isRunningRef.current = true
    
    try {
      const result = await window.electronAPI.bmw.initialize(credentials)
      
      if (!result.success) {
        setStatus(`❌ 로그인 실패: ${result.message || '알 수 없는 오류'}`)
        setIsRunning(false)
        isRunningRef.current = false
        return
      }
      
      setStatus('✅ 로그인 성공!')
      
      // 모니터링 시작 시에는 프로그램 목록 업데이트 불필요
      // 이미 선택된 프로그램으로 예약 확인만 진행
      
      const programNames = selectedPrograms.join(', ')
      
      // 연속 파싱 함수 (단순화)
      const continuousMonitoring = async () => {
        while (isRunningRef.current) {
          const startTime = Date.now()
          
          try {
            // checkReservation 실행
            await checkReservation()
            
            // 중지 확인
            if (!isRunningRef.current) {
              console.log('파싱 완료 후 중지 신호 감지')
              break
            }
            
            const elapsedTime = Date.now() - startTime
            const elapsedSeconds = Math.floor(elapsedTime / 1000)
            
            // 모니터링 중 상태만 업데이트 (checkReservation에서 이미 상태 설정함)
            if (isRunningRef.current) {
              console.log(`파싱 완료: ${elapsedSeconds}초 소요, 1초 후 다시 시작`)
            }
            
            // 1초 대기 (중단 가능)
            for (let i = 0; i < 10 && isRunningRef.current; i++) {
              await new Promise(resolve => setTimeout(resolve, 100))
            }
            
          } catch (error) {
            console.error('모니터링 오류:', error)
            
            if (!isRunningRef.current) break
            
            setStatus(`⚠️ 오류 발생, 5초 후 재시도...`)
            
            // 5초 대기 (중단 가능)
            for (let i = 0; i < 50 && isRunningRef.current; i++) {
              await new Promise(resolve => setTimeout(resolve, 100))
            }
          }
        }
        
        setStatus('⏹️ 모니터링 중지됨')
        console.log('연속 모니터링 종료')
      }
      
      // 연속 모니터링 시작
      continuousMonitoring()
      setStatus(`🔄 ${programNames} 연속 모니터링 중...`)
      
    } catch (error) {
      setStatus(`❌ 오류: ${error}`)
      setIsRunning(false)
      isRunningRef.current = false
    }
  }

  const stopMonitoring = async () => {
    console.log('모니터링 중지 요청')
    
    // 먼저 프론트엔드 상태 업데이트
    setIsRunning(false)
    isRunningRef.current = false
    currentParsingIdRef.current = 0 // 파싱 ID 리셋
    setStatus('⏹️ 모니터링 중지 중...')
    
    // 백엔드에 강제 중단 요청
    try {
      await window.electronAPI.bmw.stopMonitoring()
      console.log('백엔드 모니터링 중단 완료')
      setStatus('⏹️ 모니터링 중지됨')
    } catch (error) {
      console.error('모니터링 중단 오류:', error)
      setStatus('⏹️ 모니터링 중지됨')
    }
    
    if (intervalId) {
      clearInterval(intervalId)
      setIntervalId(null)
    }
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
        {/* 연속 모니터링 방식으로 변경되어 확인 주기 설정 제거 */}
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          ℹ️ 연속 모니터링: 파싱이 완료되면 바로 다시 확인을 시작합니다
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
              예약 가능한 날짜 및 프로그램
            </div>
            <div className="space-y-2">
              {availableSlots.map((slot, idx) => {
                // 선택된 프로그램이 있을 경우 필터링
                const filteredPrograms = selectedPrograms.length > 0 
                  ? slot.programs?.filter(p => {
                      return selectedPrograms.some(selected => {
                        const selectedLower = selected.toLowerCase().trim();
                        const programLower = p.name.toLowerCase().trim();
                        
                        // 정확히 일치
                        if (programLower === selectedLower) return true;
                        
                        // 언어 버전 처리
                        const programBase = programLower.replace(/\s*\([^)]*\)$/, '').trim();
                        const selectedBase = selectedLower.replace(/\s*\([^)]*\)$/, '').trim();
                        if (programBase === selectedBase) return true;
                        
                        return false;
                      });
                    }) || []
                  : slot.programs || [];
                
                // 필터링된 프로그램이 없으면 이 날짜는 표시하지 않음
                if (filteredPrograms.length === 0) return null;
                
                // 날짜를 년월일 형식으로 변환
                // monthYear는 "2025년 08월" 형식, date는 "23" 형식
                const formattedDate = slot.monthYear 
                  ? `${slot.monthYear} ${slot.date}일`
                  : `${slot.date}일`;
                
                return (
                  <div key={idx} className="text-sm border-b border-green-100 pb-2 last:border-b-0">
                    <div className="font-medium text-green-700">
                      📅 {formattedDate}
                    </div>
                    <div className="ml-4 mt-1 space-y-2">
                      {filteredPrograms.map((program, pidx) => (
                        <div key={pidx} className="text-xs">
                          <div className="text-gray-700 font-medium">
                            • {program.name}
                            {program.duration && ` (${program.duration})`}
                            {program.price && ` - ${program.price}`}
                          </div>
                          
                          {/* 차량 정보 표시 */}
                          {program.vehicles && program.vehicles.length > 0 && (
                            <div className="ml-4 mt-1 text-gray-600">
                              <span className="font-medium">차량:</span>
                              {program.vehicles.map((v, vidx) => (
                                <span key={vidx} className="ml-1">
                                  {v.series} {v.model} ({v.price}){vidx < program.vehicles.length - 1 ? ', ' : ''}
                                </span>
                              ))}
                            </div>
                          )}
                          
                          {/* 시간대 정보 표시 */}
                          {program.timeSlots && program.timeSlots.length > 0 && (
                            <div className="ml-4 mt-1">
                              <span className="font-medium text-gray-600">예약 가능 시간:</span>
                              <div className="ml-2 mt-1 grid grid-cols-2 gap-1">
                                {program.timeSlots.filter(t => t.available).map((time, tidx) => (
                                  <div key={tidx} className="text-green-600 text-xs">
                                    {time.time} ({time.remainingSeats}석)
                                  </div>
                                ))}
                                {program.timeSlots.filter(t => t.available).length === 0 && (
                                  <div className="text-red-500 text-xs">예약 가능한 시간대 없음</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }).filter(Boolean)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}