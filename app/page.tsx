'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Calendar from '@/components/Calendar'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'

type Tab = 'calendar' | 'teacher'
type Category = '수행평가' | '기타'

const CATEGORY_STYLES: Record<string, { badge: string; color: string }> = {
  '수행평가': { badge: 'bg-blue-100 text-blue-700', color: '#3b82f6' },
  '학교행사': { badge: 'bg-green-100 text-green-700', color: '#10b981' },
  '휴일':   { badge: 'bg-red-100 text-red-600',   color: '#ef4444' },
  '기타':     { badge: 'bg-purple-100 text-purple-700', color: '#8b5cf6' },
  '개인':     { badge: 'bg-yellow-100 text-yellow-700', color: '#f59e0b' },
}
const getCategoryBadge = (cat: string) => CATEGORY_STYLES[cat]?.badge ?? 'bg-gray-100 text-gray-600'
const getCategoryColor = (cat: string) => CATEGORY_STYLES[cat]?.color ?? '#8b5cf6'

const SUBJECTS = ['국어','수학','영어','과학','사회','역사','도덕','체육','음악','미술','기술·가정','정보','한문','기타']

const INPUT = 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2.5 w-full rounded-xl text-sm'
const BTN_GRAY = 'flex-1 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm'
const BTN_BLUE = 'btn flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium shadow-md shadow-blue-200 dark:shadow-blue-900/30'
const BTN_GREEN = 'btn flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-medium shadow-md shadow-green-200 dark:shadow-green-900/30'

