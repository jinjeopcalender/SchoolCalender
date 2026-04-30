'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Calendar from '@/components/Calendar'

type Tab = 'calendar' | 'teacher'

export default function Home() {
  const [user, setUser] = useState<any>(null)
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

  // 알림 시스템
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  // 날짜 선택 대기 중인 일정 — ref로 관리해서 클로저 문제 방지
  const [pendingPostId, setPendingPostId] = useState<string | null>(null)
  const pendingPostTitleRef = useRef<string | null>(null)
  const pendingNotifIdRef = useRef<string | null>(null)
  const pendingDefaultDateRef = useRef<string | null>(null)

  // 알림에서 날짜 선택 팝업
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pickerDate, setPickerDate] = useState<string>('')

  useEffect(() => {
    supabase.removeAllChannels()

    const init = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) { await supabase.auth.signOut(); return }
      const currentUser = data.user
      if (!currentUser) return

      setUser(currentUser)

      await supabase.from('users').upsert({
        id: currentUser.id,
        name: currentUser.user_metadata.full_name,
      })

      const { data: userData } = await supabase
        .from('users').select('role').eq('id', currentUser.id).single()

      const admin = userData?.role === 'admin'
      setIsAdmin(admin)

      // 캘린더 데이터
      const { data: calendarData } = await supabase
        .from('user_calendar')
        .select('assigned_date, posts(id, title, content)')
        .eq('user_id', currentUser.id)

      const formattedEvents = (calendarData || []).map((item: any) => ({
        id: item.posts.id,
        title: item.posts.title,
        content: item.posts.content,
        date: item.assigned_date,
      }))
      setEvents(formattedEvents)

      // 알림 조회
      const { data: notifData } = await supabase
        .from('notifications')
        .select('*, posts(id, title, content, default_date)')
        .eq('user_id', currentUser.id)
        .neq('status', 'dismissed')
        .neq('status', 'accepted')
      setNotifications(notifData || [])

      if (admin) {
        const { data: pending } = await supabase
          .from('posts').select('*').eq('status', 'pending')
        setPendingPosts(pending || [])
      }

      // Realtime
      supabase
        .channel('notifications-channel')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`,
        }, async (payload) => {
          const { data: notif } = await supabase
            .from('notifications')
            .select('*, posts(id, title, content, default_date)')
            .eq('id', payload.new.id)
            .single()
          if (notif) setNotifications(prev => [notif, ...prev])
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

    init()
    return () => { supabase.removeAllChannels() }
  }, [])

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        skipBrowserRedirect: false,
        queryParams: { prompt: 'select_account' },
      },
    })
  }

  const logout = async () => {
    supabase.removeAllChannels()
    await supabase.auth.signOut()
    setUser(null)
  }

  const closeDatePopup = () => {
    setShowDatePopup(false)
    setSelectedDate(null)
    setSelectedDateEvents([])
    setShowAddForm(false)
    setPopupTitle('')
    setPopupContent('')
  }

  const handleDateClick = (date: string) => {
    if (pendingPostId) {
      // 날짜 선택 대기 중이면 바로 picker 날짜 업데이트
      setPickerDate(date)
      return
    }
    const dayEvents = events.filter(e => e.date === date)
    setSelectedDate(date)
    setSelectedDateEvents(dayEvents)
    setShowDatePopup(true)
    setShowAddForm(false)
    setPopupTitle('')
    setPopupContent('')
  }

  const submitPost = async () => {
    if (!user || !selectedDate) return
    if (!popupTitle) { alert('제목을 입력해주세요!'); return }

    const { data: postData, error } = await supabase
      .from('posts')
      .insert({
        title: popupTitle,
        content: popupContent,
        status: 'pending',
        created_by: user.id,
        default_date: selectedDate,
      })
      .select().single()

    if (error) { alert(error.message); return }

    await supabase.from('user_calendar').insert({
      user_id: user.id,
      post_id: postData.id,
      assigned_date: selectedDate,
    })

    const newEvent = { id: postData.id, title: popupTitle, content: popupContent, date: selectedDate }
    setEvents(prev => [...prev, newEvent])
    setSelectedDateEvents(prev => [...prev, newEvent])
    setShowAddForm(false)
    setPopupTitle('')
    setPopupContent('')
  }

  // 일정 삭제
  const deleteEvent = async (eventId: string) => {
    if (!user) return
    if (!confirm('이 일정을 삭제할까요?')) return

    await supabase
      .from('user_calendar')
      .delete()
      .eq('user_id', user.id)
      .eq('post_id', eventId)

    setEvents(prev => prev.filter(e => e.id !== eventId))
    setSelectedDateEvents(prev => prev.filter(e => e.id !== eventId))
  }

  // '일정에 추가' → 날짜 선택 팝업
  const acceptNotification = (notif: any) => {
    setPendingPostId(notif.posts.id)
    pendingPostTitleRef.current = notif.posts.title
    pendingNotifIdRef.current = notif.id
    pendingDefaultDateRef.current = notif.posts.default_date
    setPickerDate(notif.posts.default_date || '')
    setShowNotifications(false)
    setShowDatePicker(true)
  }

  // 날짜 확정 → 캘린더에 저장
  const confirmDatePicker = async () => {
    if (!user || !pickerDate) { alert('날짜를 선택해주세요!'); return }

    const postId = pendingPostId!
    const notifId = pendingNotifIdRef.current
    const postTitle = pendingPostTitleRef.current

    const { error } = await supabase
      .from('user_calendar')
      .upsert(
        { user_id: user.id, post_id: postId, assigned_date: pickerDate },
        { onConflict: 'user_id,post_id' }
      )

    if (error) { alert('에러: ' + error.message); return }

    if (notifId) {
      await supabase
        .from('notifications')
        .update({ status: 'accepted', is_read: true })
        .eq('id', notifId)
    }

    setEvents(prev => [...prev, { id: postId, title: postTitle, date: pickerDate }])
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

  // 팝업 공통 오버레이 스타일 (블러)
  const overlayClass = "fixed inset-0 bg-black/30 backdrop-blur-sm flex items-end justify-center z-50"
  const sheetClass = "bg-white text-gray-900 rounded-t-2xl p-5 w-full max-w-lg"

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
          {/* 상단 헤더 */}
          <div className="flex items-center justify-between px-3 py-3 border-b">
            <p className="text-sm font-semibold truncate max-w-[140px]">
              {displayName}
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
                    <h2 className="text-base font-bold mb-2">🛠 관리자 승인</h2>
                    {pendingPosts.length === 0 ? (
                      <p className="text-xs text-gray-400">대기 중인 일정이 없어요</p>
                    ) : (
                      pendingPosts.map((post) => (
                        <div key={post.id} className="p-2 border mt-2 rounded-lg">
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

                <Calendar events={events} onDateClick={handleDateClick} pendingPostId={pendingPostId} />
              </>
            )}

            {activeTab === 'teacher' && (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
                <p className="text-4xl">🏫</p>
                <p className="text-sm font-medium">선생님 위치 안내</p>
                <p className="text-xs">준비 중이에요</p>
              </div>
            )}
          </div>

          {/* 하단 탭 */}
          <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto border-t bg-white flex">
            <button onClick={() => setActiveTab('calendar')} className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs ${activeTab === 'calendar' ? 'text-blue-500' : 'text-gray-400'}`}>
              <span className="text-xl">📅</span>캘린더
            </button>
            <button onClick={() => setActiveTab('teacher')} className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs ${activeTab === 'teacher' ? 'text-blue-500' : 'text-gray-400'}`}>
              <span className="text-xl">🏫</span>선생님 위치
            </button>
          </div>

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
                        <p className="font-medium text-sm">{notif.posts.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{notif.posts.content}</p>
                        <p className="text-xs text-gray-400 mt-0.5">기본 날짜: {notif.posts.default_date}</p>
                        <div className="flex flex-col gap-1.5 mt-2">
                          <button onClick={() => acceptNotification(notif)} className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm font-medium">
                            📅 일정에 추가
                          </button>
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
                            <p className="font-medium text-sm text-gray-800">{notif.posts.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{notif.posts.content}</p>
                            <p className="text-xs text-gray-400 mt-0.5">기본 날짜: {notif.posts.default_date}</p>
                            <div className="flex flex-col gap-1.5 mt-2">
                              <button onClick={() => acceptNotification(notif)} className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm font-medium">
                                📅 일정에 추가
                              </button>
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

          {/* 날짜 선택 팝업 (알림에서 일정 추가 시) */}
          {showDatePicker && (
            <div className={overlayClass}>
              <div className={sheetClass}>
                <h3 className="font-bold text-base mb-1">📅 날짜 선택</h3>
                <p className="text-sm text-gray-500 mb-4 truncate">
                  "{pendingPostTitleRef.current}"
                </p>

                {/* 추천 날짜 버튼 */}
                {pendingDefaultDateRef.current && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-400 mb-1.5">추천 날짜</p>
                    <button
                      onClick={() => setPickerDate(pendingDefaultDateRef.current!)}
                      className={`w-full py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${
                        pickerDate === pendingDefaultDateRef.current
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-white text-blue-500 border-blue-300'
                      }`}
                    >
                      {pendingDefaultDateRef.current} (기본 날짜)
                    </button>
                  </div>
                )}

                {/* 직접 날짜 입력 */}
                <div className="mb-4">
                  <p className="text-xs text-gray-400 mb-1.5">직접 선택</p>
                  <input
                    type="date"
                    value={pickerDate}
                    onChange={(e) => setPickerDate(e.target.value)}
                    className="border p-2.5 w-full rounded-xl text-sm"
                  />
                </div>

                {/* 캘린더에서 선택 안내 */}
                <p className="text-xs text-gray-400 text-center mb-4">
                  또는 뒤 캘린더에서 날짜를 탭해도 선택돼요
                </p>

                <div className="flex gap-2">
                  <button onClick={cancelDatePicker} className="flex-1 py-2.5 bg-gray-200 rounded-xl text-sm">취소</button>
                  <button onClick={confirmDatePicker} className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium">
                    추가
                  </button>
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
                      <div key={event.id} className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-blue-800">{event.title}</p>
                          {event.content && <p className="text-xs text-blue-600 mt-0.5">{event.content}</p>}
                        </div>
                        <button
                          onClick={() => deleteEvent(event.id)}
                          className="shrink-0 text-red-400 text-xs px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {showAddForm ? (
                  <>
                    <input
                      placeholder="제목"
                      value={popupTitle}
                      onChange={(e) => setPopupTitle(e.target.value)}
                      className="border p-2.5 w-full mb-2 rounded-xl text-sm"
                    />
                    <textarea
                      placeholder="내용 (선택)"
                      value={popupContent}
                      onChange={(e) => setPopupContent(e.target.value)}
                      className="border p-2.5 w-full mb-3 rounded-xl text-sm"
                      rows={3}
                    />
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