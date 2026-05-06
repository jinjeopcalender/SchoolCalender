'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useEffect, useRef, useState } from 'react'

interface CalendarProps {
  events: any[]
  onDateClick: (date: string) => void
  onCellHover: (dateStr: string, rect: DOMRect | null) => void
  pendingPostId?: string | null
  holidayDates?: Set<string>
}

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

export default function Calendar({ events, onDateClick, onCellHover, pendingPostId, holidayDates }: CalendarProps) {
  const calendarRef = useRef<any>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())

  const goToMonth = (year: number, month: number) => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    api.gotoDate(new Date(year, month, 1))
    setCurrentYear(year); setCurrentMonth(month); setShowPicker(false)
  }

  const handlePrev = () => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    api.prev()
    const d = api.getDate()
    setCurrentYear(d.getFullYear()); setCurrentMonth(d.getMonth())
    onCellHover('', null)
  }

  const handleNext = () => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    api.next()
    const d = api.getDate()
    setCurrentYear(d.getFullYear()); setCurrentMonth(d.getMonth())
    onCellHover('', null)
  }

  // 공휴일 날짜 글자 빨간색 적용 (events 로드 후에도 반영)
  useEffect(() => {
    if (!holidayDates || holidayDates.size === 0) return
    const cells = document.querySelectorAll('.fc-daygrid-day')
    cells.forEach(cell => {
      const dateAttr = cell.getAttribute('data-date')
      if (dateAttr && holidayDates.has(dateAttr)) {
        const numEl = cell.querySelector('.fc-daygrid-day-number') as HTMLElement
        if (numEl) numEl.style.color = '#ef4444'
      }
    })
  }, [holidayDates])

  const today = new Date()

  return (
    <div className={`mt-4 w-full overflow-hidden rounded-2xl ${pendingPostId ? 'ring-2 ring-blue-400' : ''}`}>
      {pendingPostId && (
        <p className="text-center text-blue-500 text-sm py-2 bg-blue-50">📅 날짜를 선택해주세요</p>
      )}

      {/* 커스텀 헤더 */}
      <div className="flex items-center justify-between px-2 py-2 relative">
        <button onClick={handlePrev}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-lg font-bold">‹</button>

        <button onClick={() => setShowPicker(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <span className="text-base font-bold">{currentYear}년 {MONTHS[currentMonth]}</span>
          <span className={`text-gray-400 text-xs transition-transform duration-200 ${showPicker ? 'rotate-180' : ''}`}>▼</span>
        </button>

        <button onClick={handleNext}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-lg font-bold">›</button>

        {showPicker && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-4 w-72 animate-pop-in">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setCurrentYear(y => y - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 text-lg font-bold">‹</button>
              <span className="font-bold text-sm">{currentYear}년</span>
              <button onClick={() => setCurrentYear(y => y + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 text-lg font-bold">›</button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {MONTHS.map((m, i) => {
                const isToday    = i === today.getMonth() && currentYear === today.getFullYear()
                const isSelected = i === currentMonth
                return (
                  <button key={i} onClick={() => goToMonth(currentYear, i)}
                    className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                      isToday && isSelected ? 'bg-blue-500 text-white' :
                      isToday    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300' :
                      isSelected ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-bold' :
                      'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                    }`}>{m}</button>
                )
              })}
            </div>
            <button onClick={() => goToMonth(today.getFullYear(), today.getMonth())}
              className="w-full mt-3 py-2 text-xs text-blue-500 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
              오늘로 이동
            </button>
          </div>
        )}
      </div>

      <style>{`
        .fc { font-size: 0.75rem; }
        .fc .fc-toolbar { display: none !important; }
        .fc .fc-daygrid-day { min-height: 52px !important; cursor: pointer; }
        .fc .fc-daygrid-day-number { font-size: 0.75rem; padding: 4px 6px !important; }
        .fc .fc-daygrid-event {
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          font-size: 0.65rem !important; padding: 1px 3px !important;
          border-radius: 4px; cursor: pointer;
        }
        .fc .fc-col-header-cell-cushion { font-size: 0.7rem; padding: 4px 2px !important; }
        .fc .fc-day-sun .fc-daygrid-day-number,
        .fc .fc-col-header-cell.fc-day-sun .fc-col-header-cell-cushion { color: #ef4444 !important; }
        .fc .fc-day-sat .fc-daygrid-day-number,
        .fc .fc-col-header-cell.fc-day-sat .fc-col-header-cell-cushion { color: #3b82f6 !important; }
        @media (max-width: 480px) { .fc .fc-daygrid-day { min-height: 48px !important; } }
      `}</style>

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        dateClick={(info) => { onCellHover('', null); onDateClick(info.dateStr) }}
        eventClick={(info) => {
          onCellHover('', null)
          onDateClick(info.event.startStr.split('T')[0])
        }}
        dayCellDidMount={(info) => {
          const dateStr = `${info.date.getFullYear()}-${String(info.date.getMonth()+1).padStart(2,'0')}-${String(info.date.getDate()).padStart(2,'0')}`
          info.el.addEventListener('mouseenter', () => onCellHover(dateStr, info.el.getBoundingClientRect()))
          info.el.addEventListener('mouseleave', () => onCellHover('', null))
        }}
        headerToolbar={false}
        dayHeaderFormat={{ weekday: 'narrow' }}
        height="auto"
        contentHeight="auto"
        aspectRatio={1.2}
        locale="ko"
        eventDisplay="block"
      />
    </div>
  )
}