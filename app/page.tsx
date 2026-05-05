'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Calendar from '@/components/Calendar'

type Tab = 'calendar' | 'teacher'
type Category = '수행평가' | '기타'

const CATEGORY_STYLES: Record<string, { badge: string; color: string }> = {
  '수행평가': { badge: 'bg-blue-100 text-blue-700', color: '#3b82f6' },
  '학교행사': { badge: 'bg-green-100 text-green-700', color: '#10b981' },
  '기타':     { badge: 'bg-purple-100 text-purple-700', color: '#8b5cf6' },
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

  // 학교행사
  const [showSchoolEventForm, setShowSchoolEventForm] = useState(false)
  const [schoolEventTitle,    setSchoolEventTitle]    = useState('')
  const [schoolEventContent,  setSchoolEventContent]  = useState('')
  const [schoolEventDate,     setSchoolEventDate]     = useState('')
  const [schoolEventGrade,    setSchoolEventGrade]    = useState<number | null>(null)

  // 알림
  const [notifications,    setNotifications]    = useState<any[]>([])
  const [showNotifications,setShowNotifications]= useState(false)
  const [notifTab,         setNotifTab]         = useState<'active'|'held'>('active')

  // 날짜 선택 대기
  const [pendingPostId,  setPendingPostId]  = useState<string | null>(null)
  const pendingPostTitleRef   = useRef<string | null>(null)
  const pendingNotifIdRef     = useRef<string | null>(null)
  const pendingDefaultDateRef = useRef<string | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pickerDate,     setPickerDate]     = useState('')

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
      if (showReplyForm)       { setShowReplyForm(false); setReplyContent(''); return }
      if (showSentMessages)    { setShowSentMessages(false); return }
      if (showMsgInbox)        { setShowMsgInbox(false); return }
      if (showMsgForm)         { setShowMsgForm(false); setMsgContent(''); return }
      if (showTeacherPicker)   { setShowTeacherPicker(false); return }
      if (showTeacherForm)     { setShowTeacherForm(false); resetTeacherForm(); return }
      if (showSchoolEventForm) { setShowSchoolEventForm(false); return }
      if (showDatePicker)      { cancelDatePicker(); return }
      if (showAddForm)         { setShowAddForm(false); return }
      if (showDatePopup)       { closeDatePopup(); return }
      if (showNotifications)   { setShowNotifications(false); return }
    }
    window.addEventListener('popstate', handle)
    return () => window.removeEventListener('popstate', handle)
  }, [showReplyForm, showSentMessages, showMsgInbox, showMsgForm, showTeacherPicker, showTeacherForm,
      showSchoolEventForm, showDatePicker, showAddForm, showDatePopup, showNotifications])

  useEffect(() => { if (showNotifications)   pushHistory() }, [showNotifications])
  useEffect(() => { if (showDatePopup)        pushHistory() }, [showDatePopup])
  useEffect(() => { if (showAddForm)          pushHistory() }, [showAddForm])
  useEffect(() => { if (showDatePicker)       pushHistory() }, [showDatePicker])
  useEffect(() => { if (showSchoolEventForm)  pushHistory() }, [showSchoolEventForm])
  useEffect(() => { if (showTeacherForm)      pushHistory() }, [showTeacherForm])
  useEffect(() => { if (showTeacherPicker)    pushHistory() }, [showTeacherPicker])
  useEffect(() => { if (showMsgForm)          pushHistory() }, [showMsgForm])
  useEffect(() => { if (showMsgInbox)         pushHistory() }, [showMsgInbox])
  useEffect(() => { if (showSentMessages)     pushHistory() }, [showSentMessages])
  useEffect(() => { if (showReplyForm)        pushHistory() }, [showReplyForm])
  // ──────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.removeAllChannels()
    const init = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) { await supabase.auth.signOut(); return }
      const cu = data.user
      if (!cu) return
      setUser(cu)

      await supabase.from('users').upsert({ id: cu.id, name: cu.user_metadata.full_name })
      const { data: ud } = await supabase.from('users').select('role, grade').eq('id', cu.id).single()

      const admin   = ud?.role === 'admin'
      const teacher = ud?.role === 'teacher'
      setIsAdmin(admin)
      setIsTeacher(teacher)

      await loadTeachers()

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
    // 새 유저 알림 자동 생성
    const { data: missed } = await supabase.from('posts').select('id')
      .eq('status','approved').eq('is_user_generated',true)
      .or(`grade.is.null,grade.eq.${grade}`).neq('created_by', uid)
    if (missed?.length)
      await supabase.from('notifications')
        .upsert(missed.map(p => ({ user_id: uid, post_id: p.id, is_read: false })), { onConflict: 'user_id,post_id' })

    // 새 유저 학교행사 자동 추가
    const { data: school } = await supabase.from('posts').select('id, default_date')
      .eq('status','approved').eq('category','학교행사').or(`grade.is.null,grade.eq.${grade}`)
    if (school?.length)
      await supabase.from('user_calendar')
        .upsert(school.map(p => ({ user_id: uid, post_id: p.id, assigned_date: p.default_date })), { onConflict: 'user_id,post_id' })

    const { data: cal } = await supabase
      .from('user_calendar').select('assigned_date, posts(id,title,content,category)').eq('user_id', uid)
    setEvents((cal||[]).map((item:any) => ({
      id: item.posts.id, title: item.posts.title, content: item.posts.content,
      category: item.posts.category, date: item.assigned_date,
      color: getCategoryColor(item.posts.category),
    })))

    const { data: notifData } = await supabase.from('notifications')
      .select('*, posts(id,title,content,default_date,category)')
      .eq('user_id', uid).neq('status','dismissed').neq('status','accepted')
    setNotifications(notifData || [])

    if (admin) {
      const { data: pending } = await supabase.from('posts').select('*').eq('status','pending')
      setPendingPosts(pending || [])
    }

    // Realtime - 알림
    supabase.channel('notifications-channel')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'notifications', filter:`user_id=eq.${uid}` },
        async (payload) => {
          const { data: n } = await supabase.from('notifications')
            .select('*, posts(id,title,content,default_date,category)').eq('id', payload.new.id).single()
          if (n) setNotifications(prev => [n, ...prev])
        })
      .subscribe()

    // Realtime - 캘린더
    supabase.channel('user-calendar-channel')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'user_calendar', filter:`user_id=eq.${uid}` },
        async (payload) => {
          const { data: p } = await supabase.from('posts')
            .select('id,title,content,category').eq('id', payload.new.post_id).single()
          if (p) setEvents(prev => prev.some(e=>e.id===p.id) ? prev : [...prev, {
            id:p.id, title:p.title, content:p.content, category:p.category,
            date:payload.new.assigned_date, color:getCategoryColor(p.category),
          }])
        })
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

  const loadTeachers = async () => {
    const { data } = await supabase.from('teachers').select('*').order('subject').order('name')
    setTeachers(data || [])
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
        .on('postgres_changes', { event:'UPDATE', schema:'public', table:'messages' },
          async (payload) => {
            if (payload.new.teacher_id === myT.id && payload.new.status === 'approved') {
              const { data: m } = await supabase.from('messages')
                .select('*').eq('id', payload.new.id).single()
              if (m) {
                const { data: s } = await supabase.from('users').select('name').eq('id', m.sender_id).single()
                setMyMessages(prev => [{ ...m, senderName: s?.name ?? '알 수 없음' }, ...prev.filter(x => x.id !== m.id)])
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

      // 답장 왔을 때 Realtime 업데이트
      supabase.channel('messages-sent-channel')
        .on('postgres_changes', { event:'UPDATE', schema:'public', table:'messages' },
          async (payload) => {
            if (payload.new.sender_id === uid) {
              const { data: m } = await supabase.from('messages')
                .select('*, teachers(name,subject)').eq('id', payload.new.id).single()
              if (m) setSentMessages(prev => prev.map(x => x.id === m.id ? m : x))
            }
          })
        .subscribe()
    }
  }

  // ── 선생님 본인 선택 ───────────────────────────────────────────
  const selectMyTeacher = async (t: any) => {
    if (!user) return
    const { error } = await supabase.from('teachers').update({ user_id: user.id }).eq('id', t.id)
    if (error) { alert(error.message); return }
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
    if (!teacherName.trim() || !teacherLocation.trim()) { alert('성함과 위치를 입력해주세요!'); return }
    if (editingTeacher) {
      const { error } = await supabase.from('teachers')
        .update({ name: teacherName.trim(), subject: teacherSubject, location: teacherLocation.trim() }).eq('id', editingTeacher.id)
      if (error) { alert(error.message); return }
    } else {
      const { error } = await supabase.from('teachers')
        .insert({ name: teacherName.trim(), subject: teacherSubject, location: teacherLocation.trim() })
      if (error) { alert(error.message); return }
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
    if (!user || !msgTarget || !msgContent.trim()) { alert('내용을 입력해주세요!'); return }
    // 관리자는 바로 approved, 일반 사용자는 pending
    const status = isAdmin ? 'approved' : 'pending'
    const { error } = await supabase.from('messages').insert({
      sender_id: user.id, teacher_id: msgTarget.id, content: msgContent.trim(), status,
    })
    if (error) { alert(error.message); return }
    setShowMsgForm(false); setMsgContent('')
    if (isAdmin) alert('메시지가 선생님께 바로 전달됐어요!')
    else alert('전송됐어요! 관리자 검토 후 선생님께 전달돼요.')
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
    if (!replyTarget || !replyContent.trim()) { alert('답장 내용을 입력해주세요!'); return }
    const { error } = await supabase.from('messages')
      .update({ reply: replyContent.trim(), reply_read: false }).eq('id', replyTarget.id)
    if (error) { alert(error.message); return }
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
    if (error) { alert(error.message); return }
    setIsTeacher(true)
    setShowGradePicker(false)
    setShowTeacherAuth(false)
    setTeacherAuthPw('')
    setTeacherAuthError('')
    // 선생님 본인 선택 화면으로
    setShowTeacherPicker(true)
  }

  const login  = async () => supabase.auth.signInWithOAuth({ provider:'google', options:{ skipBrowserRedirect:false, queryParams:{ prompt:'select_account' } } })
  const logout = async () => { supabase.removeAllChannels(); await supabase.auth.signOut(); setUser(null); setUserGrade(null) }

  const closeDatePopup = () => {
    setShowDatePopup(false); setSelectedDate(null); setSelectedDateEvents([])
    setShowAddForm(false); setPopupTitle(''); setPopupContent(''); setPopupCategory('수행평가'); setPopupGrade(null)
  }

  const handleDateClick = (date: string) => {
    if (pendingPostId) { setPickerDate(date); return }
    setSelectedDate(date); setSelectedDateEvents(events.filter(e => e.date === date))
    setShowDatePopup(true); setShowAddForm(false); setPopupTitle(''); setPopupContent(''); setPopupCategory('수행평가'); setPopupGrade(null)
  }

  const submitPost = async () => {
    if (!user || !selectedDate || !popupTitle) { alert('제목을 입력해주세요!'); return }
    const targetGrade = isAdmin ? popupGrade : userGrade
    if (!targetGrade) { alert('학년을 선택해주세요!'); return }
    const { data: postData, error } = await supabase.from('posts').insert({
      title:popupTitle, content:popupContent, status:'pending', created_by:user.id,
      default_date:selectedDate, category:popupCategory, grade:targetGrade, is_user_generated:true,
    }).select().single()
    if (error) { alert(error.message); return }
    await supabase.from('user_calendar').insert({ user_id:user.id, post_id:postData.id, assigned_date:selectedDate })
    const ev = { id:postData.id, title:popupTitle, content:popupContent, category:popupCategory, date:selectedDate, color:getCategoryColor(popupCategory) }
    setEvents(prev=>[...prev,ev]); setSelectedDateEvents(prev=>[...prev,ev])
    setShowAddForm(false); setPopupTitle(''); setPopupContent('')
  }

  const submitSchoolEvent = async () => {
    if (!user || !schoolEventTitle || !schoolEventDate) { alert('제목과 날짜를 입력해주세요!'); return }
    const { data: postData, error } = await supabase.from('posts').insert({
      title:schoolEventTitle, content:schoolEventContent, status:'approved', created_by:user.id,
      default_date:schoolEventDate, category:'학교행사', grade:schoolEventGrade, is_user_generated:false,
    }).select().single()
    if (error) { alert(error.message); return }
    let q = supabase.from('users').select('id')
    if (schoolEventGrade) q = q.eq('grade', schoolEventGrade)
    const { data: targetUsers } = await q
    if (targetUsers?.length)
      await supabase.from('user_calendar').insert(targetUsers.map(u=>({ user_id:u.id, post_id:postData.id, assigned_date:schoolEventDate })))
    setShowSchoolEventForm(false); setSchoolEventTitle(''); setSchoolEventContent(''); setSchoolEventDate(''); setSchoolEventGrade(null)
    setEvents(prev=>[...prev,{ id:postData.id, title:schoolEventTitle, content:schoolEventContent, category:'학교행사', date:schoolEventDate, color:getCategoryColor('학교행사') }])
    alert('학교 행사가 추가됐어요!')
  }

  const deleteEvent = async (eventId: string) => {
    if (!user || !confirm('이 일정을 삭제할까요?')) return
    await supabase.from('user_calendar').delete().eq('user_id',user.id).eq('post_id',eventId)
    setEvents(prev=>prev.filter(e=>e.id!==eventId)); setSelectedDateEvents(prev=>prev.filter(e=>e.id!==eventId))
  }

  const acceptNotification = (notif: any) => {
    setPendingPostId(notif.posts.id); pendingPostTitleRef.current=notif.posts.title
    pendingNotifIdRef.current=notif.id; pendingDefaultDateRef.current=notif.posts.default_date
    setPickerDate(notif.posts.default_date||''); setShowNotifications(false); setShowDatePicker(true)
  }

  const confirmDatePicker = async () => {
    if (!user || !pickerDate) { alert('날짜를 선택해주세요!'); return }
    const { error } = await supabase.from('user_calendar')
      .upsert({ user_id:user.id, post_id:pendingPostId!, assigned_date:pickerDate }, { onConflict:'user_id,post_id' })
    if (error) { alert(error.message); return }
    if (pendingNotifIdRef.current)
      await supabase.from('notifications').update({ status:'accepted', is_read:true }).eq('id', pendingNotifIdRef.current)
    setNotifications(prev=>prev.filter(n=>n.id!==pendingNotifIdRef.current))
    setPendingPostId(null); pendingPostTitleRef.current=null; pendingNotifIdRef.current=null; pendingDefaultDateRef.current=null
    setShowDatePicker(false); setPickerDate('')
  }

  const cancelDatePicker = () => {
    setPendingPostId(null); pendingPostTitleRef.current=null; pendingNotifIdRef.current=null; pendingDefaultDateRef.current=null
    setShowDatePicker(false); setPickerDate('')
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
    if (error) { alert(error.message); return }
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
      {!user ? (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6">
          <h1 className="text-2xl font-bold">📅 학교 캘린더</h1>
          <button onClick={login} className="btn px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold w-full max-w-xs shadow-md shadow-blue-200 dark:shadow-blue-900/30">
            Google로 로그인
          </button>
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
                  {isTeacher && myTeacherRow && <span className="text-xs text-emerald-500 font-medium">👩‍🏫 {myTeacherRow.name}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 md:w-full">
                {/* 알림 버튼 - badgeCount는 active만 */}
                <button onClick={() => setShowNotifications(true)}
                  className="btn relative px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm md:flex-1 md:text-center">
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
                    className="btn relative px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm md:flex-1 md:text-center">
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
                    className="btn relative px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm md:flex-1 md:text-center">
                    💬<span className="hidden md:inline ml-1 text-xs">메시지</span>
                    {sentMessages.filter(m => m.reply && !m.reply_read).length > 0 && (
                      <span className="badge-pulse absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                        {sentMessages.filter(m => m.reply && !m.reply_read).length}
                      </span>
                    )}
                  </button>
                )}
                <button onClick={logout} className="btn px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm md:flex-1 md:text-center">로그아웃</button>
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
                  {isAdmin && (
                    <div className="mb-4 p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-bold">🛠 관리자</h2>
                        <button onClick={() => setShowSchoolEventForm(true)}
                          className="btn px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium shadow-sm">
                          + 학교 행사
                        </button>
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

                  <div className="flex gap-2 mb-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">수행평가</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">학교행사</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">기타</span>
                  </div>
                  <Calendar events={events} onDateClick={handleDateClick} pendingPostId={pendingPostId} />
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

      {/* 학교행사 추가 */}
      {showSchoolEventForm && (
        <div className={overlayClass}>
          <div className={`${sheetClass} max-h-[80vh] overflow-y-auto`}>
            <h3 className="font-bold text-base mb-4">🏫 학교 행사 추가</h3>
            <input placeholder="행사 제목" value={schoolEventTitle} onChange={e=>setSchoolEventTitle(e.target.value)} className={`${INPUT} mb-2`} />
            <textarea placeholder="내용 (선택)" value={schoolEventContent} onChange={e=>setSchoolEventContent(e.target.value)} className={`${INPUT} mb-2`} rows={2} />
            <div className="mb-2">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">날짜</p>
              <input type="date" value={schoolEventDate} onChange={e=>setSchoolEventDate(e.target.value)} className={INPUT} />
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
              <button onClick={()=>setShowSchoolEventForm(false)} className={BTN_GRAY}>취소</button>
              <button onClick={submitSchoolEvent} className={BTN_GREEN}>추가</button>
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
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">기본 날짜: {notif.posts.default_date}</p>
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
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">기본 날짜: {notif.posts.default_date}</p>
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
            {pendingDefaultDateRef.current && (
              <div className="mb-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">추천 날짜</p>
                <button onClick={()=>setPickerDate(pendingDefaultDateRef.current!)}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${pickerDate===pendingDefaultDateRef.current?'bg-blue-500 text-white border-blue-500':'bg-white dark:bg-gray-800 text-blue-500 border-blue-300 dark:border-blue-700'}`}>
                  {pendingDefaultDateRef.current} (기본 날짜)
                </button>
              </div>
            )}
            <div className="mb-4">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">직접 선택</p>
              <input type="date" value={pickerDate} onChange={e=>setPickerDate(e.target.value)} className={INPUT} />
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
                  {selectedDateEvents.map(event => (
                    <div key={event.id} className="card-hover p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${getCategoryBadge(event.category)}`}>{event.category}</span>
                        <p className="font-medium text-sm mt-0.5">{event.title}</p>
                        {event.content && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{event.content}</p>}
                      </div>
                      {event.category !== '학교행사' && (
                        <button onClick={()=>deleteEvent(event.id)}
                          className="shrink-0 text-red-400 text-xs px-2 py-1 rounded-lg bg-red-50 dark:bg-red-900/30">삭제</button>
                      )}
                    </div>
                  ))}
                </div>
            }
            {showAddForm ? (
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
                {isAdmin && (
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
    </div>
  )
}