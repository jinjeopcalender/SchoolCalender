'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Calendar from '@/components/Calendar'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [pendingPosts, setPendingPosts] = useState<any[]>([])

  // 내 일정 추가 팝업
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [popupTitle, setPopupTitle] = useState('')
  const [popupContent, setPopupContent] = useState('')

  // 알림 시스템
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  // 날짜 선택 대기 중인 일정
  const [pendingPostId, setPendingPostId] = useState<string | null>(null)
  const [pendingPostTitle, setPendingPostTitle] = useState<string | null>(null)
  const [pendingNotifId, setPendingNotifId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data, error } = await supabase.auth.getUser()

      if (error) {
        await supabase.auth.signOut()
        return
      }

      const currentUser = data.user
      if (!currentUser) return

      setUser(currentUser)

      await supabase.from('users').upsert({
        id: currentUser.id,
        name: currentUser.user_metadata.full_name,
      })

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', currentUser.id)
        .single()

      setIsAdmin(userData?.role === 'admin')

      // 캘린더 데이터
      const { data: calendarData } = await supabase
        .from('user_calendar')
        .select('assigned_date, posts(title)')
        .eq('user_id', currentUser.id)

      const formattedEvents = (calendarData || []).map((item: any) => ({
        title: item.posts.title,
        date: item.assigned_date,
      }))

      setEvents(formattedEvents)

      // 알림 조회 (dismissed 제외 — pending, held 모두 가져옴)
      const { data: notifData } = await supabase
        .from('notifications')
        .select('*, posts(id, title, content, default_date)')
        .eq('user_id', currentUser.id)
        .neq('status', 'dismissed')
        .neq('status', 'accepted')

      setNotifications(notifData || [])

      // 관리자 pending 목록
      if (userData?.role === 'admin') {
        const { data: pending } = await supabase
          .from('posts')
          .select('*')
          .eq('status', 'pending')

        setPendingPosts(pending || [])
      }
    }

    init()
  }, [])

  const login = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' })
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const handleDateClick = (date: string) => {
    if (pendingPostId) {
      addNotificationToCalendar(pendingPostId, date)
      return
    }
    setSelectedDate(date)
    setPopupTitle('')
    setPopupContent('')
  }

  const submitPost = async () => {
    if (!user || !selectedDate) return
    if (!popupTitle) {
      alert('제목을 입력해주세요!')
      return
    }

    const { data: postData, error } = await supabase
      .from('posts')
      .insert({
        title: popupTitle,
        content: popupContent,
        status: 'pending',
        created_by: user.id,
        default_date: selectedDate,
      })
      .select()
      .single()

    if (error) {
      alert(error.message)
      return
    }

    await supabase.from('user_calendar').insert({
      user_id: user.id,
      post_id: postData.id,
      assigned_date: selectedDate,
    })

    setEvents(prev => [...prev, { title: popupTitle, date: selectedDate }])
    setSelectedDate(null)
    alert('내 캘린더에 추가됨!')
  }

  // '일정에 추가' → 날짜 선택 모드 진입
  const acceptNotification = (notif: any) => {
    setPendingPostId(notif.posts.id)
    setPendingPostTitle(notif.posts.title)
    setPendingNotifId(notif.id)
    setShowNotifications(false)
  }

  // 날짜 선택 완료 → 캘린더에 저장
  const addNotificationToCalendar = async (postId: string, date: string) => {
    if (!user) return

    const { error } = await supabase
      .from('user_calendar')
      .upsert(
        {
          user_id: user.id,
          post_id: postId,
          assigned_date: date,
        },
        { onConflict: 'user_id,post_id' }
      )

    if (error) {
      alert('에러: ' + error.message)
      return
    }

    // 알림 accepted 처리
    if (pendingNotifId) {
      await supabase
        .from('notifications')
        .update({ status: 'accepted', is_read: true })
        .eq('id', pendingNotifId)
    }

    setEvents(prev => [...prev, { title: pendingPostTitle, date }])
    setNotifications(prev => prev.filter(n => n.id !== pendingNotifId))
    setPendingPostId(null)
    setPendingPostTitle(null)
    setPendingNotifId(null)
    alert('캘린더에 추가됐어요!')
  }

  // 날짜 선택 취소 → 알림 목록으로 돌아감 (알림 유지)
  const cancelDateSelection = () => {
    setPendingPostId(null)
    setPendingPostTitle(null)
    setPendingNotifId(null)
  }

  // '보류' → held 상태로 저장, 알림함에서 언제든 다시 확인 가능
  const holdNotification = async (notif: any) => {
    await supabase
      .from('notifications')
      .update({ status: 'held' })
      .eq('id', notif.id)

    setNotifications(prev =>
      prev.map(n => n.id === notif.id ? { ...n, status: 'held' } : n)
    )
  }

  // '수락 안 함' → dismissed
  const dismissNotification = async (notif: any) => {
    await supabase
      .from('notifications')
      .update({ status: 'dismissed', is_read: true })
      .eq('id', notif.id)

    await supabase.from('user_actions').insert({
      user_id: user.id,
      post_id: notif.posts.id,
      action: 'dismissed',
    })

    setNotifications(prev => prev.filter(n => n.id !== notif.id))
  }

  const approvePost = async (postId: string) => {
    const { error } = await supabase
      .from('posts')
      .update({ status: 'approved' })
      .eq('id', postId)

    if (error) {
      alert(error.message)
      return
    }

    setPendingPosts(prev => prev.filter(p => p.id !== postId))
  }

  const rejectPost = async (postId: string) => {
    await supabase
      .from('posts')
      .update({ status: 'rejected' })
      .eq('id', postId)

    setPendingPosts(prev => prev.filter(p => p.id !== postId))
  }

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] ?? ''

  const activeNotifications = notifications.filter(n => n.status === 'pending')
  const heldNotifications = notifications.filter(n => n.status === 'held')

  return (
    <div className="px-3 py-4 max-w-lg mx-auto">
      {!user ? (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <h1 className="text-2xl font-bold">📅 학교 캘린더</h1>
          <button
            onClick={login}
            className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium text-base"
          >
            Google로 로그인
          </button>
        </div>
      ) : (
        <>
          {/* 상단 헤더 */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold truncate max-w-[120px]">
              {displayName}
              {isAdmin && <span className="ml-1 text-xs text-blue-500">(관리자)</span>}
            </p>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowNotifications(true)}
                className="relative px-3 py-1.5 bg-gray-100 rounded-lg text-sm"
              >
                🔔
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {notifications.length}
                  </span>
                )}
              </button>
              <button
                onClick={logout}
                className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm"
              >
                로그아웃
              </button>
            </div>
          </div>

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
                      <button
                        onClick={() => approvePost(post.id)}
                        className="flex-1 py-1.5 bg-green-500 text-white rounded-lg text-sm"
                      >
                        승인
                      </button>
                      <button
                        onClick={() => rejectPost(post.id)}
                        className="flex-1 py-1.5 bg-red-500 text-white rounded-lg text-sm"
                      >
                        거절
                      </button>
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
                <strong className="block truncate">"{pendingPostTitle}"</strong>
                추가할 날짜를 캘린더에서 선택해주세요
              </p>
              <button
                onClick={cancelDateSelection}
                className="mt-1 text-xs text-gray-400 underline"
              >
                취소 (알림으로 돌아가기)
              </button>
            </div>
          )}

          {/* 캘린더 */}
          <Calendar
            events={events}
            onDateClick={handleDateClick}
            pendingPostId={pendingPostId}
          />

          {/* 알림 팝업 */}
          {showNotifications && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
              <div className="bg-white text-gray-900 rounded-t-2xl p-5 w-full max-h-[75vh] overflow-y-auto">
                <h3 className="font-bold text-base mb-3">🔔 알림</h3>

                {activeNotifications.length === 0 && heldNotifications.length === 0 ? (
                  <p className="text-gray-400 text-sm">새 알림이 없어요</p>
                ) : (
                  <>
                    {/* 새 알림 */}
                    {activeNotifications.map((notif) => (
                      <div key={notif.id} className="p-3 border rounded-xl mt-2">
                        <p className="font-medium text-sm">{notif.posts.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{notif.posts.content}</p>
                        <p className="text-xs text-gray-400 mt-0.5">기본 날짜: {notif.posts.default_date}</p>
                        <div className="flex flex-col gap-1.5 mt-2">
                          <button
                            onClick={() => acceptNotification(notif)}
                            className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm font-medium"
                          >
                            📅 일정에 추가
                          </button>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => holdNotification(notif)}
                              className="flex-1 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-sm"
                            >
                              ⏸ 보류
                            </button>
                            <button
                              onClick={() => dismissNotification(notif)}
                              className="flex-1 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-sm"
                            >
                              ✕ 수락 안 함
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* 보류된 알림 */}
                    {heldNotifications.length > 0 && (
                      <>
                        <p className="text-xs text-gray-400 mt-4 mb-1 font-medium">⏸ 보류된 알림</p>
                        {heldNotifications.map((notif) => (
                          <div key={notif.id} className="p-3 border border-yellow-200 bg-yellow-50 rounded-xl mt-2">
                            <p className="font-medium text-sm text-gray-800">{notif.posts.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{notif.posts.content}</p>
                            <p className="text-xs text-gray-400 mt-0.5">기본 날짜: {notif.posts.default_date}</p>
                            <div className="flex flex-col gap-1.5 mt-2">
                              <button
                                onClick={() => acceptNotification(notif)}
                                className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm font-medium"
                              >
                                📅 일정에 추가
                              </button>
                              <button
                                onClick={() => dismissNotification(notif)}
                                className="w-full py-1.5 bg-gray-200 text-gray-600 rounded-lg text-sm"
                              >
                                ✕ 수락 안 함
                              </button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}

                <button
                  onClick={() => setShowNotifications(false)}
                  className="mt-4 w-full py-2.5 bg-gray-100 rounded-xl text-sm"
                >
                  닫기
                </button>
              </div>
            </div>
          )}

          {/* 내 일정 추가 팝업 */}
          {selectedDate && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
              <div className="bg-white text-gray-900 rounded-t-2xl p-5 w-full">
                <h3 className="font-bold text-base mb-4">📅 {selectedDate} 일정 추가</h3>

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
                  className="border p-2.5 w-full mb-4 rounded-xl text-sm"
                  rows={3}
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="flex-1 py-2.5 bg-gray-200 rounded-xl text-sm"
                  >
                    취소
                  </button>
                  <button
                    onClick={submitPost}
                    className="flex-1 py-2.5 bg-green-500 text-white rounded-xl text-sm font-medium"
                  >
                    저장
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
