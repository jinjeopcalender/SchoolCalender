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

  useEffect(() => {
    // 채널 중복 방지
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

      // 관리자 pending 목록
      if (admin) {
        const { data: pending } = await supabase
          .from('posts').select('*').eq('status', 'pending')
        setPendingPosts(pending || [])
      }

      // ── Realtime 구독 ──────────────────────────────

      // 새 알림 수신
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
          if (notif) {
            setNotifications(prev => [notif, ...prev])
          }
        })
        .subscribe()

      // 관리자: 새 pending 게시글 실시간 반영
      if (admin) {
        supabase
          .channel('posts-channel')
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'posts',
          }, (payload) => {
            if (payload.new.status === 'pending') {
              setPendingPosts(prev => [payload.new, ...prev])
            }
          })
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'posts',
          }, (payload) => {
            if (payload.new.status !== 'pending') {
              setPendingPosts(prev => prev.filter(p => p.id !== payload.new.id))
            }
          })
          .subscribe()
      }
    }

    init()

    return () => {
      supabase.removeAllChannels()
    }
  }, [])

  const login = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' })
  }

  const logout = async () => {
    supabase.removeAllChannels()
    await supabase.auth.signOut()
    setUser(null)
  }

  // 날짜 팝업 닫기 (상태 초기화 포함)
  const closeDatePopup = () => {
    setShowDatePopup(false)
    setSelectedDate(null)
    setSelectedDateEvents([])
    setShowAddForm(false)
    setPopupTitle('')
    setPopupContent('')
  }

  // 날짜 클릭
  const handleDateClick = (date: string) => {
    if (pendingPostId) {
      addNotificationToCalendar(pendingPostId, date)
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
    // 팝업은 유지 (추가된 일정 바로 확인 가능)
  }

  // '일정에 추가' → 날짜 선택 모드
  const acceptNotification = (notif: any) => {
    setPendingPostId(notif.posts.id)
    pendingPostTitleRef.current = notif.posts.title
    pendingNotifIdRef.current = notif.id
    setShowNotifications(false)
  }

  // 날짜 선택 완료 → 캘린더에 저장
  const addNotificationToCalendar = async (postId: string, date: string) => {
    if (!user) return

    const { error } = await supabase
      .from('user_calendar')
      .upsert(
        { user_id: user.id, post_id: postId, assigned_date: date },
        { onConflict: 'user_id,post_id' }
      )

    if (error) { alert('에러: ' + error.message); return }

    const notifId = pendingNotifIdRef.current
    const postTitle = pendingPostTitleRef.current

    if (notifId) {
      await supabase
        .from('notifications')
        .update({ status: 'accepted', is_read: true })
        .eq('id', notifId)
    }

    setEvents(prev => [...prev, { id: postId, title: postTitle, date }])
    setNotifications(prev => prev.filter(n => n.id !== notifId))
    setPendingPostId(null)
    pendingPostTitleRef.current = null
    pendingNotifIdRef.current = null
    alert('캘린더에 추가됐어요!')
  }

  // 날짜 선택 취소 → 알림 유지
  const cancelDateSelection = () => {
    setPendingPostId(null)
    pendingPostTitleRef.current = null
    pendingNotifIdRef.current = null
  }

  // 보류
  const holdNotification = async (notif: any) => {
    await supabase.from('notifications').update({ status: 'held' }).eq('id', notif.id)
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, status: 'held' } : n))
  }

  // 수락 안 함
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
                {/* 관리자 승인 패널 */}
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

                {/* 날짜 선택 대기 안내 */}
                {pendingPostId && (
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-blue-700 text-sm">
                      <strong className="block truncate">"{pendingPostTitleRef.current}"</strong>
                      추가할 날짜를 캘린더에서 선택해주세요
                    </p>
                    <button onClick={cancelDateSelection} className="mt-1 text-xs text-gray-400 underline">
                      취소 (알림으로 돌아가기)
                    </button>
                  </div>
                )}

                {/* 캘린더 */}
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

          {/* 하단 탭 네비게이션 */}
          <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto border-t bg-white flex">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs ${activeTab === 'calendar' ? 'text-blue-500' : 'text-gray-400'}`}
            >
              <span className="text-xl">📅</span>
              캘린더
            </button>
            <button
              onClick={() => setActiveTab('teacher')}
              className={`flex-1 py-3 flex flex-col items-center gap-0.5 text-xs ${activeTab === 'teacher' ? 'text-blue-500' : 'text-gray-400'}`}
            >
              <span className="text-xl">🏫</span>
              선생님 위치
            </button>
          </div>

          {/* 알림 팝업 */}
          {showNotifications && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
              <div className="bg-white text-gray-900 rounded-t-2xl p-5 w-full max-w-lg max-h-[75vh] overflow-y-auto">
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
                              <button onClick={() => dismissNotification(notif)} className="w-full py-1.5 bg-gray-200 text-gray-600 rounded-lg text-sm">
                                ✕ 수락 안 함
                              </button>
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

          {/* 날짜 클릭 팝업 */}
          {showDatePopup && selectedDate && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
              <div className="bg-white text-gray-900 rounded-t-2xl p-5 w-full max-w-lg max-h-[75vh] overflow-y-auto">
                <h3 className="font-bold text-base mb-3">📅 {selectedDate}</h3>

                {selectedDateEvents.length === 0 ? (
                  <p className="text-sm text-gray-400 mb-3">이날 일정이 없어요</p>
                ) : (
                  <div className="mb-3 flex flex-col gap-2">
                    {selectedDateEvents.map((event, i) => (
                      <div key={i} className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                        <p className="font-medium text-sm text-blue-800">{event.title}</p>
                        {event.content && <p className="text-xs text-blue-600 mt-0.5">{event.content}</p>}
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