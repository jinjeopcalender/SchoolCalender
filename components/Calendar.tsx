'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'

export default function Calendar({ events }: any) {
  return (
    <div className="mt-8">
      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        events={events}
      />
    </div>
  )
}