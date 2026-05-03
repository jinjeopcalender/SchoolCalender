'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Calendar from '@/components/Calendar'

type Tab = 'calendar' | 'teacher'
type Category = '수행평가' | '기타'

const CATEGORY_STYLES: Record<string, { badge: string; color: string }> = {
  '수행평가': { badge: 'bg-blue-100 text-blue-700', color: '#3b82f6' },
  '학교행사': { badge: 'bg-green-100 text-green-700', color: '#10b981' },
  '기타': { badge: 'bg-purple-100 text-purple-700', color: '#8b5cf6' },
}

const getCategoryBadge = (cat: string) => CATEGORY_STYLES[cat]?.badge ?? 'bg-gray-100 text-gray-600'
const getCategoryColor = (cat: string) => CATEGORY_STYLES[cat]?.color ?? '#8b5cf6'

// 과목 목록
const SUBJECTS = ['국어', '수학', '영어', '과학', '사회', '역사', '도덕', '체육', '음악', '미술', '기술·가정', '정보', '한문', '기타']

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [userGrade, setUserGrade] = useState<number | null>(null)
  const [showGradePicker, setShowGradePicker] = useState(false)
  const [events, setEvents] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [pendingPosts, setPendingPosts] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('calendar')

  // 날짜 팝업
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedDateEvents, setSelectedDateEvents] = useState<any[]>([])
  const [showDatePopup, setShowDatePopup] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [popupTitle, setPopupTitle] = useState('')
  const [popupContent, setPopupContent] = useState('')
  const [popupCategory, setPopupCategory] = useState<Category>('수행평가')
  const [popupGrade, setPopupGrade] = useState<number | null>(null)

  // 관리자 학교행사 추가
  const [showSchoolEventForm, setShowSchoolEventForm] = useState(false)
  const [schoolEventTitle, setSchoolEventTitle] = useState('')
  const [schoolEventContent, setSchoolEventContent] = useState('')
  const [schoolEventDate, setSchoolEventDate] = useState('')
  const [schoolEventGrade, setSchoolEventGrade] = useState<number | null>(null)

  // 알림
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  // 날짜 선택 대기
  const [pendingPostId, setPendingPostId] = useState<string | null>(null)
  const pendingPostTitleRef = useRef<string | null>(null)
  const pendingNotifIdRef = useRef<string | null>(null)
  const pendingDefaultDateRef = useRef<string | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pickerDate, setPickerDate] = useState<string>('')

  // 선생님 위치
  const [teachers, setTeachers] = useState<any[]>([])
  const [showTeacherForm, setShowTeacherForm] = useState(false)
  const [teacherName, setTeacherName] = useState('')
  const [teacherSubject, setTeacherSubject] = useState(SUBJECTS[0])
  const [teacherLocation, setTeacherLocation] = useState('')
  const [editingTeacher, setEditingTeacher] = useState<any>(null)
  const [openSubjects, setOpenSubjects] = useState<Set<string>>(new Set(SUBJECTS))

  const toggleSubject = (subject: string) => {
    setOpenSubjects(prev => {
      const next = new Set(prev)
      next.has(subject) ? next.delete(subject) : next.add(subject)
      return next
    })
  }

  // ─── 뒤로가기 처리 ───────────────────────────────────────────
  // 팝업이 열릴 때 history에 state를 push하고,
  // 브라우저 뒤로가기(popstate) 시 팝업을 닫는다.
  const pushHistory = () => window.history.pushState({ popup: true }, '')

  useEffect(() => {
    const handlePopState = () => {
      // 열려있는 팝업 순서대로 닫기
      if (showTeacherForm) { setShowTeacherForm(false); resetTeacherForm(); return }
      if (showSchoolEventForm) { setShowSchoolEventForm(false); return }
      if (showDatePicker) { cancelDatePicker(); return }
      if (showAddForm) { setShowAddForm(false); return }
      if (showDatePopup) { closeDatePopup(); return }
      if (showNotifications) { setShowNotifications(false); return }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [showTeacherForm, showSchoolEventForm, showDatePicker, showAddForm, showDatePopup, showNotifications])

  // 팝업 열 때 history push
  useEffect(() => { if (showNotifications) pushHistory() }, [showNotifications])
  useEffect(() => { if (showDatePopup) pushHistory() }, [showDatePopup])
  useEffect(() => { if (showAddForm) pushHistory() }, [showAddForm])
  useEffect(() => { if (showDatePicker) pushHistory() }, [showDatePicker])
  useEffect(() => { if (showSchoolEventForm) pushHistory() }, [showSchoolEventForm])
  useEffect(() => { if (showTeacherForm) pushHistory() }, [showTeacherForm])
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.removeAllChannels()
    const init = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) { await supabase.auth.signOut(); return }
      const currentUser = data.user
      if (!currentUser) return

      setUser(currentUser)

      await supabase.from('users').upsert({ id: currentUser.id, name: currentUser.user_metadata.full_name })

      const { data: userData } = await supabase
        .from('users').select('role, grade').eq('id', currentUser.id).single()

      const admin = userData?.role === 'admin'
      setIsAdmin(admin)

      if (!userData?.grade) {
        setShowGradePicker(true)
        return
      }

      setUserGrade(userData.grade)
      await loadCalendarData(currentUser.id, userData.grade, admin)
      await loadTeachers()
    }
    init()
    return () => { supabase.removeAllChannels() }
  }, [])

  const loadCalendarData = async (uid: string, grade: number, admin: boolean) => {
    // 새 유저를 위한 기존 알림 자동 생성
    const { data: missedPosts } = await supabase
      .from('posts')
      .select('id')
      .eq('status', 'approved')
      .eq('is_user_generated', true)
      .or(`grade.is.null,grade.eq.${grade}`)
      .neq('created_by', uid)

    if (missedPosts && missedPosts.length > 0) {
      const notifInserts = missedPosts.map(p => ({
        user_id: uid,
        post_id: p.id,
        is_read: false,
      }))
      await supabase
        .from('notifications')
        .upsert(notifInserts, { onConflict: 'user_id,post_id' })
    }

    // 새 유저를 위한 학교행사 자동 추가
    const { data: schoolPosts } = await supabase
      .from('posts')
      .select('id, default_date')
      .eq('status', 'approved')
      .eq('category', '학교행사')
      .or(`grade.is.null,grade.eq.${grade}`)

    if (schoolPosts && schoolPosts.length > 0) {
      const inserts = schoolPosts.map(p => ({
        user_id: uid,
        post_id: p.id,
        assigned_date: p.default_date,
      }))
      await supabase.from('user_calendar').upsert(inserts, { onConflict: 'user_id,post_id' })
    }

    const { data: calendarData } = await supabase
      .from('user_calendar')
      .select('assigned_date, posts(id, title, content, category)')
      .eq('user_id', uid)

    setEvents((calendarData || []).map((item: any) => ({
      id: item.posts.id,
      title: item.posts.title,
      content: item.posts.content,
      category: item.posts.category,
      date: item.assigned_date,
      color: getCategoryColor(item.posts.category),
    })))

    const { data: notifData } = await supabase
      .from('notifications')
      .select('*, posts(id, title, content, default_date, category)')
      .eq('user_id', uid)
      .neq('status', 'dismissed')
      .neq('status', 'accepted')
    setNotifications(notifData || [])

    if (admin) {
      const { data: pending } = await supabase.from('posts').select('*').eq('status', 'pending')
      setPendingPosts(pending || [])
    }

    // Realtime - 알림
    supabase
      .channel('notifications-channel')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${uid}`,
      }, async (payload) => {
        const { data: notif } = await supabase
          .from('notifications')
          .select('*, posts(id, title, content, default_date, category)')
          .eq('id', payload.new.id).single()
        if (notif) setNotifications(prev => [notif, ...prev])
      })
      .subscribe()

    // Realtime - 학교행사
    supabase
      .channel('user-calendar-channel')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'user_calendar',
        filter: `user_id=eq.${uid}`,
      }, async (payload) => {
        const { data: postInfo } = await supabase
          .from('posts')
          .select('id, title, content, category')
          .eq('id', payload.new.post_id)
          .single()

        if (postInfo) {
          const newEvent = {
            id: postInfo.id,
            title: postInfo.title,
            content: postInfo.content,
            category: postInfo.category,
            date: payload.new.assigned_date,
            color: getCategoryColor(postInfo.category),
          }
          setEvents(prev => {
            if (prev.some(e => e.id === newEvent.id)) return prev
            return [...prev, newEvent]
          })
        }
      })
      .subscribe()

    if (admin) {
      supabase
        .channel('posts-channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, (payload) => {
          if (payload.new.status === 'pending') setPendingPosts(prev => [payload.new, ...prev])
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, (payload) => {
          if (payload.new.status !== 'pending') setPendingPosts(prev => prev.filter(p => p.id !== payload.new.id))
        })
        .subscribe()
    }
  }

  // ─── 선생님 위치 ─────────────────────────────────────────────
  const loadTeachers = async () => {
    const { data } = await supabase.from('teachers').select('*').order('subject').order('name')
    setTeachers(data || [])
  }

  const resetTeacherForm = () => {
    setTeacherName('')
    setTeacherSubject(SUBJECTS[0])
    setTeacherLocation('')
    setEditingTeacher(null)
  }

  const openAddTeacher = () => {
    resetTeacherForm()
    setShowTeacherForm(true)
  }

  const openEditTeacher = (t: any) => {
    setEditingTeacher(t)
    setTeacherName(t.name)
    setTeacherSubject(t.subject)
    setTeacherLocation(t.location)
    setShowTeacherForm(true)
  }

  const submitTeacher = async () => {
    if (!teacherName.trim() || !teacherLocation.trim()) { alert('성함과 위치를 입력해주세요!'); return }

    if (editingTeacher) {
      const { error } = await supabase.from('teachers')
        .update({ name: teacherName.trim(), subject: teacherSubject, location: teacherLocation.trim() })
        .eq('id', editingTeacher.id)
      if (error) { alert(error.message); return }
    } else {
      const { error } = await supabase.from('teachers')
        .insert({ name: teacherName.trim(), subject: teacherSubject, location: teacherLocation.trim() })
      if (error) { alert(error.message); return }
    }

    await loadTeachers()
    setShowTeacherForm(false)
    resetTeacherForm()
  }

  const deleteTeacher = async (id: string) => {
    if (!confirm('삭제할까요?')) return
    await supabase.from('teachers').delete().eq('id', id)
    setTeachers(prev => prev.filter(t => t.id !== id))
  }

  // 과목별 그룹핑
  const teachersBySubject = teachers.reduce((acc, t) => {
    if (!acc[t.subject]) acc[t.subject] = []
    acc[t.subject].push(t)
    return acc
  }, {} as Record<string, any[]>)
  // ─────────────────────────────────────────────────────────────

  const selectGrade = async (grade: number) => {
    if (!user) return
    const { error } = await supabase.from('users').update({ grade }).eq('id', user.id)
    if (error) { alert(error.message); return }
    setUserGrade(grade)
    setShowGradePicker(false)
    await loadCalendarData(user.id, grade, isAdmin)
    await loadTeachers()
  }

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { skipBrowserRedirect: false, queryParams: { prompt: 'select_account' } },
    })
  }

  const logout = async () => {
    supabase.removeAllChannels()
    await supabase.auth.signOut()
    setUser(null)
    setUserGrade(null)
  }

  const closeDatePopup = () => {
    setShowDatePopup(false)
    setSelectedDate(null)
    setSelectedDateEvents([])
    setShowAddForm(false)
    setPopupTitle('')
    setPopupContent('')
    setPopupCategory('수행평가')
    setPopupGrade(null)
  }

  const handleDateClick = (date: string) => {
    if (pendingPostId) { setPickerDate(date); return }
    const dayEvents = events.filter(e => e.date === date)
    setSelectedDate(date)
    setSelectedDateEvents(dayEvents)
    setShowDatePopup(true)
    setShowAddForm(false)
    setPopupTitle('')
    setPopupContent('')
    setPopupCategory('수행평가')
    setPopupGrade(null)
  }

  const submitPost = async () => {
    if (!user || !selectedDate) return
    if (!popupTitle) { alert('제목을 입력해주세요!'); return }

    const targetGrade = isAdmin ? popupGrade : userGrade
    if (!targetGrade) { alert('학년을 선택해주세요!'); return }

    const { data: postData, error } = await supabase
      .from('posts')
      .insert({
        title: popupTitle,
        content: popupContent,
        status: 'pending',
        created_by: user.id,
        default_date: selectedDate,
        category: popupCategory,
        grade: targetGrade,
        is_user_generated: true,
      })
      .select().single()

    if (error) { alert(error.message); return }

    await supabase.from('user_calendar').insert({
      user_id: user.id,
      post_id: postData.id,
      assigned_date: selectedDate,
    })

    const newEvent = {
      id: postData.id, title: popupTitle, content: popupContent,
      category: popupCategory, date: selectedDate,
      color: getCategoryColor(popupCategory),
    }
    setEvents(prev => [...prev, newEvent])
    setSelectedDateEvents(prev => [...prev, newEvent])
    setShowAddForm(false)
    setPopupTitle('')
    setPopupContent('')
  }

  const submitSchoolEvent = async () => {
    if (!user || !schoolEventTitle || !schoolEventDate) {
      alert('제목과 날짜를 입력해주세요!'); return
    }

    const { data: postData, error } = await supabase
      .from('posts')
      .insert({
        title: schoolEventTitle,
        content: schoolEventContent,
        status: 'approved',
        created_by: user.id,
        default_date: schoolEventDate,
        category: '학교행사',
        grade: schoolEventGrade,
        is_user_generated: false,
      })
      .select().single()

    if (error) { alert(error.message); return }

    let usersQuery = supabase.from('users').select('id')
    if (schoolEventGrade) usersQuery = usersQuery.eq('grade', schoolEventGrade)
    const { data: targetUsers } = await usersQuery

    if (targetUsers && targetUsers.length > 0) {
      const calendarInserts = targetUsers.map(u => ({
        user_id: u.id,
        post_id: postData.id,
        assigned_date: schoolEventDate,
      }))
      await supabase.from('user_calendar').insert(calendarInserts)
    }

    setShowSchoolEventForm(false)
    setSchoolEventTitle('')
    setSchoolEventContent('')
    setSchoolEventDate('')
    setSchoolEventGrade(null)

    const newEvent = {
      id: postData.id,
      title: schoolEventTitle,
      content: schoolEventContent,
      category: '학교행사',
      date: schoolEventDate,
      color: getCategoryColor('학교행사'),
    }
    setEvents(prev => [...prev, newEvent])
    alert('학교 행사가 추가됐어요!')
  }

  const deleteEvent = async (eventId: string) => {
    if (!user) return
    if (!confirm('이 일정을 삭제할까요?')) return
    await supabase.from('user_calendar').delete().eq('user_id', user.id).eq('post_id', eventId)
    setEvents(prev => prev.filter(e => e.id !== eventId))
    setSelectedDateEvents(prev => prev.filter(e => e.id !== eventId))
  }

  const acceptNotification = (notif: any) => {
    setPendingPostId(notif.posts.id)
    pendingPostTitleRef.current = notif.posts.title
    pendingNotifIdRef.current = notif.id
    pendingDefaultDateRef.current = notif.posts.default_date
    setPickerDate(notif.posts.default_date || '')
    setShowNotifications(false)
    setShowDatePicker(true)
  }

  const confirmDatePicker = async () => {
    if (!user || !pickerDate) { alert('날짜를 선택해주세요!'); return }
    const postId = pendingPostId!
    const notifId = pendingNotifIdRef.current
    const postTitle = pendingPostTitleRef.current

    const { error } = await supabase
      .from('user_calendar')
      .upsert({ user_id: user.id, post_id: postId, assigned_date: pickerDate }, { onConflict: 'user_id,post_id' })

    if (error) { alert('에러: ' + error.message); return }

    if (notifId) {
      await supabase.from('notifications').update({ status: 'accepted', is_read: true }).eq('id', notifId)
    }

    setNotifications(prev => prev.filter(n => n.id !== notifId))
    setPendingPostId(null)
    pendingPostTitleRef.current = null
    pendingNotifIdRef.current = null
    pendingDefaultDateRef.current = null
    setShowDatePicker(false)
    setPickerDate('')
  }

  const cancelDatePicker = () => {
    setPendingPostId(null)
    pendingPostTitleRef.current = null
    pendingNotifIdRef.current = null
    pendingDefaultDateRef.current = null
    setShowDatePicker(false)
    setPickerDate('')
  }

  const holdNotification = async (notif: any) => {
    await supabase.from('notifications').update({ status: 'held' }).eq('id', notif.id)
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, status: 'held' } : n))
  }

  const dismissNotification = async (notif: any) => {
    await supabase.from('notifications').update({ status: 'dismissed', is_read: true }).eq('id', notif.id)
    await supabase.from('user_actions').insert({ user_id: user.id, post_id: notif.posts.id, action: 'dismissed' })
    setNotifications(prev => prev.filter(n => n.id !== notif.id))
  }

  const approvePost = async (postId: string) => {
    const { error } = await supabase.from('posts').update({ status: 'approved' }).eq('id', postId)
    if (error) { alert(error.message); return }
    setPendingPosts(prev => prev.filter(p => p.id !== postId))
  }

  const rejectPost = async (postId: string) => {
    await supabase.from('posts').update({ status: 'rejected' }).eq('id', postId)
    setPendingPosts(prev => prev.filter(p => p.id !== postId))
  }

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] ?? ''
  const activeNotifications = notifications.filter(n => n.status === 'pending')
  const heldNotifications = notifications.filter(n => n.status === 'held')

  const overlayClass = "fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end justify-center z-50"
  const sheetClass = "bg-white text-gray-900 rounded-t-2xl p-5 w-full max-w-lg"

  if (user && showGradePicker) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 px-6">
        <h1 className="text-2xl font-bold">📅 학교 캘린더</h1>
        <p className="text-gray-500 text-sm">학년을 선택해주세요</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          {[1, 2, 3].map(g => (
            <button key={g} onClick={() => selectGrade(g)}
              className="py-4 bg-blue-500 text-white rounded-2xl text-lg font-bold">
              {g}학년
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">
      {!user ? (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6">
          <h1 className="text-2xl font-bold">📅 학교 캘린더</h1>
          <button onClick={login} className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium text-base w-full">
            Google로 로그인
          </button>
        </div>
      ) : (
        <>
          {/* 헤더 */}
          <div className="flex items-center justify-between px-3 py-3 border-b">
            <p className="text-sm font-semibold truncate max-w-[160px]">
              {displayName}
              {userGrade && <span className="ml-1 text-xs text-gray-400">{userGrade}학년</span>}
              {isAdmin && <span className="ml-1 text-xs text-blue-500">(관리자)</span>}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setShowNotifications(true)} className="relative px-3 py-1.5 bg-gray-100 rounded-lg text-sm">
                🔔
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {notifications.length}
                  </span>
                )}
              </button>
              <button onClick={logout} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm">로그아웃</button>
            </div>
          </div>

          {/* 탭 콘텐츠 */}
          <div className="flex-1 px-3 py-4 overflow-y-auto pb-20">
            {activeTab === 'calendar' && (
              <>
                {isAdmin && (
                  <div className="mb-4 p-3 border rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-base font-bold">🛠 관리자</h2>
                      <button onClick={() => setShowSchoolEventForm(true)}
                        className="px-3 py-1 bg-green-500 text-white rounded-lg text-xs font-medium">
                        + 학교 행사
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 font-medium mb-1">승인 대기</p>
                    {pendingPosts.length === 0 ? (
                      <p className="text-xs text-gray-400">대기 중인 일정이 없어요</p>
                    ) : (
                      pendingPosts.map((post) => (
                        <div key={post.id} className="p-2 border mt-2 rounded-lg">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${getCategoryBadge(post.category)}`}>{post.category}</span>
                            <span className="text-xs text-gray-400">{post.grade}학년</span>
                          </div>
                          <p className="font-medium text-sm">{post.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{post.content}</p>
                          <p className="text-xs text-gray-400 mt-0.5">날짜: {post.default_date}</p>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => approvePost(post.id)} className="flex-1 py-1.5 bg-green-500 text-white rounded-lg text-sm">승인</button>
                            <button onClick={() => rejectPost(post.id)} className="flex-1 py-1.5 bg-red-500 text-white rounded-lg text-sm">거절</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                <div className="flex gap-2 mb-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">수행평가</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">학교행사</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">기타</span>
                </div>

                <Calendar events={events} onDateClick={handleDateClick} pendingPostId={pendingPostId} />
              </>
            )}

            {/* ─── 선생님 위치 탭 ─── */}
            {activeTab === 'teacher' && (
              <div className="flex flex-col gap-3">
                {/* 관리자 패널 (캘린더 탭과 동일한 스타일) */}
                {isAdmin && (
                  <div className="p-3 border rounded-xl">
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-bold">🛠 관리자</h2>
                      <button onClick={openAddTeacher}
                        className="px-3 py-1 bg-blue-500 text-white rounded-lg text-xs font-medium">
                        + 선생님 추가
                      </button>
                    </div>
                  </div>
                )}

                {teachers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
                    <p className="text-4xl">🏫</p>
                    <p className="text-sm">등록된 선생님이 없어요</p>
                    {isAdmin && <p className="text-xs">위 버튼으로 추가해보세요</p>}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {Object.entries(teachersBySubject).map(([subject, list]) => {
                      const isOpen = openSubjects.has(subject)
                      return (
                        <div key={subject} className="border rounded-xl overflow-hidden">
                          {/* 과목 헤더 — 탭하면 접기/펼치기 */}
                          <button
                            onClick={() => toggleSubject(subject)}
                            className="w-full flex items-center justify-between px-3 py-3 bg-gray-50 active:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-gray-700">{subject}</p>
                              <span className="text-xs text-gray-400 bg-gray-200 rounded-full px-1.5 py-0.5">
                                {(list as any[]).length}명
                              </span>
                            </div>
                            <span className={`text-gray-400 text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                          </button>

                          {/* 선생님 목록 */}
                          {isOpen && (
                            <div className="divide-y">
                              {(list as any[]).map((t) => (
                                <div key={t.id} className="px-4 py-4 flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-base font-semibold">{t.name} 선생님</p>
                                    <p className="text-sm text-gray-500 mt-1">📍 {t.location}</p>
                                  </div>
                                  {isAdmin && (
                                    <div className="flex gap-2 shrink-0">
                                      <button onClick={() => openEditTeacher(t)}
                                        className="text-xs px-3 py-1.5 bg-blue-50 text-blue-500 rounded-lg">수정</button>
                                      <button onClick={() => deleteTeacher(t.id)}
                                        className="text-xs px-3 py-1.5 bg-red-50 text-red-400 rounded-lg">삭제</button>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 하단 탭 */}
          <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto border-t bg-white flex">
            <button onClick={() => setActiveTab('calendar')}
              className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs ${activeTab === 'calendar' ? 'text-blue-500' : 'text-gray-400'}`}>
              <span className="text-xl">📅</span>캘린더
            </button>
            <button onClick={() => setActiveTab('teacher')}
              className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs ${activeTab === 'teacher' ? 'text-blue-500' : 'text-gray-400'}`}>
              <span className="text-xl">🏫</span>선생님 위치
            </button>
          </div>

          {/* 선생님 추가/수정 팝업 */}
          {showTeacherForm && (
            <div className={overlayClass}>
              <div className={`${sheetClass} max-h-[85vh] overflow-y-auto`}>
                <h3 className="font-bold text-base mb-4">{editingTeacher ? '✏️ 선생님 수정' : '➕ 선생님 추가'}</h3>

                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1.5">과목</p>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS.map(s => (
                      <button key={s} onClick={() => setTeacherSubject(s)}
                        className={`px-3 py-1.5 rounded-xl text-xs border-2 transition-colors ${teacherSubject === s ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 text-gray-600'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-xs text-gray-400 mb-1.5">선생님 성함</p>
                  <input
                    placeholder="예: 홍길동"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    className="border p-2.5 w-full rounded-xl text-sm"
                  />
                </div>

                <div className="mb-5">
                  <p className="text-xs text-gray-400 mb-1.5">교무실 위치</p>
                  <input
                    placeholder="예: 3층 국어 교무실"
                    value={teacherLocation}
                    onChange={(e) => setTeacherLocation(e.target.value)}
                    className="border p-2.5 w-full rounded-xl text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <button onClick={() => { setShowTeacherForm(false); resetTeacherForm() }}
                    className="flex-1 py-2.5 bg-gray-200 rounded-xl text-sm">취소</button>
                  <button onClick={submitTeacher}
                    className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium">
                    {editingTeacher ? '수정' : '추가'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 학교행사 추가 팝업 */}
          {showSchoolEventForm && (
            <div className={overlayClass}>
              <div className={`${sheetClass} max-h-[80vh] overflow-y-auto`}>
                <h3 className="font-bold text-base mb-4">🏫 학교 행사 추가</h3>
                <input placeholder="행사 제목" value={schoolEventTitle}
                  onChange={(e) => setSchoolEventTitle(e.target.value)}
                  className="border p-2.5 w-full mb-2 rounded-xl text-sm" />
                <textarea placeholder="내용 (선택)" value={schoolEventContent}
                  onChange={(e) => setSchoolEventContent(e.target.value)}
                  className="border p-2.5 w-full mb-2 rounded-xl text-sm" rows={2} />
                <div className="mb-2">
                  <p className="text-xs text-gray-400 mb-1.5">날짜</p>
                  <input type="date" value={schoolEventDate}
                    onChange={(e) => setSchoolEventDate(e.target.value)}
                    className="border p-2.5 w-full rounded-xl text-sm" />
                </div>
                <div className="mb-4">
                  <p className="text-xs text-gray-400 mb-1.5">대상 학년</p>
                  <div className="flex gap-2">
                    {[{ label: '전체', val: null }, { label: '1학년', val: 1 }, { label: '2학년', val: 2 }, { label: '3학년', val: 3 }].map(({ label, val }) => (
                      <button key={label} onClick={() => setSchoolEventGrade(val)}
                        className={`flex-1 py-2 rounded-xl text-sm border-2 transition-colors ${schoolEventGrade === val ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 text-gray-600'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowSchoolEventForm(false)} className="flex-1 py-2.5 bg-gray-200 rounded-xl text-sm">취소</button>
                  <button onClick={submitSchoolEvent} className="flex-1 py-2.5 bg-green-500 text-white rounded-xl text-sm font-medium">추가</button>
                </div>
              </div>
            </div>
          )}

          {/* 알림 팝업 */}
          {showNotifications && (
            <div className={overlayClass}>
              <div className={`${sheetClass} max-h-[75vh] overflow-y-auto`}>
                <h3 className="font-bold text-base mb-3">🔔 알림</h3>
                {activeNotifications.length === 0 && heldNotifications.length === 0 ? (
                  <p className="text-gray-400 text-sm">새 알림이 없어요</p>
                ) : (
                  <>
                    {activeNotifications.map((notif) => (
                      <div key={notif.id} className="p-3 border rounded-xl mt-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${getCategoryBadge(notif.posts.category)}`}>{notif.posts.category}</span>
                        <p className="font-medium text-sm mt-1">{notif.posts.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{notif.posts.content}</p>
                        <p className="text-xs text-gray-400 mt-0.5">기본 날짜: {notif.posts.default_date}</p>
                        <div className="flex flex-col gap-1.5 mt-2">
                          <button onClick={() => acceptNotification(notif)} className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm font-medium">📅 일정에 추가</button>
                          <div className="flex gap-1.5">
                            <button onClick={() => holdNotification(notif)} className="flex-1 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-sm">⏸ 보류</button>
                            <button onClick={() => dismissNotification(notif)} className="flex-1 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-sm">✕ 수락 안 함</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {heldNotifications.length > 0 && (
                      <>
                        <p className="text-xs text-gray-400 mt-4 mb-1 font-medium">⏸ 보류된 알림</p>
                        {heldNotifications.map((notif) => (
                          <div key={notif.id} className="p-3 border border-yellow-200 bg-yellow-50 rounded-xl mt-2">
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${getCategoryBadge(notif.posts.category)}`}>{notif.posts.category}</span>
                            <p className="font-medium text-sm text-gray-800 mt-1">{notif.posts.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{notif.posts.content}</p>
                            <p className="text-xs text-gray-400 mt-0.5">기본 날짜: {notif.posts.default_date}</p>
                            <div className="flex flex-col gap-1.5 mt-2">
                              <button onClick={() => acceptNotification(notif)} className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm font-medium">📅 일정에 추가</button>
                              <button onClick={() => dismissNotification(notif)} className="w-full py-1.5 bg-gray-200 text-gray-600 rounded-lg text-sm">✕ 수락 안 함</button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
                <button onClick={() => setShowNotifications(false)} className="mt-4 w-full py-2.5 bg-gray-100 rounded-xl text-sm">닫기</button>
              </div>
            </div>
          )}

          {/* 날짜 선택 팝업 */}
          {showDatePicker && (
            <div className={overlayClass}>
              <div className={sheetClass}>
                <h3 className="font-bold text-base mb-1">📅 날짜 선택</h3>
                <p className="text-sm text-gray-500 mb-4 truncate">"{pendingPostTitleRef.current}"</p>
                {pendingDefaultDateRef.current && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-1.5">추천 날짜</p>
                    <button onClick={() => setPickerDate(pendingDefaultDateRef.current!)}
                      className={`w-full py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${pickerDate === pendingDefaultDateRef.current ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-blue-500 border-blue-300'}`}>
                      {pendingDefaultDateRef.current} (기본 날짜)
                    </button>
                  </div>
                )}
                <div className="mb-4">
                  <p className="text-xs text-gray-400 mb-1.5">직접 선택</p>
                  <input type="date" value={pickerDate} onChange={(e) => setPickerDate(e.target.value)}
                    className="border p-2.5 w-full rounded-xl text-sm" />
                </div>
                <div className="flex gap-2">
                  <button onClick={cancelDatePicker} className="flex-1 py-2.5 bg-gray-200 rounded-xl text-sm">취소</button>
                  <button onClick={confirmDatePicker} className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium">추가</button>
                </div>
              </div>
            </div>
          )}

          {/* 날짜 클릭 팝업 */}
          {showDatePopup && selectedDate && (
            <div className={overlayClass}>
              <div className={`${sheetClass} max-h-[75vh] overflow-y-auto`}>
                <h3 className="font-bold text-base mb-3">📅 {selectedDate}</h3>
                {selectedDateEvents.length === 0 ? (
                  <p className="text-sm text-gray-400 mb-3">이날 일정이 없어요</p>
                ) : (
                  <div className="mb-3 flex flex-col gap-2">
                    {selectedDateEvents.map((event) => (
                      <div key={event.id} className="p-3 bg-gray-50 border rounded-xl flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${getCategoryBadge(event.category)}`}>{event.category}</span>
                          <p className="font-medium text-sm mt-0.5">{event.title}</p>
                          {event.content && <p className="text-xs text-gray-500 mt-0.5">{event.content}</p>}
                        </div>
                        {event.category !== '학교행사' && (
                          <button onClick={() => deleteEvent(event.id)}
                            className="shrink-0 text-red-400 text-xs px-2 py-1 rounded-lg bg-red-50">삭제</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {showAddForm ? (
                  <>
                    <div className="mb-2">
                      <p className="text-xs text-gray-400 mb-1.5">종류</p>
                      <div className="flex gap-2">
                        {(['수행평가', '기타'] as Category[]).map(cat => (
                          <button key={cat} onClick={() => setPopupCategory(cat)}
                            className={`flex-1 py-2 rounded-xl text-sm border-2 transition-colors ${popupCategory === cat ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 text-gray-600'}`}>
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="mb-2">
                        <p className="text-xs text-gray-400 mb-1.5">대상 학년</p>
                        <div className="flex gap-2">
                          {[1, 2, 3].map(g => (
                            <button key={g} onClick={() => setPopupGrade(g)}
                              className={`flex-1 py-2 rounded-xl text-sm border-2 transition-colors ${popupGrade === g ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200 text-gray-600'}`}>
                              {g}학년
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <input placeholder="제목" value={popupTitle}
                      onChange={(e) => setPopupTitle(e.target.value)}
                      className="border p-2.5 w-full mb-2 rounded-xl text-sm" />
                    <textarea placeholder="내용 (선택)" value={popupContent}
                      onChange={(e) => setPopupContent(e.target.value)}
                      className="border p-2.5 w-full mb-3 rounded-xl text-sm" rows={3} />
                    <div className="flex gap-2">
                      <button onClick={() => setShowAddForm(false)} className="flex-1 py-2.5 bg-gray-200 rounded-xl text-sm">취소</button>
                      <button onClick={submitPost} className="flex-1 py-2.5 bg-green-500 text-white rounded-xl text-sm font-medium">저장</button>
                    </div>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={closeDatePopup} className="flex-1 py-2.5 bg-gray-100 rounded-xl text-sm">닫기</button>
                    <button onClick={() => setShowAddForm(true)} className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium">+ 일정 추가</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}