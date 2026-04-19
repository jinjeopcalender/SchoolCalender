'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'

interface CalendarProps {
  events: any[]
  onDateClick: (date: string) => void
  pendingPostId?: string | null // 날짜 선택 대기 중인 일정
}

export default function Calendar({ events, onDateClick, pendingPostId }: CalendarProps) {
  return (
    <div className={`mt-8 ${pendingPostId ? 'ring-2 ring-blue-400 rounded' : ''}`}>
      {pendingPostId && (
        <p className="text-center text-blue-500 text-sm py-2">
          📅 캘린더에서 날짜를 선택해주세요
        </p>
      )}
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        dateClick={(info) => onDateClick(info.dateStr)}
      />
    </div>
  )
}
