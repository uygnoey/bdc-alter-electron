import React from 'react'
import { Car } from 'lucide-react'
import BMWReservationPanel from './BMWReservationPanel'

interface SettingsPanelProps {
  onSettingChange: (setting: string, value: any) => void
}

export default function SettingsPanel({ onSettingChange }: SettingsPanelProps) {
  // BMW 탭만 표시
  return (
    <div className="h-full bg-neutral-50 border-r border-neutral-200 flex flex-col">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="px-4 py-3 flex items-center gap-2 border-b-2 border-blue-500">
          <Car className="w-5 h-5 text-blue-600" />
          <span className="text-base font-semibold text-blue-600">BMW 드라이빙 센터 예약 자동화</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <BMWReservationPanel />
      </div>
    </div>
  )
}