export default function Home() {
  // 유저
  const [user,             setUser]             = useState<any>(null)
  const [userGrade,        setUserGrade]        = useState<number | null>(null)
  const [isAdmin,          setIsAdmin]          = useState(false)
  const [isTeacher,        setIsTeacher]        = useState(false)
  const [myTeacherRow,     setMyTeacherRow]     = useState<any>(null) // teachers 테이블 본인 row
  const [showGradePicker,  setShowGradePicker]  = useState(false)
  const [showTeacherPicker,setShowTeacherPicker]= useState(false)
  const [showTeacherAuth,  setShowTeacherAuth]  = useState(false) // 학년 선택 화면에서 선생님 선택 시 비밀번호 입력
  const [teacherAuthPw,    setTeacherAuthPw]    = useState('')
  const [teacherAuthError, setTeacherAuthError] = useState('')

  // 캘린더
  const [events,        setEvents]        = useState<any[]>([])
  const [pendingPosts,  setPendingPosts]  = useState<any[]>([])
  const [activeTab,     setActiveTab]     = useState<Tab>('calendar')

  // 날짜 팝업
  const [selectedDate,       setSelectedDate]       = useState<string | null>(null)
  const [selectedDateEvents, setSelectedDateEvents] = useState<any[]>([])
  const [showDatePopup,      setShowDatePopup]      = useState(false)
  const [showAddForm,        setShowAddForm]        = useState(false)
  const [popupTitle,         setPopupTitle]         = useState('')
  const [popupContent,       setPopupContent]       = useState('')
  const [popupCategory,      setPopupCategory]      = useState<Category>('수행평가')
  const [popupGrade,         setPopupGrade]         = useState<number | null>(null)

  // 학교일정
  const [showSchoolEventForm, setShowSchoolEventForm] = useState(false)
  const [editingSchoolEvent,  setEditingSchoolEvent]  = useState<any>(null) // 수정 중인 학교일정
  const [schoolEventTitle,    setSchoolEventTitle]    = useState('')
  const [schoolEventContent,  setSchoolEventContent]  = useState('')
  const [schoolEventDate,     setSchoolEventDate]     = useState('')
  const [schoolEventEndDate,  setSchoolEventEndDate]  = useState('')
  const [schoolEventDateType, setSchoolEventDateType] = useState<'single'|'range'>('single')
  const [schoolEventGrade,    setSchoolEventGrade]    = useState<number | null>(null)
  const [schoolEventType,     setSchoolEventType]     = useState<'학교행사'|'휴일'>('학교행사')

  // 날짜 팝업 일정 추가 기간
  const [popupDateType,  setPopupDateType]  = useState<'single'|'range'>('single')
  const [popupEndDate,   setPopupEndDate]   = useState('')
  const [popupIsPersonal, setPopupIsPersonal] = useState(false)
  const [popupColor,     setPopupColor]     = useState('#f59e0b')

  // 날짜 팝업 일정 수정 (기간만)
  const [showEditEvent,   setShowEditEvent]   = useState(false)
  const [editingEvent,    setEditingEvent]    = useState<any>(null)
  const [editStartDate,   setEditStartDate]   = useState('')
  const [editEndDate,     setEditEndDate]     = useState('')
  const [editDateType,    setEditDateType]    = useState<'single'|'range'>('single')

  // 알림
  const [notifications,    setNotifications]    = useState<any[]>([])
  const [showNotifications,setShowNotifications]= useState(false)
  const [notifTab,         setNotifTab]         = useState<'active'|'held'>('active')

  // 날짜 선택 대기
  const [pendingPostId,  setPendingPostId]  = useState<string | null>(null)
  const pendingPostTitleRef   = useRef<string | null>(null)
  const pendingNotifIdRef     = useRef<string | null>(null)
  const pendingDefaultDateRef = useRef<string | null>(null)
  const [showDatePicker,    setShowDatePicker]    = useState(false)
  const [pickerDate,        setPickerDate]        = useState('')
  const [pickerEndDate,     setPickerEndDate]     = useState('')
  const [pickerDateType,    setPickerDateType]    = useState<'single'|'range'>('single')
  const pendingEndDateRef = useRef<string | null>(null)

  // PWA 설치
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [showIOSInstall, setShowIOSInstall] = useState(false)

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstallBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS 감지 - Safari에서 standalone 모드가 아닌 경우
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = (window.navigator as any).standalone === true
    if (isIOS && !isStandalone) {
      setTimeout(() => setShowIOSInstall(true), 1500)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setShowInstallBanner(false)
    setInstallPrompt(null)
  }

  // 공지
  const [notices,          setNotices]          = useState<any[]>([])
  const [allNotices,       setAllNotices]       = useState<any[]>([]) // 관리자용 전체 목록
  const [activeNoticeIdx,  setActiveNoticeIdx]  = useState(0)
  const [showNoticePopup,  setShowNoticePopup]  = useState(false)
  const [showNoticeForm,   setShowNoticeForm]   = useState(false)
  const [showNoticeManager,setShowNoticeManager]= useState(false) // 공지 관리 탭
  const [noticeTitle,      setNoticeTitle]      = useState('')
  const [noticeContent,    setNoticeContent]    = useState('')
  const [noticePreview,    setNoticePreview]    = useState(false)
  const [editingNotice,    setEditingNotice]    = useState<any>(null)
  const [uploadingImage,   setUploadingImage]   = useState(false)
  const noticeTextareaRef  = useRef<HTMLTextAreaElement>(null)

  // 튜토리얼
  const [showTutorial, setShowTutorial] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)

  const tutorialSteps = [
    {
      title: '📅 캘린더',
      desc: '날짜를 탭하면 그날의 일정을 확인하고 새 일정을 추가할 수 있어요.',
      position: 'center',
    },
    {
      title: '🔔 알림',
      desc: '선생님이나 관리자, 친구가 일정을 올리면 알림이 와요. 알림을 눌러 일정을 수락하거나 보류할 수 있어요.',
      position: 'top',
    },
    {
      title: '💬 메시지',
      desc: '선생님 위치 탭에서 선생님께 메시지를 보낼 수 있어요. 선생님이 로그인해야 보낼 수 있어요. ',
      position: 'top',
    },
    {
      title: '🏫 선생님 위치',
      desc: '아래 탭에서 선생님 위치를 확인할 수 있어요. 과목별로 정리되어 있어요.',
      position: 'bottom',
    },
    {
      title: '➕ 일정 추가',
      desc: '캘린더에서 날짜를 탭하고 "+ 일정 추가"를 누르면 수행평가나 기타 일정을 등록할 수 있어요. 하루 또는 기간으로 설정 가능해요.',
      position: 'center',
    },
    {
      title: '✅ 준비 완료!',
      desc: '이제 클래스톡을 자유롭게 사용해보세요. 우측 하단 ? 버튼을 눌러 언제든 다시 볼 수 있어요.',
      position: 'center',
    },
  ]

  // 토스트
  const [toast, setToast] = useState<{msg: string; type: 'success'|'error'|'info'} | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (msg: string, type: 'success'|'error'|'info' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, type })
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  // 캘린더 hover 툴팁
  const [hoverTooltip, setHoverTooltip] = useState<{ x: number; y: number; items: any[] } | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCellHover = (dateStr: string, rect: DOMRect | null) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    if (!dateStr || !rect) { hoverTimer.current = setTimeout(() => setHoverTooltip(null), 150); return }
    const items = events.filter(ev => {
      const start = ev.start || ev.date
      if (!start) return false
      if (ev.end) {
        const endInclusive = new Date(ev.end)
        endInclusive.setDate(endInclusive.getDate() - 1)
        const endStr = endInclusive.toISOString().split('T')[0]
        return dateStr >= start && dateStr <= endStr
      }
      return start === dateStr
    })
    if (items.length === 0) { setHoverTooltip(null); return }
    setHoverTooltip({ x: rect.left, y: rect.top, items })
  }

  // 선생님 관리
  const [teachers,        setTeachers]        = useState<any[]>([])
  const [showTeacherForm, setShowTeacherForm] = useState(false)
  const [teacherName,     setTeacherName]     = useState('')
  const [teacherSubject,  setTeacherSubject]  = useState(SUBJECTS[0])
  const [teacherLocation, setTeacherLocation] = useState('')
  const [editingTeacher,  setEditingTeacher]  = useState<any>(null)
  const [openSubjects,    setOpenSubjects]    = useState<Set<string>>(new Set(SUBJECTS))

  // 메시지
  const [showMsgForm,     setShowMsgForm]     = useState(false)
  const [msgTarget,       setMsgTarget]       = useState<any>(null)
  const [msgContent,      setMsgContent]      = useState('')
  const [pendingMessages, setPendingMessages] = useState<any[]>([]) // 관리자 승인 대기
  const [myMessages,      setMyMessages]      = useState<any[]>([]) // 선생님 수신함
  const [showMsgInbox,    setShowMsgInbox]    = useState(false)
  const [inboxTab,        setInboxTab]        = useState<'unread'|'replied'>('unread')
  const [sentMessages,    setSentMessages]    = useState<any[]>([]) // 학생/관리자 보낸 메시지함
  const [showSentMessages,setShowSentMessages]= useState(false)
  const [sentPage,        setSentPage]        = useState(1)
  const PAGE_SIZE = 10
  const [replyTarget,     setReplyTarget]     = useState<any>(null) // 답장할 메시지
  const [replyContent,    setReplyContent]    = useState('')
  const [showReplyForm,   setShowReplyForm]   = useState(false)

  const toggleSubject = (s: string) =>
    setOpenSubjects(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n })

  // ── 뒤로가기 ──────────────────────────────────────────────────
  const pushHistory = () => window.history.pushState({ popup: true }, '')

  useEffect(() => {
    const handle = () => {
      if (showNoticePopup)     { setShowNoticePopup(false); return }
      if (showNoticeManager)    { setShowNoticeManager(false); return }
      if (showNoticeForm)       { setShowNoticeForm(false); setNoticeTitle(''); setNoticeContent(''); setNoticePreview(false); setEditingNotice(null); return }
      if (showReplyForm)       { setShowReplyForm(false); setReplyContent(''); return }
      if (showSentMessages)    { setShowSentMessages(false); return }
      if (showMsgInbox)        { setShowMsgInbox(false); return }
      if (showMsgForm)         { setShowMsgForm(false); setMsgContent(''); return }
      if (showTeacherPicker)   { setShowTeacherPicker(false); return }
      if (showTeacherForm)     { setShowTeacherForm(false); resetTeacherForm(); return }
      if (showSchoolEventForm) { setShowSchoolEventForm(false); resetSchoolEventForm(); return }
      if (showEditEvent)       { setShowEditEvent(false); return }
      if (showDatePicker)      { cancelDatePicker(); return }
      if (showAddForm)         { setShowAddForm(false); return }
      if (showDatePopup)       { closeDatePopup(); return }
      if (showNotifications)   { setShowNotifications(false); return }
    }
    window.addEventListener('popstate', handle)
    return () => window.removeEventListener('popstate', handle)
  }, [showNoticePopup, showNoticeManager, showNoticeForm, showReplyForm, showSentMessages, showMsgInbox, showMsgForm, showTeacherPicker, showTeacherForm,
      showSchoolEventForm, showEditEvent, showDatePicker, showAddForm, showDatePopup, showNotifications])

  useEffect(() => { if (showNotifications)   pushHistory() }, [showNotifications])
  useEffect(() => { if (showDatePopup)        pushHistory() }, [showDatePopup])
  useEffect(() => { if (showAddForm)          pushHistory() }, [showAddForm])
  useEffect(() => { if (showDatePicker)       pushHistory() }, [showDatePicker])
  useEffect(() => { if (showSchoolEventForm)  pushHistory() }, [showSchoolEventForm])
  useEffect(() => { if (showEditEvent)        pushHistory() }, [showEditEvent])
  useEffect(() => { if (showTeacherForm)      pushHistory() }, [showTeacherForm])
  useEffect(() => { if (showTeacherPicker)    pushHistory() }, [showTeacherPicker])
  useEffect(() => { if (showMsgForm)          pushHistory() }, [showMsgForm])
  useEffect(() => { if (showMsgInbox)         pushHistory() }, [showMsgInbox])
  useEffect(() => { if (showSentMessages)     pushHistory() }, [showSentMessages])
  useEffect(() => { if (showNoticeManager)     pushHistory() }, [showNoticeManager])
  useEffect(() => { if (showNoticeForm)        pushHistory() }, [showNoticeForm])
  useEffect(() => { if (showReplyForm)        pushHistory() }, [showReplyForm])
  // ──────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.removeAllChannels()
    const init = async () => {
      const { data, error } = await supabase.auth.getUser()
      // 인증 에러여도 비로그인으로 처리 (signOut은 실제 세션이 있을 때만)
      const cu = error ? null : data.user

      // 비로그인: 공개 데이터만 로드
      if (!cu) {
        await loadTeachers()
        await loadNotices()
        const { data: schoolPosts } = await supabase.from('posts')
          .select('id, title, content, category, default_date, end_date')
          .eq('status', 'approved').in('category', ['학교행사', '휴일'])
        const schoolEvents = (schoolPosts||[]).map(p => {
          const endExclusive = p.end_date
            ? (() => { const d = new Date(p.end_date); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0] })()
            : undefined
          return {
            id: p.id, title: p.title, content: p.content, category: p.category,
            date: p.default_date, start: p.default_date, end: endExclusive,
            color: getCategoryColor(p.category),
            backgroundColor: getCategoryColor(p.category),
            borderColor: getCategoryColor(p.category),
          }
        })
        const year = new Date().getFullYear()
        const holidays = [
          ...loadKoreanHolidays(year),
          ...loadKoreanHolidays(year + 1),
        ]
        // 이미 DB에 같은 날짜 휴일이 있으면 중복 제거
        const existingDates = new Set(schoolEvents.filter(e => e.category === '휴일').map(e => e.date))
        const filteredHolidays = holidays.filter(h => !existingDates.has(h.date))
        setEvents([...schoolEvents, ...filteredHolidays])
        return
      }

      setUser(cu)

      await supabase.from('users').upsert({ id: cu.id, name: cu.user_metadata.full_name })
      const { data: ud } = await supabase.from('users').select('role, grade').eq('id', cu.id).single()

      // 첫 로그인 튜토리얼
      const tutorialKey = `tutorial_done_${cu.id}`
      if (!localStorage.getItem(tutorialKey)) {
        setTimeout(() => { setShowTutorial(true); setTutorialStep(0) }, 800)
      }

      const admin   = ud?.role === 'admin'
      const teacher = ud?.role === 'teacher'
      setIsAdmin(admin)
      setIsTeacher(teacher)

      await loadTeachers()
      await loadNotices()

      // 선생님: 본인 teachers row 연결 확인
      if (teacher) {
        const { data: myT } = await supabase.from('teachers').select('*').eq('user_id', cu.id).maybeSingle()
        if (!myT) {
          setShowTeacherPicker(true)
          return
        }
        setMyTeacherRow(myT)
        await loadMessages(cu.id, admin, teacher, myT)
      } else {
        await loadMessages(cu.id, admin, false, null)
      }

      if (!ud?.grade && !admin && !teacher) {
        setShowGradePicker(true)
        return
      }

      setUserGrade(ud?.grade ?? null)
      await loadCalendarData(cu.id, ud?.grade ?? 0, admin)
    }
    init()
    return () => { supabase.removeAllChannels() }
  }, [])

  // ── 데이터 로드 ───────────────────────────────────────────────
  const loadCalendarData = async (uid: string, grade: number, admin: boolean) => {
    // 새 유저 알림 자동 생성 (관리자 제외)
    if (!admin) {
      const { data: missed } = await supabase.from('posts').select('id')
        .eq('status','approved').eq('is_user_generated',true)
        .or(`grade.is.null,grade.eq.${grade}`).neq('created_by', uid)
      if (missed?.length)
        await supabase.from('notifications')
          .upsert(missed.map(p => ({ user_id: uid, post_id: p.id, is_read: false })), { onConflict: 'user_id,post_id' })

      // 새 유저 학교행사/휴일 자동 추가
      const { data: school } = await supabase.from('posts').select('id, default_date, end_date, category')
        .eq('status','approved').in('category',['학교행사','휴일']).or(`grade.is.null,grade.eq.${grade}`)
      if (school?.length)
        await supabase.from('user_calendar')
          .upsert(school.map(p => ({ user_id: uid, post_id: p.id, assigned_date: p.default_date, end_date: p.end_date ?? null })), { onConflict: 'user_id,post_id' })
    }

    // 관리자: 모든 학년 승인된 일정 직접 로드
    if (admin) {
      const { data: allPosts } = await supabase.from('posts')
        .select('id, title, content, category, grade, default_date, end_date, created_by')
        .eq('status', 'approved')
      // user_calendar에서 관리자 본인 날짜 오버라이드 가져오기
      const { data: adminCal } = await supabase.from('user_calendar')
        .select('post_id, assigned_date, end_date').eq('user_id', uid)
      const calMap = new Map((adminCal||[]).map(c => [c.post_id, c]))

      const adminEvents = (allPosts||[]).map(p => {
        const cal = calMap.get(p.id)
        const assignedDate = cal?.assigned_date ?? p.default_date
        const endDate = cal?.end_date ?? p.end_date
        const endExclusive = endDate
          ? (() => { const d = new Date(endDate); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0] })()
          : undefined
        const gradeLabel = p.grade ? `[${p.grade}학년] ` : ''
        return {
          id: p.id, title: gradeLabel + p.title, content: p.content,
          category: p.category, date: assignedDate, grade: p.grade,
          created_by: p.created_by,
          start: assignedDate, end: endExclusive,
          color: getCategoryColor(p.category),
          backgroundColor: getCategoryColor(p.category),
          borderColor: getCategoryColor(p.category),
        }
      })
      const year = new Date().getFullYear()
      const holidays = [...loadKoreanHolidays(year), ...loadKoreanHolidays(year + 1)]
      const existingDates = new Set(adminEvents.filter(e => e.category === '휴일').map(e => e.date))
      const filteredHolidays = holidays.filter(h => !existingDates.has(h.date))
      setEvents([...adminEvents, ...filteredHolidays])
    } else {
      const { data: cal } = await supabase
        .from('user_calendar').select('id, assigned_date, end_date, is_personal, title, content, color, posts(id,title,content,category,created_by,grade)').eq('user_id', uid)
      setEvents((cal||[]).map((item:any) => {
        const endDateExclusive = item.end_date
          ? (() => { const d = new Date(item.end_date); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0] })()
          : undefined
        if (item.is_personal) {
          return {
            id: item.id, title: item.title, content: item.content,
            category: '개인', date: item.assigned_date,
            is_personal: true, cal_id: item.id,
            start: item.assigned_date, end: endDateExclusive,
            color: item.color || '#f59e0b',
            backgroundColor: item.color || '#f59e0b',
            borderColor: item.color || '#f59e0b',
          }
        }
        return {
          id: item.posts.id, title: item.posts.title, content: item.posts.content,
          category: item.posts.category, date: item.assigned_date,
          grade: item.posts.grade, cal_id: item.id,
          created_by: item.posts.created_by,
          start: item.assigned_date, end: endDateExclusive,
          color: getCategoryColor(item.posts.category),
          backgroundColor: getCategoryColor(item.posts.category),
          borderColor: getCategoryColor(item.posts.category),
        }
      }))
    }

    // 공휴일 추가 (DB 휴일과 중복 제거)
    const year = new Date().getFullYear()
    const holidays = [...loadKoreanHolidays(year), ...loadKoreanHolidays(year + 1)]
    setEvents(prev => {
      const existingDates = new Set(prev.filter(e => e.category === '휴일').map(e => e.date))
      const filtered = holidays.filter(h => !existingDates.has(h.date))
      return [...prev, ...filtered]
    })

    const { data: notifData } = await supabase.from('notifications')
      .select('*, posts(id,title,content,default_date,end_date,category)')
      .eq('user_id', uid).neq('status','dismissed').neq('status','accepted')
    setNotifications(notifData || [])

    if (admin) {
      const { data: pending } = await supabase.from('posts').select('*').eq('status','pending')
      setPendingPosts(pending || [])
    }

    // Realtime - 알림 INSERT + UPDATE
    supabase.channel('notifications-channel')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'notifications', filter:`user_id=eq.${uid}` },
        async (payload) => {
          const { data: n } = await supabase.from('notifications')
            .select('*, posts(id,title,content,default_date,end_date,category)').eq('id', payload.new.id).single()
          if (n) setNotifications(prev => prev.some(x=>x.id===n.id) ? prev : [n, ...prev])
        })
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'notifications', filter:`user_id=eq.${uid}` },
        (payload) => {
          const s = payload.new.status
          if (s === 'dismissed' || s === 'accepted')
            setNotifications(prev => prev.filter(n => n.id !== payload.new.id))
          else
            setNotifications(prev => prev.map(n => n.id === payload.new.id ? { ...n, status: s } : n))
        })
      .subscribe()

    // Realtime - 캘린더 INSERT
    supabase.channel('user-calendar-channel')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'user_calendar', filter:`user_id=eq.${uid}` },
        async (payload) => {
          if (!payload.new.post_id) return  // 개인 일정은 무시
          const { data: p } = await supabase.from('posts')
            .select('id,title,content,category,created_by').eq('id', payload.new.post_id).single()
          if (p) {
            const endDateExclusive = payload.new.end_date
              ? (() => { const d = new Date(payload.new.end_date); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0] })()
              : undefined
            setEvents(prev => prev.some(e=>e.id===p.id) ? prev : [...prev, {
              id:p.id, title:p.title, content:p.content, category:p.category,
              created_by:p.created_by,
              date:payload.new.assigned_date, start:payload.new.assigned_date, end:endDateExclusive,
              color:getCategoryColor(p.category),
              backgroundColor:getCategoryColor(p.category),
              borderColor:getCategoryColor(p.category),
            }])
          }
        })
      .subscribe()

    // Realtime - teachers 변경
    supabase.channel('teachers-channel')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'teachers' },
        (payload) => setTeachers(prev => {
          if (prev.some(t => t.id === payload.new.id)) return prev
          return [...prev, payload.new as any].sort((a,b) => a.subject.localeCompare(b.subject) || a.name.localeCompare(b.name))
        }))
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'teachers' },
        (payload) => setTeachers(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t)))
      .on('postgres_changes', { event:'DELETE', schema:'public', table:'teachers' },
        (payload) => setTeachers(prev => prev.filter(t => t.id !== (payload.old as any).id)))
      .subscribe()

    if (admin) {
      supabase.channel('posts-channel')
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'posts' },
          (payload) => { if (payload.new.status==='pending') setPendingPosts(prev=>[payload.new,...prev]) })
        .on('postgres_changes', { event:'UPDATE', schema:'public', table:'posts' },
          (payload) => { if (payload.new.status!=='pending') setPendingPosts(prev=>prev.filter(p=>p.id!==payload.new.id)) })
        .subscribe()
    }
  }

  const loadKoreanHolidays = (year: number) => {
    try {
      // date-holidays는 dynamic import 필요
      const Holidays = require('date-holidays')
      const hd = new Holidays('KR')
      const holidays = hd.getHolidays(year)
      return holidays
        .filter((h: any) => h.type === 'public')
        .map((h: any) => {
          const dateStr = h.date.split(' ')[0]
          return {
            id: `holiday-${dateStr}`,
            title: h.name,
            content: '',
            category: '휴일',
            date: dateStr,
            start: dateStr,
            color: getCategoryColor('휴일'),
            backgroundColor: getCategoryColor('휴일'),
            borderColor: getCategoryColor('휴일'),
            isHoliday: true,
          }
        })
    } catch {
      return []
    }
  }

  const loadTeachers = async () => {
    const { data } = await supabase.from('teachers').select('*').order('subject').order('name')
    setTeachers(data || [])
  }

  const loadNotices = async (adminMode = false) => {
    const { data } = await supabase.from('notices')
      .select('*').eq('is_active', true).order('created_at', { ascending: false })
    if (!data?.length) return

    if (adminMode) {
      setAllNotices(data)
      return
    }

    // localStorage로 보지 않기 필터링
    const visible = data.filter(n => {
      const key = `notice_hide_${n.id}`
      const hideUntil = localStorage.getItem(key)
      if (!hideUntil) return true
      return new Date(hideUntil) < new Date()
    })
    if (visible.length > 0) {
      setNotices(visible)
      setActiveNoticeIdx(0)
      setShowNoticePopup(true)
    }
  }

  const loadAllNoticesForAdmin = async () => {
    const { data } = await supabase.from('notices')
      .select('*').eq('is_active', true).order('created_at', { ascending: false })
    setAllNotices(data || [])
  }

  const dismissNotice = (days: number) => {
    const notice = notices[activeNoticeIdx]
    if (!notice) return
    const until = new Date()
    until.setDate(until.getDate() + days)
    localStorage.setItem(`notice_hide_${notice.id}`, until.toISOString())
    if (activeNoticeIdx < notices.length - 1) {
      setActiveNoticeIdx(i => i + 1)
    } else {
      setShowNoticePopup(false)
    }
  }

  // 텍스트 커서 위치에 삽입
  const insertToContent = (before: string, after = '') => {
    const ta = noticeTextareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = noticeContent.slice(start, end)
    const newText = noticeContent.slice(0, start) + before + selected + after + noticeContent.slice(end)
    setNoticeContent(newText)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + before.length, start + before.length + selected.length)
    }, 0)
  }

  // 이미지 업로드
  const uploadNoticeImage = async (file: File) => {
    setUploadingImage(true)
    const ext = file.name.split('.').pop()
    const filename = `${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('notices').upload(filename, file)
    if (error) { showToast('이미지 업로드 실패', 'error'); setUploadingImage(false); return }
    const { data: urlData } = supabase.storage.from('notices').getPublicUrl(filename)
    const url = urlData.publicUrl
    insertToContent(`![이미지](${url})`)
    setUploadingImage(false)
    showToast('이미지가 삽입됐어요!')
  }

  const submitNotice = async () => {
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      showToast('제목과 내용을 입력해주세요!', 'error'); return
    }
    if (editingNotice) {
      const { error } = await supabase.from('notices').update({
        title: noticeTitle.trim(), content: noticeContent.trim(),
      }).eq('id', editingNotice.id)
      if (error) { showToast(error.message, 'error'); return }
      showToast('공지가 수정됐어요!')
      await loadAllNoticesForAdmin()
    } else {
      const { error } = await supabase.from('notices').insert({
        title: noticeTitle.trim(), content: noticeContent.trim(), created_by: user.id,
      })
      if (error) { showToast(error.message, 'error'); return }
      showToast('공지가 등록됐어요!')
      await loadAllNoticesForAdmin()
    }
    setShowNoticeForm(false)
    setNoticeTitle(''); setNoticeContent(''); setNoticePreview(false); setEditingNotice(null)
  }

  const openEditNotice = (n: any) => {
    setEditingNotice(n)
    setNoticeTitle(n.title)
    setNoticeContent(n.content)
    setNoticePreview(false)
    setShowNoticeForm(true)
  }

  const deleteNotice = async (id: string) => {
    if (!confirm('공지를 삭제할까요?')) return
    await supabase.from('notices').update({ is_active: false }).eq('id', id)
    setAllNotices(prev => prev.filter(n => n.id !== id))
    showToast('공지가 삭제됐어요!')
  }

  const loadMessages = async (uid: string, admin: boolean, teacher: boolean, myT: any) => {
    if (admin) {
      const { data } = await supabase.from('messages')
        .select('*, teachers(name,subject)')
        .eq('status','pending').order('created_at', { ascending: false })

      const enriched = await Promise.all((data||[]).map(async (m: any) => {
        const { data: s } = await supabase.from('users').select('name').eq('id', m.sender_id).single()
        return { ...m, senderName: s?.name ?? '알 수 없음' }
      }))
      setPendingMessages(enriched)

      supabase.channel('messages-admin-channel')
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' },
          async (payload) => {
            if (payload.new.status !== 'pending') return
            const { data: m } = await supabase.from('messages')
              .select('*, teachers(name,subject)').eq('id', payload.new.id).single()
            if (m) {
              const { data: s } = await supabase.from('users').select('name').eq('id', m.sender_id).single()
              setPendingMessages(prev => [{ ...m, senderName: s?.name ?? '알 수 없음' }, ...prev])
            }
          })
        .on('postgres_changes', { event:'UPDATE', schema:'public', table:'messages' },
          (payload) => {
            if (payload.new.status !== 'pending')
              setPendingMessages(prev => prev.filter(m => m.id !== payload.new.id))
          })
        .subscribe()
    }

    if (teacher && myT) {
      const { data } = await supabase.from('messages')
        .select('*')
        .eq('teacher_id', myT.id).eq('status','approved')
        .order('created_at', { ascending: false })

      const enriched = await Promise.all((data||[]).map(async (m: any) => {
        const { data: s } = await supabase.from('users').select('name').eq('id', m.sender_id).single()
        return { ...m, senderName: s?.name ?? '알 수 없음' }
      }))
      setMyMessages(enriched)

      supabase.channel('messages-teacher-channel')
        // 새 메시지 승인(pending→approved) 또는 답장 읽음 처리 UPDATE
        .on('postgres_changes', { event:'UPDATE', schema:'public', table:'messages' },
          async (payload) => {
            if (payload.new.teacher_id !== myT.id) return
            if (payload.new.status === 'approved') {
              const { data: m } = await supabase.from('messages')
                .select('*').eq('id', payload.new.id).single()
              if (m) {
                const { data: s } = await supabase.from('users').select('name').eq('id', m.sender_id).single()
                const enriched = { ...m, senderName: s?.name ?? '알 수 없음' }
                setMyMessages(prev => {
                  const exists = prev.some(x => x.id === m.id)
                  return exists ? prev.map(x => x.id === m.id ? enriched : x) : [enriched, ...prev]
                })
              }
            }
          })
        .subscribe()
    }

    // 학생 + 관리자: 본인이 보낸 메시지(답장 포함) 로드
    if (!teacher) {
      const { data } = await supabase.from('messages')
        .select('*, teachers(name,subject)')
        .eq('sender_id', uid)
        .in('status', ['approved','pending','rejected'])
        .order('created_at', { ascending: false })
      setSentMessages(data || [])

      supabase.channel('messages-sent-channel')
        // 새 메시지 INSERT
        .on('postgres_changes', { event:'INSERT', schema:'public', table:'messages' },
          async (payload) => {
            if (payload.new.sender_id !== uid) return
            const { data: m } = await supabase.from('messages')
              .select('*, teachers(name,subject)').eq('id', payload.new.id).single()
            if (m) setSentMessages(prev => prev.some(x=>x.id===m.id) ? prev : [m, ...prev])
          })
        // 상태변경 or 답장 UPDATE
        .on('postgres_changes', { event:'UPDATE', schema:'public', table:'messages' },
          async (payload) => {
            if (payload.new.sender_id !== uid) return
            const { data: m } = await supabase.from('messages')
              .select('*, teachers(name,subject)').eq('id', payload.new.id).single()
            if (m) setSentMessages(prev => prev.map(x => x.id === m.id ? m : x))
          })
        .subscribe()
    }
  }

  // ── 선생님 본인 선택 ───────────────────────────────────────────
  const selectMyTeacher = async (t: any) => {
    if (!user) return
    const { error } = await supabase.from('teachers').update({ user_id: user.id }).eq('id', t.id)
    if (error) { showToast(error.message, 'error'); return }
    setMyTeacherRow(t)
    setShowTeacherPicker(false)
    await loadMessages(user.id, false, true, t)
    await loadCalendarData(user.id, userGrade ?? 0, false)
  }

  // ── 선생님 관리 ───────────────────────────────────────────────
  const resetTeacherForm = () => { setTeacherName(''); setTeacherSubject(SUBJECTS[0]); setTeacherLocation(''); setEditingTeacher(null) }
  const openAddTeacher   = () => { resetTeacherForm(); setShowTeacherForm(true) }
  const openEditTeacher  = (t: any) => { setEditingTeacher(t); setTeacherName(t.name); setTeacherSubject(t.subject); setTeacherLocation(t.location); setShowTeacherForm(true) }

  const submitTeacher = async () => {
    if (!teacherName.trim() || !teacherLocation.trim()) { showToast('성함과 위치를 입력해주세요!', 'error'); return }
    if (editingTeacher) {
      const { error } = await supabase.from('teachers')
        .update({ name: teacherName.trim(), subject: teacherSubject, location: teacherLocation.trim() }).eq('id', editingTeacher.id)
      if (error) { showToast(error.message, 'error'); return }
    } else {
      const { error } = await supabase.from('teachers')
        .insert({ name: teacherName.trim(), subject: teacherSubject, location: teacherLocation.trim() })
      if (error) { showToast(error.message, 'error'); return }
    }
    await loadTeachers(); setShowTeacherForm(false); resetTeacherForm()
  }

  const deleteTeacher = async (id: string) => {
    if (!confirm('삭제할까요?')) return
    await supabase.from('teachers').delete().eq('id', id)
    setTeachers(prev => prev.filter(t => t.id !== id))
  }

  // ── 메시지 ────────────────────────────────────────────────────
  const openMsgForm = (t: any) => { setMsgTarget(t); setMsgContent(''); setShowMsgForm(true) }

  const submitMessage = async () => {
    if (!user || !msgTarget || !msgContent.trim()) { showToast('내용을 입력해주세요!', 'error'); return }
    // 관리자는 바로 approved, 일반 사용자는 pending
    const status = isAdmin ? 'approved' : 'pending'
    const { error } = await supabase.from('messages').insert({
      sender_id: user.id, teacher_id: msgTarget.id, content: msgContent.trim(), status,
    })
    if (error) { showToast(error.message, 'error'); return }
    setShowMsgForm(false); setMsgContent('')
    showToast(isAdmin ? '메시지가 선생님께 바로 전달됐어요!' : '전송됐어요! 관리자 검토 후 선생님께 전달돼요.')
  }

  const approveMessage = async (id: string) => {
    await supabase.from('messages').update({ status: 'approved' }).eq('id', id)
    setPendingMessages(prev => prev.filter(m => m.id !== id))
  }

  const rejectMessage = async (id: string) => {
    await supabase.from('messages').update({ status: 'rejected' }).eq('id', id)
    setPendingMessages(prev => prev.filter(m => m.id !== id))
  }

  const openReplyForm = (m: any) => { setReplyTarget(m); setReplyContent(''); setShowReplyForm(true) }

  const submitReply = async () => {
    if (!replyTarget || !replyContent.trim()) { showToast('답장 내용을 입력해주세요!', 'error'); return }
    const { error } = await supabase.from('messages')
      .update({ reply: replyContent.trim(), reply_read: false }).eq('id', replyTarget.id)
    if (error) { showToast(error.message, 'error'); return }
    setMyMessages(prev => prev.map(m => m.id === replyTarget.id ? { ...m, reply: replyContent.trim(), reply_read: false } : m))
    setShowReplyForm(false); setReplyContent(''); setReplyTarget(null)
  }

  // 보낸 메시지함 열 때 답장 읽음 처리
  const openSentMessages = async () => {
    setShowSentMessages(true)
    const unread = sentMessages.filter(m => m.reply && !m.reply_read)
    if (unread.length === 0) return
    await Promise.all(unread.map(m =>
      supabase.from('messages').update({ reply_read: true }).eq('id', m.id)
    ))
    setSentMessages(prev => prev.map(m => m.reply && !m.reply_read ? { ...m, reply_read: true } : m))
  }

  // ── 기타 함수들 ───────────────────────────────────────────────
  const teachersBySubject = teachers.reduce((acc, t) => {
    if (!acc[t.subject]) acc[t.subject] = []
    acc[t.subject].push(t); return acc
  }, {} as Record<string, any[]>)

  const selectGrade = async (grade: number) => {
    if (!user) return
    await supabase.from('users').update({ grade }).eq('id', user.id)
    setUserGrade(grade); setShowGradePicker(false)
    await loadCalendarData(user.id, grade, isAdmin)
  }

  const confirmTeacherAuth = async () => {
    if (!user || !teacherAuthPw.trim()) return
    const { data } = await supabase.from('settings').select('value').eq('key', 'teacher_password').single()
    if (!data || data.value !== teacherAuthPw.trim()) {
      setTeacherAuthError('비밀번호가 맞지 않아요')
      return
    }
    // 비밀번호 맞으면 role을 teacher로 업데이트, grade는 null
    const { error } = await supabase.from('users').update({ role: 'teacher', grade: null }).eq('id', user.id)
    if (error) { showToast(error.message, 'error'); return }
    setIsTeacher(true)
    setShowGradePicker(false)
    setShowTeacherAuth(false)
    setTeacherAuthPw('')
    setTeacherAuthError('')
    // 선생님 본인 선택 화면으로
    setShowTeacherPicker(true)
  }

  const login  = async () => supabase.auth.signInWithOAuth({ provider:'google', options:{ skipBrowserRedirect:false, queryParams:{ prompt:'select_account' } } })
  const logout = async () => {
    supabase.removeAllChannels()
    await supabase.auth.signOut()
    setUser(null); setUserGrade(null); setIsAdmin(false); setIsTeacher(false)
    setEvents([]); setNotifications([]); setPendingPosts([]); setPendingMessages([])
    // 비로그인 공개 데이터 다시 로드
    await loadTeachers()
    await loadNotices()
    const { data: schoolPosts } = await supabase.from('posts')
      .select('id, title, content, category, default_date, end_date')
      .eq('status', 'approved').in('category', ['학교행사', '휴일'])
    const schoolEvents = (schoolPosts||[]).map((p: any) => {
      const endExclusive = p.end_date
        ? (() => { const d = new Date(p.end_date); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0] })()
        : undefined
      return {
        id: p.id, title: p.title, content: p.content, category: p.category,
        date: p.default_date, start: p.default_date, end: endExclusive,
        color: getCategoryColor(p.category), backgroundColor: getCategoryColor(p.category), borderColor: getCategoryColor(p.category),
      }
    })
    const year = new Date().getFullYear()
    const holidays = [...loadKoreanHolidays(year), ...loadKoreanHolidays(year + 1)]
    const existingDates = new Set(schoolEvents.filter((e: any) => e.category === '휴일').map((e: any) => e.date))
    setEvents([...schoolEvents, ...holidays.filter(h => !existingDates.has(h.date))])
  }

  const closeDatePopup = () => {
    setShowDatePopup(false); setSelectedDate(null); setSelectedDateEvents([])
    setShowAddForm(false); setPopupTitle(''); setPopupContent(''); setPopupCategory('수행평가'); setPopupGrade(null); setPopupDateType('single'); setPopupEndDate(''); setPopupIsPersonal(false); setPopupColor('#f59e0b')
  }

  const handleDateClick = (date: string) => {
    if (pendingPostId) { setPickerDate(date); return }
    setSelectedDate(date); setSelectedDateEvents(events.filter(e => e.date === date))
    setShowDatePopup(true); setShowAddForm(false); setPopupTitle(''); setPopupContent(''); setPopupCategory('수행평가'); setPopupGrade(null)
  }

  const submitPost = async () => {
    if (!user || !selectedDate || !popupTitle) { showToast('제목을 입력해주세요!', 'error'); return }
    const endDate = popupDateType === 'range' && popupEndDate ? popupEndDate : null
    const endExclusive = endDate ? (() => { const d = new Date(endDate); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0] })() : undefined

    // 개인 일정
    if (popupIsPersonal) {
      const { data: calData, error } = await supabase.from('user_calendar').insert({
        user_id: user.id, post_id: null, assigned_date: selectedDate, end_date: endDate,
        title: popupTitle, content: popupContent, color: popupColor, is_personal: true,
      }).select().single()
      if (error) { showToast(error.message, 'error'); return }
      const ev = { id: calData.id, cal_id: calData.id, title: popupTitle, content: popupContent,
        category: '개인', date: selectedDate, start: selectedDate, end: endExclusive,
        is_personal: true, color: popupColor, backgroundColor: popupColor, borderColor: popupColor }
      setEvents(prev=>[...prev,ev]); setSelectedDateEvents(prev=>[...prev,ev])
      setShowAddForm(false); setPopupTitle(''); setPopupContent(''); setPopupDateType('single'); setPopupEndDate(''); setPopupIsPersonal(false); setPopupColor('#f59e0b')
      showToast('개인 일정이 추가됐어요!')
      return
    }

    const targetGrade = (isAdmin || isTeacher) ? popupGrade : userGrade
    if (!targetGrade) { showToast('학년을 선택해주세요!', 'error'); return }

    // 선생님은 승인 없이 바로 approved
    const status = isTeacher ? 'approved' : 'pending'

    const { data: postData, error } = await supabase.from('posts').insert({
      title:popupTitle, content:popupContent, status, created_by:user.id,
      default_date:selectedDate, end_date:endDate, category:popupCategory, grade:targetGrade, is_user_generated:true,
    }).select().single()
    if (error) { showToast(error.message, 'error'); return }

    // 본인 캘린더에 추가 (선생님도 포함)
    await supabase.from('user_calendar').insert({ user_id:user.id, post_id:postData.id, assigned_date:selectedDate, end_date:endDate })

    // 선생님이 approved로 올리면 해당 학년 학생들에게 알림 직접 생성
    if (isTeacher) {
      const { data: targetUsers } = await supabase.from('users').select('id')
        .eq('grade', targetGrade).neq('role', 'teacher').neq('role', 'admin')
      if (targetUsers?.length) {
        await supabase.from('notifications').insert(
          targetUsers.map(u => ({ user_id: u.id, post_id: postData.id, is_read: false, status: 'pending' }))
        )
      }
    }

    const ev = { id:postData.id, title:popupTitle, content:popupContent, category:popupCategory, date:selectedDate, start:selectedDate, end:endExclusive, color:getCategoryColor(popupCategory), backgroundColor:getCategoryColor(popupCategory), borderColor:getCategoryColor(popupCategory) }
    setEvents(prev=>[...prev,ev]); setSelectedDateEvents(prev=>[...prev,ev])
    setShowAddForm(false); setPopupTitle(''); setPopupContent(''); setPopupDateType('single'); setPopupEndDate(''); setPopupIsPersonal(false)
    if (isTeacher) showToast('일정이 등록됐어요! 해당 학년 학생들에게 알림이 전송됐어요.')
  }

  const submitSchoolEvent = async () => {
    if (!user || !schoolEventTitle || !schoolEventDate) { showToast('제목과 날짜를 입력해주세요!', 'error'); return }
    if (schoolEventDateType === 'range' && !schoolEventEndDate) { showToast('종료 날짜를 입력해주세요!', 'error'); return }
    const endDate = schoolEventDateType === 'range' ? schoolEventEndDate : null
    const { data: postData, error } = await supabase.from('posts').insert({
      title:schoolEventTitle, content:schoolEventContent, status:'approved', created_by:user.id,
      default_date:schoolEventDate, end_date:endDate, category:schoolEventType, grade:schoolEventGrade, is_user_generated:false,
    }).select().single()
    if (error) { showToast(error.message, 'error'); return }
    let q = supabase.from('users').select('id')
    if (schoolEventGrade) q = q.eq('grade', schoolEventGrade)
    const { data: targetUsers } = await q
    if (targetUsers?.length)
      await supabase.from('user_calendar').insert(targetUsers.map(u=>({ user_id:u.id, post_id:postData.id, assigned_date:schoolEventDate, end_date:endDate })))
    const endExclusive = endDate ? (() => { const d = new Date(endDate); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0] })() : undefined
    setEvents(prev=>[...prev,{
      id:postData.id, title:schoolEventTitle, content:schoolEventContent, category:schoolEventType,
      date:schoolEventDate, start:schoolEventDate, end:endExclusive,
      color:getCategoryColor(schoolEventType),
      backgroundColor:getCategoryColor(schoolEventType),
      borderColor:getCategoryColor(schoolEventType),
    }])
    setShowSchoolEventForm(false); resetSchoolEventForm()
    showToast('학교 일정이 추가됐어요!')
  }

  const resetSchoolEventForm = () => {
    setSchoolEventTitle(''); setSchoolEventContent(''); setSchoolEventDate(''); setSchoolEventEndDate('')
    setSchoolEventGrade(null); setSchoolEventType('학교행사'); setSchoolEventDateType('single'); setEditingSchoolEvent(null)
  }

  const openEditSchoolEvent = (event: any) => {
    setShowDatePopup(false)
    setEditingSchoolEvent(event)
    setSchoolEventTitle(event.title)
    setSchoolEventContent(event.content || '')
    setSchoolEventDate(event.date)
    setSchoolEventEndDate(event.end_date || '')
    setSchoolEventDateType(event.end_date ? 'range' : 'single')
    setSchoolEventGrade(event.grade ?? null)
    setSchoolEventType(event.category as '학교행사'|'휴일')
    setShowSchoolEventForm(true)
  }

  const updateSchoolEvent = async () => {
    if (!editingSchoolEvent || !schoolEventTitle || !schoolEventDate) { showToast('제목과 날짜를 입력해주세요!', 'error'); return }
    if (schoolEventDateType === 'range' && !schoolEventEndDate) { showToast('종료 날짜를 입력해주세요!', 'error'); return }
    const endDate = schoolEventDateType === 'range' ? schoolEventEndDate : null
    const { error } = await supabase.from('posts').update({
      title: schoolEventTitle, content: schoolEventContent,
      default_date: schoolEventDate, end_date: endDate,
      category: schoolEventType, grade: schoolEventGrade,
    }).eq('id', editingSchoolEvent.id)
    if (error) { showToast(error.message, 'error'); return }
    // user_calendar도 업데이트
    await supabase.from('user_calendar').update({ assigned_date: schoolEventDate, end_date: endDate })
      .eq('post_id', editingSchoolEvent.id)
    const endExclusive = endDate ? (() => { const d = new Date(endDate); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0] })() : undefined
    setEvents(prev => prev.map(e => e.id === editingSchoolEvent.id ? {
      ...e, title: schoolEventTitle, content: schoolEventContent,
      date: schoolEventDate, start: schoolEventDate, end: endExclusive,
      category: schoolEventType, color: getCategoryColor(schoolEventType),
      backgroundColor: getCategoryColor(schoolEventType), borderColor: getCategoryColor(schoolEventType),
    } : e))
    setShowSchoolEventForm(false); resetSchoolEventForm()
  }

  // 기간 수정 (학생/선생님용)
  const openEditEvent = (event: any) => {
    setShowDatePopup(false)
    setEditingEvent(event)
    setEditStartDate(event.date)
    setEditEndDate(event.end_date || '')
    setEditDateType(event.end_date ? 'range' : 'single')
    setShowEditEvent(true)
  }

  const submitEditEvent = async () => {
    if (!user || !editingEvent || !editStartDate) { showToast('날짜를 입력해주세요!', 'error'); return }
    if (editDateType === 'range' && !editEndDate) { showToast('종료 날짜를 입력해주세요!', 'error'); return }
    const endDate = editDateType === 'range' ? editEndDate : null
    const { error } = await supabase.from('user_calendar')
      .update({ assigned_date: editStartDate, end_date: endDate })
      .eq('user_id', user.id).eq('post_id', editingEvent.id)
    if (error) { showToast(error.message, 'error'); return }
    const endExclusive = endDate ? (() => { const d = new Date(endDate); d.setDate(d.getDate()+1); return d.toISOString().split('T')[0] })() : undefined
    setEvents(prev => prev.map(e => e.id === editingEvent.id ? { ...e, date: editStartDate, start: editStartDate, end: endExclusive } : e))
    setSelectedDateEvents(prev => prev.map(e => e.id === editingEvent.id ? { ...e, date: editStartDate } : e))
    setShowEditEvent(false); setEditingEvent(null); setEditStartDate(''); setEditEndDate(''); setEditDateType('single')
  }

  const deleteEvent = async (eventId: string, isSchoolEvent: boolean, isPersonal = false) => {
    if (!user) return
    if (isPersonal) {
      if (!confirm('개인 일정을 삭제할까요?')) return
      await supabase.from('user_calendar').delete().eq('id', eventId).eq('user_id', user.id)
    } else if (isSchoolEvent) {
      if (!confirm('이 학교 일정을 삭제할까요? 모든 학생의 캘린더에서 삭제됩니다.')) return
      await supabase.from('user_calendar').delete().eq('post_id', eventId)
      await supabase.from('posts').update({ status: 'rejected' }).eq('id', eventId)
    } else {
      if (!confirm('이 일정을 삭제할까요?')) return
      await supabase.from('user_calendar').delete().eq('user_id', user.id).eq('post_id', eventId)
    }
    setEvents(prev=>prev.filter(e=>e.id!==eventId)); setSelectedDateEvents(prev=>prev.filter(e=>e.id!==eventId))
  }

  const acceptNotification = (notif: any) => {
    const hasRange = !!notif.posts.end_date
    setPendingPostId(notif.posts.id); pendingPostTitleRef.current=notif.posts.title
    pendingNotifIdRef.current=notif.id; pendingDefaultDateRef.current=notif.posts.default_date
    pendingEndDateRef.current=notif.posts.end_date||null
    setPickerDate(notif.posts.default_date||'')
    setPickerEndDate(notif.posts.end_date||'')
    setPickerDateType(hasRange ? 'range' : 'single')
    setShowNotifications(false); setShowDatePicker(true)
  }

  const confirmDatePicker = async () => {
    if (!user || !pickerDate) { showToast('날짜를 선택해주세요!', 'error'); return }
    if (pickerDateType === 'range' && !pickerEndDate) { showToast('종료 날짜를 선택해주세요!', 'error'); return }
    const endDate = pickerDateType === 'range' ? pickerEndDate : null
    const { error } = await supabase.from('user_calendar')
      .upsert({ user_id:user.id, post_id:pendingPostId!, assigned_date:pickerDate, end_date:endDate }, { onConflict:'user_id,post_id' })
    if (error) { showToast(error.message, 'error'); return }
    if (pendingNotifIdRef.current)
      await supabase.from('notifications').update({ status:'accepted', is_read:true }).eq('id', pendingNotifIdRef.current)
    setNotifications(prev=>prev.filter(n=>n.id!==pendingNotifIdRef.current))
    setPendingPostId(null); pendingPostTitleRef.current=null; pendingNotifIdRef.current=null; pendingDefaultDateRef.current=null; pendingEndDateRef.current=null
    setShowDatePicker(false); setPickerDate(''); setPickerEndDate(''); setPickerDateType('single')
  }

  const cancelDatePicker = () => {
    setPendingPostId(null); pendingPostTitleRef.current=null; pendingNotifIdRef.current=null; pendingDefaultDateRef.current=null; pendingEndDateRef.current=null
    setShowDatePicker(false); setPickerDate(''); setPickerEndDate(''); setPickerDateType('single')
  }

  const holdNotification = async (notif: any) => {
    await supabase.from('notifications').update({ status:'held' }).eq('id',notif.id)
    setNotifications(prev=>prev.map(n=>n.id===notif.id?{...n,status:'held'}:n))
    setNotifTab('held')
  }

  const dismissNotification = async (notif: any) => {
    await supabase.from('notifications').update({ status:'dismissed', is_read:true }).eq('id',notif.id)
    await supabase.from('user_actions').insert({ user_id:user.id, post_id:notif.posts.id, action:'dismissed' })
    setNotifications(prev=>prev.filter(n=>n.id!==notif.id))
  }

  const approvePost = async (postId: string) => {
    const { error } = await supabase.from('posts').update({ status:'approved' }).eq('id',postId)
    if (error) { showToast(error.message, 'error'); return }
    setPendingPosts(prev=>prev.filter(p=>p.id!==postId))
  }
  const rejectPost = async (postId: string) => {
    await supabase.from('posts').update({ status:'rejected' }).eq('id',postId)
    setPendingPosts(prev=>prev.filter(p=>p.id!==postId))
  }

  // ── 파생 상태 ──────────────────────────────────────────────────
  const displayName         = user?.user_metadata?.full_name?.split(' ')[0] ?? ''
  const activeNotifications = notifications.filter(n=>n.status==='pending')
  const heldNotifications   = notifications.filter(n=>n.status==='held')
  const badgeCount          = activeNotifications.length // 보류 제외

  const overlayClass = "fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end justify-center z-50 animate-fade-in"
  const sheetClass   = "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-t-2xl p-5 w-full max-w-lg animate-slide-up"
  const LOGIN_REQUIRED = "로그인 후 이용할 수 있어요"

  const CATEGORY_BADGE: Record<string,string> = {
    '수행평가':'bg-blue-100 text-blue-700','학교행사':'bg-green-100 text-green-700',
    '휴일':'bg-red-100 text-red-600','기타':'bg-purple-100 text-purple-700','개인':'bg-yellow-100 text-yellow-700',
  }

  const HoverTooltipUI = hoverTooltip ? (
    <div className="fixed z-[300] pointer-events-none animate-fade-in"
      style={{
        left: Math.min(hoverTooltip.x + 4, (typeof window !== 'undefined' ? window.innerWidth : 600) - 232),
        top: hoverTooltip.y,
        transform: 'translateY(-100%) translateY(-8px)',
      }}>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 w-56 flex flex-col gap-2">
        {hoverTooltip.items.map((ev, i) => (
          <div key={i} className={i > 0 ? 'pt-2 border-t border-gray-100 dark:border-gray-800' : ''}>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${CATEGORY_BADGE[ev.category] ?? 'bg-gray-100 text-gray-600'}`}>
              {ev.category}
            </span>
            <div className="flex items-center gap-1 flex-wrap mt-0.5">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {(ev.title||'').replace(/^\[\d학년\] /,'')}
              </p>
              {ev.grade && <span className="text-xs text-gray-400">({ev.grade}학년)</span>}
            </div>
            {ev.content && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ev.content}</p>}
          </div>
        ))}
      </div>
    </div>
  ) : null

  const holidayDates = new Set(
    events.filter(e => e.category === '휴일' || e.isHoliday).map(e => e.date)
  )

  const toastColors = {
    success: 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900',
    error:   'bg-red-500 text-white',
    info:    'bg-blue-500 text-white',
  }

  const ToastUI = toast ? (
    <div className={`fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-2xl shadow-xl text-sm font-medium toast-in max-w-xs w-max ${toastColors[toast.type]}`}>
      {toast.type === 'success' && '✅ '}{toast.type === 'error' && '⚠️ '}{toast.type === 'info' && 'ℹ️ '}
      {toast.msg}
    </div>
  ) : null

  // ── 선생님 본인 선택 화면 ──────────────────────────────────────
  if (user && isTeacher && showTeacherPicker) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-4 py-10 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-1">👩‍🏫 본인 확인</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">목록에서 본인이 누구인지 선택해주세요</p>
        {teachers.length === 0
          ? <p className="text-sm text-gray-400 text-center mt-16">등록된 선생님이 없어요.<br/>관리자에게 문의해주세요.</p>
          : <div className="flex flex-col gap-2">
              {teachers.map(t => (
                <button key={t.id} onClick={() => selectMyTeacher(t)}
                  className="btn w-full p-4 border border-gray-200 dark:border-gray-700 rounded-xl text-left flex items-center justify-between hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                  <div>
                    <p className="font-semibold">{t.name} 선생님</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t.subject} · 📍 {t.location}</p>
                  </div>
                  <span className="text-blue-400 text-lg">→</span>
                </button>
              ))}
            </div>
        }
      </div>
    )
  }

  // ── 학년 선택 화면 ────────────────────────────────────────────
  if (user && showGradePicker) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-6 bg-white dark:bg-gray-950">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📅 학교 캘린더</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">학년을 선택해주세요</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {[1,2,3].map(g => (
            <button key={g} onClick={() => selectGrade(g)}
              className="btn py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-lg font-bold shadow-md shadow-blue-200 dark:shadow-blue-900/30">
              {g}학년
            </button>
          ))}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <span className="text-xs text-gray-400 dark:text-gray-500">또는</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>
          <button onClick={() => { setShowTeacherAuth(true); setTeacherAuthPw(''); setTeacherAuthError('') }}
            className="btn py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-lg font-bold shadow-md shadow-emerald-200 dark:shadow-emerald-900/30">
            👩‍🏫 선생님
          </button>
        </div>

        {/* 비밀번호 입력 모달 */}
        {showTeacherAuth && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in px-6">
            <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-2xl p-6 w-full max-w-xs animate-pop-in">
              <h3 className="font-bold text-base mb-1">👩‍🏫 선생님 인증</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">공동 비밀번호를 입력해주세요</p>
              <input
                type="password"
                placeholder="비밀번호"
                value={teacherAuthPw}
                onChange={e => { setTeacherAuthPw(e.target.value); setTeacherAuthError('') }}
                onKeyDown={e => e.key === 'Enter' && confirmTeacherAuth()}
                className={`${INPUT} mb-2`}
              />
              {teacherAuthError && <p className="text-xs text-red-500 mb-2">{teacherAuthError}</p>}
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setShowTeacherAuth(false); setTeacherAuthPw(''); setTeacherAuthError('') }}
                  className={BTN_GRAY}>취소</button>
                <button onClick={confirmTeacherAuth} className={BTN_BLUE}>확인</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {ToastUI}
      {HoverTooltipUI}

      {/* 튜토리얼 오버레이 */}
      {showTutorial && user && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative mx-4 w-full max-w-sm animate-pop-in">
            {/* 단계 표시 */}
            <div className="flex justify-center gap-1.5 mb-4">
              {tutorialSteps.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === tutorialStep ? 'w-6 bg-blue-400' : i < tutorialStep ? 'w-1.5 bg-blue-300' : 'w-1.5 bg-white/30'}`} />
              ))}
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-2xl">
              <p className="text-2xl mb-2">{tutorialSteps[tutorialStep].title.split(' ')[0]}</p>
              <h3 className="text-lg font-bold mb-2">{tutorialSteps[tutorialStep].title.split(' ').slice(1).join(' ')}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{tutorialSteps[tutorialStep].desc}</p>

              <div className="flex gap-2 mt-6">
                {tutorialStep > 0 && (
                  <button onClick={() => setTutorialStep(s => s-1)}
                    className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-sm">
                    이전
                  </button>
                )}
                <button onClick={() => {
                  if (tutorialStep < tutorialSteps.length - 1) {
                    setTutorialStep(s => s+1)
                  } else {
                    setShowTutorial(false)
                    localStorage.setItem(`tutorial_done_${user.id}`, '1')
                  }
                }} className="btn flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium shadow-md shadow-blue-200 dark:shadow-blue-900/30">
                  {tutorialStep < tutorialSteps.length - 1 ? '다음 →' : '시작하기 🎉'}
                </button>
              </div>

              {tutorialStep < tutorialSteps.length - 1 && (
                <button onClick={() => {
                  setShowTutorial(false)
                  localStorage.setItem(`tutorial_done_${user.id}`, '1')
                }} className="w-full mt-2 text-xs text-gray-400 dark:text-gray-500 text-center py-1">
                  건너뛰기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* iOS 설치 안내 */}
      {showIOSInstall && (
        <div className="fixed bottom-20 md:bottom-6 left-0 right-0 z-[90] px-4 flex justify-center animate-slide-up">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-4 w-full max-w-sm">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <img src="/favicon.png" alt="icon" className="w-10 h-10 rounded-xl" />
                <div>
                  <p className="text-sm font-bold">클래스톡 설치</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">홈 화면에 추가하기</p>
                </div>
              </div>
              <button onClick={() => setShowIOSInstall(false)} className="text-gray-400 text-lg leading-none">×</button>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              아래 <span className="font-bold text-blue-500">공유 버튼 □↑</span>을 탭한 후<br/>
              <span className="font-bold">"홈 화면에 추가"</span>를 선택해주세요
            </div>
            {/* iOS 화살표 */}
            <div className="flex justify-center mt-2">
              <p className="text-2xl animate-bounce">↓</p>
            </div>
          </div>
        </div>
      )}

      {/* PWA 설치 배너 (Android/Chrome) */}
      {showInstallBanner && (
        <div className="fixed bottom-20 md:bottom-6 left-0 right-0 z-[90] px-4 flex justify-center animate-slide-up">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl p-4 flex items-center gap-3 w-full max-w-sm">
            <img src="/favicon.png" alt="icon" className="w-12 h-12 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">클래스톡 설치</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">홈 화면에 추가해서 앱처럼 사용해요</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setShowInstallBanner(false)}
                className="text-xs text-gray-400 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                나중에
              </button>
              <button onClick={handleInstall}
                className="btn text-xs px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium shadow-sm">
                설치
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ? 도움말 버튼 (로그인 후에만) */}
      {user && !showTutorial && (
        <button onClick={() => { setTutorialStep(0); setShowTutorial(true) }}
          className="fixed right-4 bottom-20 md:bottom-8 z-[80] w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-lg font-bold btn">
          ?
        </button>
      )}

      {!user ? (
        <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
          {/* 헤더 */}
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between max-w-5xl mx-auto">
            <div>
              <h1 className="text-base font-bold">📅 학교 캘린더</h1>
              <p className="text-xs text-gray-400 dark:text-gray-500">로그인하면 더 많은 기능을 이용할 수 있어요</p>
            </div>
            <button onClick={login} className="btn px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-200 dark:shadow-blue-900/30 whitespace-nowrap">
              로그인
            </button>
          </div>

          <div className="max-w-5xl mx-auto flex flex-col md:flex-row">
            {/* 왼쪽: 탭 */}
            <div className="md:w-64 md:border-r md:border-gray-200 md:dark:border-gray-700 md:min-h-screen md:p-3">
              <div className="hidden md:flex md:flex-col md:gap-1 md:mt-3">
                <button onClick={() => setActiveTab('calendar')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab==='calendar'?'bg-blue-50 dark:bg-blue-900/30 text-blue-500':'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                  <span className="text-lg">📅</span>캘린더
                </button>
                <button onClick={() => setActiveTab('teacher')}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab==='teacher'?'bg-blue-50 dark:bg-blue-900/30 text-blue-500':'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                  <span className="text-lg">🏫</span>선생님 위치
                </button>
              </div>
            </div>

            {/* 메인 */}
            <div className="flex-1 pb-20 md:pb-6">
              {activeTab === 'calendar' && (
                <div className="px-3 py-4 md:px-6 md:py-6">
                  {/* 로그인 안내 배너 */}
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-3">
                    <span className="text-xl">🔒</span>
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">수행평가·기타 일정은 로그인 후 확인</p>
                      <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">학교 일정과 선생님 위치는 지금 바로 볼 수 있어요</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">학교행사</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">휴일</span>
                  </div>
                  <Calendar
                    events={events}
                    onDateClick={(date) => {
                      const dayEvents = events.filter(e => e.date === date)
                      setSelectedDate(date)
                      setSelectedDateEvents(dayEvents)
                      setShowDatePopup(true)
                    }}
                    onCellHover={handleCellHover}
                    holidayDates={holidayDates}
                    pendingPostId={null}
                  />
                </div>
              )}

              {activeTab === 'teacher' && (
                <div className="flex flex-col">
                  {/* 로그인 안내 배너 */}
                  <div className="mx-3 mt-4 mb-3 md:mx-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-3">
                    <span className="text-xl">💬</span>
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">메시지는 로그인 후 이용 가능해요</p>
                      <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">선생님 위치는 지금 바로 확인할 수 있어요</p>
                    </div>
                  </div>
                  {teachers.length === 0
                    ? <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400 dark:text-gray-500">
                        <p className="text-4xl">🏫</p>
                        <p className="text-sm">등록된 선생님이 없어요</p>
                      </div>
                    : <div className="flex flex-col">
                        {Object.entries(teachers.reduce((acc, t) => {
                          if (!acc[t.subject]) acc[t.subject] = []
                          acc[t.subject].push(t); return acc
                        }, {} as Record<string, any[]>)).map(([subject, list]) => {
                          const isOpen = openSubjects.has(subject)
                          return (
                            <div key={subject} className="border-b border-gray-200 dark:border-gray-700">
                              <button onClick={() => toggleSubject(subject)}
                                className="w-full flex items-center justify-between px-4 py-3.5 bg-gray-50 dark:bg-gray-800/50 transition-colors">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{subject}</p>
                                  <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 rounded-full px-1.5 py-0.5">{(list as any[]).length}명</span>
                                </div>
                                <span className={`text-gray-400 text-xs transition-transform duration-200 ${isOpen?'rotate-180':''}`}>▼</span>
                              </button>
                              {isOpen && (
                                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                  {(list as any[]).map(t => (
                                    <div key={t.id} className="px-4 py-4 flex items-center justify-between bg-white dark:bg-gray-950">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <p className="text-base font-semibold">{t.name} 선생님</p>
                                          {t.user_id && <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">인증됨</span>}
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">📍 {t.location}</p>
                                      </div>
                                      {t.user_id && (
                                        <button onClick={() => showToast('로그인 후 이용할 수 있어요 😊', 'info')}
                                          className="btn text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-500 rounded-lg">
                                          💬 메시지
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                  }
                </div>
              )}
            </div>
          </div>

          {/* 모바일 하단 탭 */}
          <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex md:hidden">
            <button onClick={() => setActiveTab('calendar')}
              className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs ${activeTab==='calendar'?'text-blue-500':'text-gray-400 dark:text-gray-500'}`}>
              <span className="text-xl">📅</span>캘린더
            </button>
            <button onClick={() => setActiveTab('teacher')}
              className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs ${activeTab==='teacher'?'text-blue-500':'text-gray-400 dark:text-gray-500'}`}>
              <span className="text-xl">🏫</span>선생님 위치
            </button>
          </div>

          {/* 날짜 클릭 팝업 (비로그인) */}
          {!user && showDatePopup && selectedDate && (
            <div className={overlayClass}>
              <div className={`${sheetClass} max-h-[75vh] overflow-y-auto`}>
                <h3 className="font-bold text-base mb-3">📅 {selectedDate}</h3>
                {selectedDateEvents.length === 0
                  ? <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">이날 학교 일정이 없어요</p>
                  : <div className="mb-3 flex flex-col gap-2">
                      {selectedDateEvents.map(event => (
                        <div key={event.id} className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${getCategoryBadge(event.category)}`}>{event.category}</span>
                          <p className="font-medium text-sm mt-0.5">{event.title}</p>
                          {event.content && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{event.content}</p>}
                        </div>
                      ))}
                    </div>
                }
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl mb-3">
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">🔒 수행평가·기타 일정</p>
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">로그인 후 확인할 수 있어요</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowDatePopup(false)} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-sm">닫기</button>
                  <button onClick={login} className="btn flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium">로그인</button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col md:flex-row min-h-screen max-w-5xl mx-auto">

          {/* 사이드바 / 헤더 */}
          <div className="md:w-64 md:border-r md:border-gray-200 md:dark:border-gray-700 md:min-h-screen md:flex md:flex-col md:shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 md:flex-col md:items-start md:gap-3 md:py-6">
              <div>
                <p className="text-sm font-bold truncate">{displayName}</p>
                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                  {userGrade && <span className="text-xs text-gray-400 dark:text-gray-500">{userGrade}학년</span>}
                  {isAdmin   && <span className="text-xs text-blue-500 font-medium">(관리자)</span>}
                  {isTeacher && myTeacherRow && <span className="text-xs text-emerald-500 font-medium">👩‍🏫 {myTeacherRow.name} 선생님</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 md:w-full">
                {/* 알림 버튼 - badgeCount는 active만 */}
                <button onClick={() => setShowNotifications(true)}
                  className="btn relative px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm md:flex-1 md:text-center whitespace-nowrap">
                  🔔<span className="hidden md:inline ml-1 text-xs">알림</span>
                  {badgeCount > 0 && (
                    <span className="badge-pulse absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                      {badgeCount}
                    </span>
                  )}
                </button>
                {/* 선생님 수신함 버튼 */}
                {isTeacher && (
                  <button onClick={() => setShowMsgInbox(true)}
                    className="btn relative px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm md:flex-1 md:text-center whitespace-nowrap">
                    💬<span className="hidden md:inline ml-1 text-xs">수신함</span>
                    {myMessages.filter(m => !m.reply).length > 0 && (
                      <span className="badge-pulse absolute -top-1 -right-1 bg-emerald-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                        {myMessages.filter(m => !m.reply).length}
                      </span>
                    )}
                  </button>
                )}
                {/* 학생 + 관리자: 보낸 메시지 버튼 */}
                {!isTeacher && (
                  <button onClick={openSentMessages}
                    className="btn relative px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm md:flex-1 md:text-center whitespace-nowrap">
                    💬<span className="hidden md:inline ml-1 text-xs">메시지</span>
                    {sentMessages.filter(m => m.reply && !m.reply_read).length > 0 && (
                      <span className="badge-pulse absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                        {sentMessages.filter(m => m.reply && !m.reply_read).length}
                      </span>
                    )}
                  </button>
                )}
                <button onClick={logout} className="btn px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm md:flex-1 md:text-center whitespace-nowrap">로그아웃</button>
              </div>
            </div>

            {/* PC 사이드 탭 */}
            <div className="hidden md:flex md:flex-col md:p-3 md:gap-1">
              {(['calendar','teacher'] as Tab[]).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab===tab ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-500' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                  <span className="text-lg">{tab==='calendar'?'📅':'🏫'}</span>
                  {tab==='calendar'?'캘린더':'선생님 위치'}
                </button>
              ))}
            </div>
          </div>

          {/* 메인 */}
          <div className="flex-1 flex flex-col min-h-screen md:min-h-0">
            <div className="flex-1 overflow-y-auto pb-20 md:pb-6">

              {/* 캘린더 탭 */}
              {activeTab === 'calendar' && (
                <div className="px-3 py-4 md:px-6 md:py-6">

                  {/* 관리자 패널 */}
                  {isAdmin && (
                    <div className="mb-4 p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-bold">🛠 관리자</h2>
                        <div className="flex gap-2">
                          <button onClick={() => { setShowNoticeManager(true); loadAllNoticesForAdmin() }}
                            className="btn px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-xs font-medium shadow-sm">
                            📢 공지 관리
                          </button>
                          <button onClick={() => setShowSchoolEventForm(true)}
                            className="btn px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium shadow-sm">
                            + 학교 일정
                          </button>
                        </div>
                      </div>

                      {/* 메시지 승인 대기 */}
                      {pendingMessages.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-orange-500 mb-1.5">💬 메시지 승인 대기 ({pendingMessages.length})</p>
                          {pendingMessages.map(m => (
                            <div key={m.id} className="p-2.5 border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 mt-2 rounded-xl">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                <span className="font-semibold text-gray-800 dark:text-gray-200">{m.senderName}</span>
                                {' → '}
                                <span className="font-semibold text-gray-800 dark:text-gray-200">{m.teachers?.name} 선생님</span>
                                <span className="text-gray-400"> ({m.teachers?.subject})</span>
                              </p>
                              <p className="text-sm">{m.content}</p>
                              <div className="flex gap-2 mt-2">
                                <button onClick={() => approveMessage(m.id)} className="btn flex-1 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm shadow-sm">승인</button>
                                <button onClick={() => rejectMessage(m.id)}  className="btn flex-1 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm shadow-sm">거절</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 일정 승인 대기 */}
                      <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">📋 일정 승인 대기</p>
                      {pendingPosts.length === 0
                        ? <p className="text-xs text-gray-400 dark:text-gray-500">대기 중인 일정이 없어요</p>
                        : pendingPosts.map(post => (
                          <div key={post.id} className="p-2 border border-gray-200 dark:border-gray-700 mt-2 rounded-lg">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${getCategoryBadge(post.category)}`}>{post.category}</span>
                              <span className="text-xs text-gray-400 dark:text-gray-500">{post.grade}학년</span>
                            </div>
                            <p className="font-medium text-sm">{post.title}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{post.content}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">날짜: {post.default_date}</p>
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => approvePost(post.id)} className="btn flex-1 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm shadow-sm">승인</button>
                              <button onClick={() => rejectPost(post.id)}  className="btn flex-1 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm shadow-sm">거절</button>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  )}

                  <div className="flex gap-2 mb-3 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">수행평가</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">학교행사</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">휴일</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">기타</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300">🔒 개인</span>
                  </div>
                  <Calendar events={events} onDateClick={handleDateClick} onCellHover={handleCellHover} holidayDates={holidayDates} pendingPostId={pendingPostId} />
                </div>
              )}

              {/* 선생님 위치 탭 */}
              {activeTab === 'teacher' && (
                <div className="flex flex-col">
                  {isAdmin && (
                    <div className="px-3 pt-4 pb-3 md:px-6">
                      <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-xl flex items-center justify-between bg-white dark:bg-gray-900">
                        <h2 className="text-base font-bold">🛠 관리자</h2>
                        <button onClick={openAddTeacher}
                          className="btn px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium shadow-sm">
                          + 선생님 추가
                        </button>
                      </div>
                    </div>
                  )}

                  {teachers.length === 0
                    ? <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400 dark:text-gray-500">
                        <p className="text-4xl">🏫</p>
                        <p className="text-sm">등록된 선생님이 없어요</p>
                      </div>
                    : <div className="flex flex-col">
                        {Object.entries(teachersBySubject).map(([subject, list]) => {
                          const isOpen = openSubjects.has(subject)
                          return (
                            <div key={subject} className="border-b border-gray-200 dark:border-gray-700">
                              <button onClick={() => toggleSubject(subject)}
                                className="w-full flex items-center justify-between px-4 py-3.5 bg-gray-50 dark:bg-gray-800/50 active:bg-gray-100 dark:active:bg-gray-800 transition-colors">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{subject}</p>
                                  <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 rounded-full px-1.5 py-0.5">
                                    {(list as any[]).length}명
                                  </span>
                                </div>
                                <span className={`text-gray-400 text-xs transition-transform duration-200 ${isOpen?'rotate-180':''}`}>▼</span>
                              </button>

                              {isOpen && (
                                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                  {(list as any[]).map(t => (
                                    <div key={t.id} className="px-4 py-4 flex items-center justify-between bg-white dark:bg-gray-950">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <p className="text-base font-semibold">{t.name} 선생님</p>
                                          {t.user_id && (
                                            <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">인증됨</span>
                                          )}
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">📍 {t.location}</p>
                                      </div>
                                      <div className="flex gap-2 shrink-0">
                                        {/* 인증된 선생님에게만 메시지 가능, 본인 제외 */}
                                        {t.user_id && !(isTeacher && myTeacherRow?.id === t.id) && (
                                          <button onClick={() => openMsgForm(t)}
                                            className="btn text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-500 rounded-lg">
                                            💬 메시지
                                          </button>
                                        )}
                                        {isAdmin && (
                                          <>
                                            <button onClick={() => openEditTeacher(t)}
                                              className="btn text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-500 rounded-lg">수정</button>
                                            <button onClick={() => deleteTeacher(t.id)}
                                              className="btn text-xs px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-400 rounded-lg">삭제</button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                  }
                </div>
              )}
            </div>

            {/* 모바일 하단 탭 */}
            <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex md:hidden">
              {(['calendar','teacher'] as Tab[]).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs ${activeTab===tab?'text-blue-500':'text-gray-400 dark:text-gray-500'}`}>
                  <span className="text-xl">{tab==='calendar'?'📅':'🏫'}</span>
                  {tab==='calendar'?'캘린더':'선생님 위치'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ──────────── 팝업들 ──────────── */}

      {/* 메시지 보내기 */}
      {showMsgForm && msgTarget && (
        <div className={overlayClass}>
          <div className={sheetClass}>
            <h3 className="font-bold text-base mb-1">💬 메시지 보내기</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{msgTarget.name} 선생님 ({msgTarget.subject})</p>
            <div className="flex items-start gap-2 p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-xl mb-4">
              <span className="text-sm">💬</span>
              <p className="text-xs text-orange-600 dark:text-orange-400">
                욕설, 비하·비방하는 말은 사용하지 말아주세요
              </p>
            </div>
            <textarea placeholder="선생님께 전할 내용을 입력해주세요" value={msgContent}
              onChange={e=>setMsgContent(e.target.value)} className={`${INPUT} mb-4`} rows={4} />
            <div className="flex gap-2">
              <button onClick={()=>{setShowMsgForm(false);setMsgContent('')}} className={BTN_GRAY}>취소</button>
              <button onClick={submitMessage} className={BTN_BLUE}>전송</button>
            </div>
          </div>
        </div>
      )}

      {/* 선생님 수신함 */}
      {showMsgInbox && (
        <div className={overlayClass}>
          <div className={`${sheetClass} max-h-[75vh] overflow-y-auto`}>
            <h3 className="font-bold text-base mb-3">💬 수신된 메시지</h3>

            {/* 탭 */}
            <div className="flex border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-4">
              <button onClick={() => setInboxTab('unread')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${inboxTab==='unread' ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                미답장 {myMessages.filter(m=>!m.reply).length > 0 && `(${myMessages.filter(m=>!m.reply).length})`}
              </button>
              <button onClick={() => setInboxTab('replied')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${inboxTab==='replied' ? 'bg-gray-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                답장 완료 {myMessages.filter(m=>m.reply).length > 0 && `(${myMessages.filter(m=>m.reply).length})`}
              </button>
            </div>

            {/* 미답장 탭 */}
            {inboxTab === 'unread' && (
              myMessages.filter(m=>!m.reply).length === 0
                ? <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">미답장 메시지가 없어요</p>
                : <div className="flex flex-col gap-3">
                    {myMessages.filter(m=>!m.reply).map(m => (
                      <div key={m.id} className="card-hover p-3 border border-gray-200 dark:border-gray-700 rounded-xl">
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                          {m.senderName} · {new Date(m.created_at).toLocaleDateString('ko-KR', { month:'long', day:'numeric', weekday:'short' })}
                        </p>
                        <p className="text-sm mb-2">{m.content}</p>
                        <button onClick={() => openReplyForm(m)}
                          className="btn text-xs px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                          ↩ 답장하기
                        </button>
                      </div>
                    ))}
                  </div>
            )}

            {/* 답장 완료 탭 */}
            {inboxTab === 'replied' && (
              myMessages.filter(m=>m.reply).length === 0
                ? <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">답장한 메시지가 없어요</p>
                : <div className="flex flex-col gap-3">
                    {myMessages.filter(m=>m.reply).map(m => (
                      <div key={m.id} className="card-hover p-3 border border-gray-200 dark:border-gray-700 rounded-xl">
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                          {m.senderName} · {new Date(m.created_at).toLocaleDateString('ko-KR', { month:'long', day:'numeric', weekday:'short' })}
                        </p>
                        <p className="text-sm mb-2">{m.content}</p>
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2 text-xs text-emerald-700 dark:text-emerald-400">
                          ↩ {m.reply}
                        </div>
                      </div>
                    ))}
                  </div>
            )}

            <button onClick={()=>setShowMsgInbox(false)}
              className="mt-4 w-full py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-sm">닫기</button>
          </div>
        </div>
      )}

      {/* 답장 폼 */}
      {showReplyForm && replyTarget && (
        <div className={overlayClass}>
          <div className={sheetClass}>
            <h3 className="font-bold text-base mb-1">↩ 답장하기</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{replyTarget.senderName}에게</p>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 mb-4">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">원본 메시지</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{replyTarget.content}</p>
            </div>
            <textarea placeholder="답장 내용을 입력해주세요" value={replyContent}
              onChange={e=>setReplyContent(e.target.value)} className={`${INPUT} mb-4`} rows={4} />
            <div className="flex gap-2">
              <button onClick={()=>{setShowReplyForm(false);setReplyContent('')}} className={BTN_GRAY}>취소</button>
              <button onClick={submitReply} className={BTN_BLUE}>전송</button>
            </div>
          </div>
        </div>
      )}

      {/* 학생/관리자 보낸 메시지함 */}
      {showSentMessages && (
        <div className={overlayClass}>
          <div className={`${sheetClass} max-h-[75vh] overflow-y-auto`}>
            <h3 className="font-bold text-base mb-4">💬 보낸 메시지</h3>
            {sentMessages.length === 0
              ? <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">보낸 메시지가 없어요</p>
              : <>
                  <div className="flex flex-col gap-3">
                    {sentMessages.slice(0, sentPage * PAGE_SIZE).map(m => (
                      <div key={m.id} className="card-hover p-3 border border-gray-200 dark:border-gray-700 rounded-xl">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {m.teachers?.name} 선생님 ({m.teachers?.subject}) · {new Date(m.created_at).toLocaleDateString('ko-KR', { month:'long', day:'numeric', weekday:'short' })}
                          </p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            m.status === 'approved' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                            m.status === 'rejected' ? 'bg-red-100 text-red-500 dark:bg-red-900/30 dark:text-red-400' :
                            'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            {m.status === 'approved' ? '전달됨' : m.status === 'rejected' ? '거절됨' : '검토중'}
                          </span>
                        </div>
                        <p className="text-sm">{m.content}</p>
                        {m.reply && (
                          <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2">
                            <p className="text-xs text-blue-400 dark:text-blue-500 mb-0.5">↩ 선생님 답장</p>
                            <p className="text-sm text-blue-700 dark:text-blue-300">{m.reply}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {sentMessages.length > sentPage * PAGE_SIZE && (
                    <button onClick={() => setSentPage(p => p + 1)}
                      className="mt-3 w-full py-2.5 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-xl text-sm">
                      더 보기 ({sentMessages.length - sentPage * PAGE_SIZE}개 남음)
                    </button>
                  )}
                </>
            }
            <button onClick={()=>{setShowSentMessages(false); setSentPage(1)}}
              className="mt-4 w-full py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-sm">닫기</button>
          </div>
        </div>
      )}

      {/* 선생님 추가/수정 */}
      {showTeacherForm && (
        <div className={overlayClass}>
          <div className={`${sheetClass} max-h-[85vh] overflow-y-auto`}>
            <h3 className="font-bold text-base mb-4">{editingTeacher?'✏️ 선생님 수정':'➕ 선생님 추가'}</h3>
            <div className="mb-3">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">과목</p>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map(s => (
                  <button key={s} onClick={() => setTeacherSubject(s)}
                    className={`btn px-3 py-1.5 rounded-xl text-xs border-2 transition-colors ${teacherSubject===s?'bg-blue-500 text-white border-blue-500':'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-3">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">선생님 성함</p>
              <input placeholder="예: 홍길동" value={teacherName} onChange={e=>setTeacherName(e.target.value)} className={INPUT} />
            </div>
            <div className="mb-5">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">교무실 위치</p>
              <input placeholder="예: 3층 국어 교무실" value={teacherLocation} onChange={e=>setTeacherLocation(e.target.value)} className={INPUT} />
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{setShowTeacherForm(false);resetTeacherForm()}} className={BTN_GRAY}>취소</button>
              <button onClick={submitTeacher} className={BTN_BLUE}>{editingTeacher?'수정':'추가'}</button>
            </div>
          </div>
        </div>
      )}

      {/* 학교 일정 추가/수정 */}
      {showSchoolEventForm && (
        <div className={overlayClass}>
          <div className={`${sheetClass} max-h-[80vh] overflow-y-auto`}>
            <h3 className="font-bold text-base mb-4">{editingSchoolEvent ? '✏️ 학교 일정 수정' : '📅 학교 일정 추가'}</h3>
            <div className="mb-3">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">종류</p>
              <div className="flex gap-2">
                {([{label:'🏫 학교행사', val:'학교행사'},{label:'🔴 휴일', val:'휴일'}] as const).map(({label,val})=>(
                  <button key={val} onClick={()=>setSchoolEventType(val)}
                    className={`flex-1 py-2 rounded-xl text-sm border-2 transition-colors ${schoolEventType===val?'bg-blue-500 text-white border-blue-500':'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <input placeholder="일정 제목" value={schoolEventTitle} onChange={e=>setSchoolEventTitle(e.target.value)} className={`${INPUT} mb-2`} />
            <textarea placeholder="내용 (선택)" value={schoolEventContent} onChange={e=>setSchoolEventContent(e.target.value)} className={`${INPUT} mb-2`} rows={2} />
            <div className="mb-2">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">기간</p>
              <div className="flex gap-2 mb-2">
                {([{label:'하루',val:'single'},{label:'기간',val:'range'}] as const).map(({label,val})=>(
                  <button key={val} onClick={()=>{ setSchoolEventDateType(val); if(val==='single') setSchoolEventEndDate('') }}
                    className={`flex-1 py-2 rounded-xl text-sm border-2 transition-colors ${schoolEventDateType===val?'bg-blue-500 text-white border-blue-500':'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <input type="date" value={schoolEventDate} onChange={e=>setSchoolEventDate(e.target.value)} className={INPUT} />
              {schoolEventDateType === 'range' && (
                <div className="mt-2">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">종료 날짜</p>
                  <input type="date" value={schoolEventEndDate} onChange={e=>setSchoolEventEndDate(e.target.value)}
                    min={schoolEventDate} className={INPUT} />
                </div>
              )}
            </div>
            <div className="mb-4">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">대상 학년</p>
              <div className="flex gap-2">
                {[{label:'전체',val:null},{label:'1학년',val:1},{label:'2학년',val:2},{label:'3학년',val:3}].map(({label,val})=>(
                  <button key={label} onClick={()=>setSchoolEventGrade(val)}
                    className={`flex-1 py-2 rounded-xl text-sm border-2 transition-colors ${schoolEventGrade===val?'bg-blue-500 text-white border-blue-500':'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={()=>{ setShowSchoolEventForm(false); resetSchoolEventForm() }} className={BTN_GRAY}>취소</button>
              <button onClick={editingSchoolEvent ? updateSchoolEvent : submitSchoolEvent} className={BTN_GREEN}>
                {editingSchoolEvent ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 기간 수정 팝업 (학생/선생님용) */}
      {showEditEvent && editingEvent && (
        <div className={overlayClass}>
          <div className={sheetClass}>
            <h3 className="font-bold text-base mb-1">✏️ 기간 수정</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 truncate">{editingEvent.title}</p>
            <div className="mb-3">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">기간</p>
              <div className="flex gap-2 mb-3">
                {([{label:'하루',val:'single'},{label:'기간',val:'range'}] as const).map(({label,val})=>(
                  <button key={val} onClick={()=>{ setEditDateType(val); if(val==='single') setEditEndDate('') }}
                    className={`flex-1 py-2 rounded-xl text-sm border-2 transition-colors ${editDateType===val?'bg-blue-500 text-white border-blue-500':'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">시작 날짜</p>
              <input type="date" value={editStartDate} onChange={e=>setEditStartDate(e.target.value)} className={INPUT} />
              {editDateType === 'range' && (
                <div className="mt-2">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">종료 날짜</p>
                  <input type="date" value={editEndDate} onChange={e=>setEditEndDate(e.target.value)}
                    min={editStartDate} className={INPUT} />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setShowEditEvent(false)} className={BTN_GRAY}>취소</button>
              <button onClick={submitEditEvent} className={BTN_BLUE}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 알림 */}
      {showNotifications && (
        <div className={overlayClass}>
          <div className={`${sheetClass} max-h-[75vh] overflow-y-auto`}>
            <h3 className="font-bold text-base mb-3">🔔 알림</h3>
            <div className="flex border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-4">
              <button onClick={()=>setNotifTab('active')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${notifTab==='active'?'bg-blue-500 text-white':'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                새 알림{activeNotifications.length>0&&` (${activeNotifications.length})`}
              </button>
              <button onClick={()=>setNotifTab('held')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${notifTab==='held'?'bg-yellow-400 text-white':'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                보류{heldNotifications.length>0&&` (${heldNotifications.length})`}
              </button>
            </div>

            {notifTab==='active' && (
              activeNotifications.length===0
                ? <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">새 알림이 없어요</p>
                : activeNotifications.map(notif => (
                  <div key={notif.id} className="card-hover p-3 border border-gray-200 dark:border-gray-700 rounded-xl mt-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${getCategoryBadge(notif.posts.category)}`}>{notif.posts.category}</span>
                    <p className="font-medium text-sm mt-1">{notif.posts.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{notif.posts.content}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">기본 날짜: {notif.posts.default_date}{notif.posts.end_date ? ` ~ ${notif.posts.end_date}` : ''}</p>
                    <div className="flex flex-col gap-1.5 mt-2">
                      <button onClick={()=>acceptNotification(notif)} className="btn w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium shadow-sm">📅 일정에 추가</button>
                      <div className="flex gap-1.5">
                        <button onClick={()=>holdNotification(notif)} className="flex-1 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-lg text-sm">⏸ 보류</button>
                        <button onClick={()=>dismissNotification(notif)} className="flex-1 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm">✕ 수락 안 함</button>
                      </div>
                    </div>
                  </div>
                ))
            )}

            {notifTab==='held' && (
              heldNotifications.length===0
                ? <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">보류된 알림이 없어요</p>
                : heldNotifications.map(notif => (
                  <div key={notif.id} className="card-hover p-3 border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl mt-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${getCategoryBadge(notif.posts.category)}`}>{notif.posts.category}</span>
                    <p className="font-medium text-sm mt-1">{notif.posts.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{notif.posts.content}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">기본 날짜: {notif.posts.default_date}{notif.posts.end_date ? ` ~ ${notif.posts.end_date}` : ''}</p>
                    <div className="flex flex-col gap-1.5 mt-2">
                      <button onClick={()=>acceptNotification(notif)} className="btn w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium shadow-sm">📅 일정에 추가</button>
                      <button onClick={()=>dismissNotification(notif)} className="w-full py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm">✕ 수락 안 함</button>
                    </div>
                  </div>
                ))
            )}

            <button onClick={()=>setShowNotifications(false)}
              className="mt-4 w-full py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-sm">닫기</button>
          </div>
        </div>
      )}

      {/* 날짜 선택 */}
      {showDatePicker && (
        <div className={overlayClass}>
          <div className={sheetClass}>
            <h3 className="font-bold text-base mb-1">📅 날짜 선택</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 truncate">"{pendingPostTitleRef.current}"</p>

            {/* 하루/기간 선택 */}
            <div className="mb-3">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">기간</p>
              <div className="flex gap-2">
                {([{label:'하루',val:'single'},{label:'기간',val:'range'}] as const).map(({label,val})=>(
                  <button key={val} onClick={()=>{ setPickerDateType(val); if(val==='single') setPickerEndDate('') }}
                    className={`flex-1 py-2 rounded-xl text-sm border-2 transition-colors ${pickerDateType===val?'bg-blue-500 text-white border-blue-500':'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 추천 날짜 */}
            {pendingDefaultDateRef.current && (
              <div className="mb-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">추천 날짜</p>
                <button onClick={()=>{
                  setPickerDate(pendingDefaultDateRef.current!)
                  if (pickerDateType === 'range' && pendingEndDateRef.current)
                    setPickerEndDate(pendingEndDateRef.current)
                }}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${pickerDate===pendingDefaultDateRef.current?'bg-blue-500 text-white border-blue-500':'bg-white dark:bg-gray-800 text-blue-500 border-blue-300 dark:border-blue-700'}`}>
                  {pendingDefaultDateRef.current}
                  {pendingEndDateRef.current && pickerDateType === 'range' && ` ~ ${pendingEndDateRef.current}`}
                  {' (기본 날짜)'}
                </button>
              </div>
            )}

            <div className="mb-4">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">시작 날짜</p>
              <input type="date" value={pickerDate} onChange={e=>setPickerDate(e.target.value)} className={INPUT} />
              {pickerDateType === 'range' && (
                <div className="mt-2">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">종료 날짜</p>
                  <input type="date" value={pickerEndDate} onChange={e=>setPickerEndDate(e.target.value)}
                    min={pickerDate} className={INPUT} />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={cancelDatePicker} className={BTN_GRAY}>취소</button>
              <button onClick={confirmDatePicker} className={BTN_BLUE}>추가</button>
            </div>
          </div>
        </div>
      )}

      {/* 날짜 클릭 팝업 */}
      {showDatePopup && selectedDate && (
        <div className={overlayClass}>
          <div className={`${sheetClass} max-h-[75vh] overflow-y-auto`}>
            <h3 className="font-bold text-base mb-3">📅 {selectedDate}</h3>
            {selectedDateEvents.length===0
              ? <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">이날 일정이 없어요</p>
              : <div className="mb-3 flex flex-col gap-2">
                  {selectedDateEvents.map(event => {
                    const isSchoolEvent = event.category === '학교행사' || event.category === '휴일'
                    const isPersonal = event.is_personal === true
                    const isMyEvent = event.created_by === user?.id
                    const canDelete = isPersonal ? true : isSchoolEvent ? isAdmin : (isMyEvent || isAdmin)
                    return (
                      <div key={event.id} className="card-hover p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${getCategoryBadge(event.category)}`}>{event.category}</span>
                            {isAdmin && event.grade && <span className="text-xs text-gray-400 dark:text-gray-500">{event.grade}학년</span>}
                            {isPersonal && <span className="text-xs text-yellow-500">🔒 나만 보기</span>}
                          </div>
                          <p className="font-medium text-sm mt-0.5">{event.title.replace(/^\[\d학년\] /, '')}</p>
                          {event.content && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{event.content}</p>}
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          {isSchoolEvent && isAdmin && (
                            <button onClick={()=>openEditSchoolEvent(event)}
                              className="btn text-blue-500 text-xs px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">수정</button>
                          )}
                          {!isSchoolEvent && !isPersonal && (
                            <button onClick={()=>openEditEvent(event)}
                              className="btn text-blue-500 text-xs px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">기간수정</button>
                          )}
                          {canDelete && (
                            <button onClick={()=>deleteEvent(event.id, isSchoolEvent, isPersonal)}
                              className="btn text-red-400 text-xs px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">삭제</button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
            }
            {showAddForm ? (
              <>
                {/* 개인 일정 토글 */}
                <label className="flex items-center gap-3 mb-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl cursor-pointer select-none">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">🔒 개인 일정</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">나만 볼 수 있어요</p>
                  </div>
                  <input type="checkbox" className="hidden" checked={popupIsPersonal} onChange={e => setPopupIsPersonal(e.target.checked)} />
                  <div className={`shrink-0 w-11 h-6 rounded-full transition-colors duration-200 relative ${popupIsPersonal ? 'bg-yellow-400' : 'bg-gray-300 dark:bg-gray-600'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-200 ${popupIsPersonal ? 'left-6' : 'left-1'}`} />
                  </div>
                </label>

                {popupIsPersonal ? (
                  /* 개인 일정 색상 선택 */
                  <div className="mb-2">
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">색상</p>
                    <div className="flex gap-2 flex-wrap">
                      {['#f59e0b','#ef4444','#3b82f6','#10b981','#8b5cf6','#ec4899','#06b6d4','#64748b'].map(c => (
                        <button key={c} onClick={() => setPopupColor(c)}
                          className={`w-8 h-8 rounded-full transition-transform ${popupColor === c ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : ''}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-2">
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">종류</p>
                      <div className="flex gap-2">
                        {(['수행평가','기타'] as Category[]).map(cat=>(
                          <button key={cat} onClick={()=>setPopupCategory(cat)}
                            className={`flex-1 py-2 rounded-xl text-sm border-2 transition-colors ${popupCategory===cat?'bg-blue-500 text-white border-blue-500':'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                    {(isAdmin || isTeacher) && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">대상 학년</p>
                        <div className="flex gap-2">
                          {[1,2,3].map(g=>(
                            <button key={g} onClick={()=>setPopupGrade(g)}
                              className={`flex-1 py-2 rounded-xl text-sm border-2 transition-colors ${popupGrade===g?'bg-blue-500 text-white border-blue-500':'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                              {g}학년
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div className="mb-2">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">기간</p>
                  <div className="flex gap-2 mb-2">
                    {([{label:'하루',val:'single'},{label:'기간',val:'range'}] as const).map(({label,val})=>(
                      <button key={val} onClick={()=>{ setPopupDateType(val); if(val==='single') setPopupEndDate('') }}
                        className={`flex-1 py-2 rounded-xl text-sm border-2 transition-colors ${popupDateType===val?'bg-blue-500 text-white border-blue-500':'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {popupDateType === 'single'
                    ? <p className="text-xs text-gray-400 dark:text-gray-500">선택한 날짜: <span className="font-medium text-gray-700 dark:text-gray-200">{selectedDate}</span></p>
                    : <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-500 dark:text-gray-400 shrink-0">시작: <span className="font-medium">{selectedDate}</span></p>
                        <span className="text-gray-300">~</span>
                        <input type="date" value={popupEndDate} onChange={e=>setPopupEndDate(e.target.value)}
                          min={selectedDate ?? ''} className={`${INPUT} flex-1`} placeholder="종료 날짜" />
                      </div>
                  }
                </div>
                <input placeholder="제목" value={popupTitle} onChange={e=>setPopupTitle(e.target.value)} className={`${INPUT} mb-2`} />
                <textarea placeholder="내용 (선택)" value={popupContent} onChange={e=>setPopupContent(e.target.value)} className={`${INPUT} mb-3`} rows={3} />
                <div className="flex gap-2">
                  <button onClick={()=>setShowAddForm(false)} className={BTN_GRAY}>취소</button>
                  <button onClick={submitPost} className={BTN_GREEN}>저장</button>
                </div>
              </>
            ) : (
              <div className="flex gap-2">
                <button onClick={closeDatePopup} className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-sm">닫기</button>
                <button onClick={()=>setShowAddForm(true)} className={BTN_BLUE}>+ 일정 추가</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 공지 팝업 */}
      {showNoticePopup && notices.length > 0 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[150] animate-fade-in px-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md animate-pop-in overflow-hidden">
            {/* 헤더 */}
            <div className="bg-yellow-400 dark:bg-yellow-500 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📢</span>
                <p className="font-bold text-gray-900 text-base">{notices[activeNoticeIdx].title}</p>
              </div>
              {notices.length > 1 && (
                <span className="text-xs text-gray-700 bg-white/40 px-2 py-0.5 rounded-full">
                  {activeNoticeIdx + 1}/{notices.length}
                </span>
              )}
            </div>

            {/* 마크다운 내용 */}
            <div className="px-5 py-4 max-h-[50vh] overflow-y-auto notice-md">
              <ReactMarkdown rehypePlugins={[rehypeRaw]}>{notices[activeNoticeIdx].content}</ReactMarkdown>
            </div>

            {/* 관리자 수정/삭제 버튼 */}
            {isAdmin && (
              <div className="px-5 pb-2 flex gap-2">
                <button onClick={() => { setShowNoticePopup(false); openEditNotice(notices[activeNoticeIdx]) }}
                  className="text-xs text-blue-400 hover:text-blue-500">수정</button>
                <button onClick={() => { deleteNotice(notices[activeNoticeIdx].id); dismissNotice(0) }}
                  className="text-xs text-red-400 hover:text-red-500">삭제</button>
              </div>
            )}

            {/* 버튼 */}
            <div className="px-5 pb-5 flex flex-col gap-2">
              <div className="flex gap-2">
                <button onClick={() => dismissNotice(1)}
                  className="flex-1 py-2 text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                  오늘 하루 보지 않기
                </button>
                <button onClick={() => dismissNotice(7)}
                  className="flex-1 py-2 text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                  일주일 보지 않기
                </button>
              </div>
              <button onClick={() => {
                if (activeNoticeIdx < notices.length - 1) setActiveNoticeIdx(i => i+1)
                else setShowNoticePopup(false)
              }} className="btn w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium rounded-xl text-sm shadow-sm">
                {activeNoticeIdx < notices.length - 1 ? '다음 공지 →' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공지 관리 팝업 (관리자) */}
      {showNoticeManager && (
        <div className={overlayClass}>
          <div className={`${sheetClass} max-h-[85vh] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">📢 공지 관리</h3>
              <button onClick={() => { setEditingNotice(null); setNoticeTitle(''); setNoticeContent(''); setNoticePreview(false); setShowNoticeForm(true) }}
                className="btn px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl text-xs font-medium shadow-sm">
                + 새 공지
              </button>
            </div>
            {allNotices.length === 0
              ? <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">등록된 공지가 없어요</p>
              : <div className="flex flex-col gap-3">
                  {allNotices.map(n => (
                    <div key={n.id} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2.5 flex items-center justify-between">
                        <p className="font-medium text-sm truncate">{n.title}</p>
                        <div className="flex gap-1.5 shrink-0 ml-2">
                          <button onClick={() => { setShowNoticeManager(false); openEditNotice(n) }}
                            className="btn text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-500 rounded-lg hover:bg-blue-100">수정</button>
                          <button onClick={() => deleteNotice(n.id)}
                            className="btn text-xs px-2.5 py-1 bg-red-50 dark:bg-red-900/30 text-red-400 rounded-lg hover:bg-red-100">삭제</button>
                        </div>
                      </div>
                      <div className="px-3 py-2 notice-md max-h-24 overflow-hidden text-xs opacity-70">
                        <ReactMarkdown>{n.content.slice(0, 100) + (n.content.length > 100 ? '...' : '')}</ReactMarkdown>
                      </div>
                      <p className="px-3 py-1.5 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800">
                        {new Date(n.created_at).toLocaleDateString('ko-KR', { month:'long', day:'numeric' })} 등록
                      </p>
                    </div>
                  ))}
                </div>
            }
            <button onClick={() => setShowNoticeManager(false)}
              className="mt-4 w-full py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-sm">닫기</button>
          </div>
        </div>
      )}

      {/* 공지 작성/수정 팝업 (관리자) */}
      {showNoticeForm && (
        <div className={overlayClass}>
          <div className={`${sheetClass} max-h-[95vh] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base">{editingNotice ? '✏️ 공지 수정' : '📢 공지 작성'}</h3>
              <button onClick={() => setNoticePreview(!noticePreview)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${noticePreview ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                {noticePreview ? '✏️ 편집' : '👁 미리보기'}
              </button>
            </div>

            <input placeholder="공지 제목" value={noticeTitle}
              onChange={e => setNoticeTitle(e.target.value)} className={`${INPUT} mb-3`} />

            {noticePreview ? (
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 min-h-[200px] max-h-[45vh] overflow-y-auto mb-3 notice-md">
                {noticeContent
                  ? <ReactMarkdown rehypePlugins={[rehypeRaw]}>{noticeContent}</ReactMarkdown>
                  : <p className="text-gray-400 text-sm">내용을 입력하면 여기에 미리보기가 나타나요</p>}
              </div>
            ) : (
              <div className="mb-3">
                {/* 툴바 */}
                <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  {/* 정렬 */}
                  <button onClick={() => insertToContent('<div style="text-align:left">', '</div>')}
                    className="btn text-xs px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">≡ 왼쪽</button>
                  <button onClick={() => insertToContent('<div style="text-align:center">', '</div>')}
                    className="btn text-xs px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">≡ 중앙</button>
                  <button onClick={() => insertToContent('<div style="text-align:right">', '</div>')}
                    className="btn text-xs px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">≡ 오른쪽</button>
                  <div className="w-px bg-gray-200 dark:bg-gray-600 mx-0.5" />
                  {/* 서식 - HTML 태그로 변경 */}
                  <button onClick={() => insertToContent('<strong>', '</strong>')}
                    className="btn text-xs px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg font-bold">B</button>
                  <button onClick={() => insertToContent('<em>', '</em>')}
                    className="btn text-xs px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg italic">I</button>
                  <button onClick={() => insertToContent('<h2>', '</h2>')}
                    className="btn text-xs px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">H2</button>
                  <button onClick={() => insertToContent('<h3>', '</h3>')}
                    className="btn text-xs px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">H3</button>
                  <div className="w-px bg-gray-200 dark:bg-gray-600 mx-0.5" />
                  {/* 링크 */}
                  <button onClick={() => insertToContent('<a href="https://">', '</a>')}
                    className="btn text-xs px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">🔗</button>
                  {/* 이미지 업로드 */}
                  <label className="btn text-xs px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer">
                    {uploadingImage ? '⏳' : '🖼'}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) uploadNoticeImage(e.target.files[0]) }} />
                  </label>
                  <div className="w-px bg-gray-200 dark:bg-gray-600 mx-0.5" />
                  <button onClick={() => insertToContent('\n---\n')}
                    className="btn text-xs px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">—</button>
                </div>
                <textarea
                  ref={noticeTextareaRef}
                  placeholder={'마크다운으로 작성해요\n\n## 제목\n**굵게** / *기울임*\n[링크](https://URL)\n![이미지](https://URL)\n- 목록'}
                  value={noticeContent}
                  onChange={e => setNoticeContent(e.target.value)}
                  className={`${INPUT} font-mono text-xs`} rows={12} />
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setShowNoticeForm(false); setNoticeTitle(''); setNoticeContent(''); setNoticePreview(false); setEditingNotice(null) }}
                className={BTN_GRAY}>취소</button>
              <button onClick={submitNotice}
                className="btn flex-1 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl text-sm font-medium shadow-md">
                {editingNotice ? '수정 완료' : '공지 등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}