'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'

interface CalendarProps {
  events: any[]
  onDateClick: (date: string) => void
  pendingPostId?: string | null
}

export default function Calendar({ events, onDateClick, pendingPostId }: CalendarProps) {
  return (
    <div className={`mt-4 w-full overflow-hidden rounded-2xl ${pendingPostId ? 'ring-2 ring-blue-400' : ''}`}>
      {pendingPostId && (
        <p className="text-center text-blue-500 text-sm py-2 bg-blue-50">
          📅 날짜를 선택해주세요
        </p>
      )}
      <style>{`
        .fc { font-size: 0.75rem; }
        .fc .fc-toolbar {
          flex-wrap: wrap;
          gap: 6px;
          padding: 8px 4px;
        }
        .fc .fc-toolbar-title {
          font-size: 1rem !important;
          font-weight: 700;
          white-space: nowrap;
        }
        .fc .fc-button {
          padding: 4px 8px !important;
          font-size: 0.7rem !important;
        }
        .fc .fc-daygrid-day { min-height: 40px !important; }
        .fc .fc-daygrid-day-number {
          font-size: 0.75rem;
          padding: 2px 4px !important;
        }
        .fc .fc-daygrid-event {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 0.65rem !important;
          padding: 1px 3px !important;
          border-radius: 4px;
          cursor: pointer;
        }
        .fc .fc-col-header-cell-cushion {
          font-size: 0.7rem;
          padding: 4px 2px !important;
        }
        /* 일요일 빨간색 */
        .fc .fc-day-sun .fc-daygrid-day-number,
        .fc .fc-col-header-cell.fc-day-sun .fc-col-header-cell-cushion {
          color: #ef4444 !important;
        }
        /* 토요일 파란색 */
        .fc .fc-day-sat .fc-daygrid-day-number,
        .fc .fc-col-header-cell.fc-day-sat .fc-col-header-cell-cushion {
          color: #3b82f6 !important;
        }
        @media (max-width: 480px) {
          .fc .fc-toolbar { justify-content: space-between; }
          .fc .fc-daygrid-day { min-height: 36px !important; }
        }
      `}</style>
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        dateClick={(info) => onDateClick(info.dateStr)}
        eventClick={(info) => {
          const dateStr = info.event.startStr.split('T')[0]
          onDateClick(dateStr)
        }}
        headerToolbar={{
          left: 'prev',
          center: 'title',
          right: 'next'
        }}
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