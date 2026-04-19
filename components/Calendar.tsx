'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'

interface CalendarProps {
  events: any[]
  onDateClick: (date: string) => void
}

export default function Calendar({ events, onDateClick }: CalendarProps) {
  return (
    <div className="mt-8">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        dateClick={(info) => onDateClick(info.dateStr)}
      />
    </div>
  )
}
