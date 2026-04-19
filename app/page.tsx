'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Calendar from '@/components/Calendar'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
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

  // 날짜 선택 대기 중인 일정 (알림에서 선택한 것)
  const [pendingPostId, setPendingPostId] = useState<string | null>(null)
  const [pendingPostTitle, setPendingPostTitle] = useState<string | null>(null)

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

      // role 조회
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', currentUser.id)
        .single()

      setIsAdmin(userData?.role === 'admin')

      // approved 게시글 조회
      const { data: postsData } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'approved')

      const { data: actions } = await supabase
        .from('user_actions')
        .select('post_id')
        .eq('user_id', currentUser.id)

      const { data: calendar } = await supabase
        .from('user_calendar')
        .select('post_id')
        .eq('user_id', currentUser.id)

      const dismissedIds = actions?.map(a => a.post_id) || []
      const calendarIds = calendar?.map(c => c.post_id) || []

      const filteredPosts = (postsData || []).filter(post =>
        !dismissedIds.includes(post.id) &&
        !calendarIds.includes(post.id) &&
        post.created_by !== currentUser.id
      )

      setPosts(filteredPosts)

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

      // 알림 조회 (unread만)
      const { data: notifData } = await supabase
        .from('notifications')
        .select('*, posts(id, title, content, default_date)')
        .eq('user_id', currentUser.id)
        .eq('is_read', false)

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

  // 내 일정 추가 - 캘린더 날짜 클릭
  const handleDateClick = (date: string) => {
    // 알림에서 일정 선택 후 날짜 고르는 중이면
    if (pendingPostId) {
      addNotificationToCalendar(pendingPostId, date)
      return
    }
    // 일반 일정 추가
    setSelectedDate(date)
    setPopupTitle('')
    setPopupContent('')
  }

  // 내 일정 저장
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

  // 알림에서 일정 선택 → 날짜 선택 대기 모드
  const selectNotificationPost = (notif: any) => {
    setPendingPostId(notif.posts.id)
    setPendingPostTitle(notif.posts.title)
    setShowNotifications(false)
    // 알림 읽음 처리
    supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notif.id)
      .then(() => {
        setNotifications(prev => prev.filter(n => n.id !== notif.id))
      })
  }

  // 날짜 선택 후 캘린더에 저장
  const addNotificationToCalendar = async (postId: string, date: string) => {
    if (!user) return

    const { error } = await supabase
      .from('user_calendar')
      .insert({
        user_id: user.id,
        post_id: postId,
        assigned_date: date,
      })

    if (error) {
      alert('에러: ' + error.message)
      return
    }

    setEvents(prev => [...prev, { title: pendingPostTitle, date }])
    setPosts(prev => prev.filter(p => p.id !== postId))
    setPendingPostId(null)
    setPendingPostTitle(null)
    alert('캘린더에 추가됨!')
  }

  // 알림 일정 거부
  const dismissNotification = async (notif: any) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
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

  return (
    <div className="p-6">
      {!user ? (
        <button onClick={login}>로그인</button>
      ) : (
        <>
          {/* 상단 헤더 */}
          <div className="flex items-center justify-between">
            <p>{user.user_metadata.full_name}({isAdmin ? '관리자' : ''})님</p>

            <div className="flex items-center gap-4">
              {/* 알림 배지 */}
              <button
                onClick={() => setShowNotifications(true)}
                className="relative px-3 py-1 bg-gray-100 rounded"
              >
                🔔 알림
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>

              <button onClick={logout}>로그아웃</button>
            </div>
          </div>

          {/* 관리자 승인 패널 */}
          {isAdmin && (
            <div className="mt-10 p-4 border rounded">
              <h2 className="text-xl font-bold">🛠 관리자 승인</h2>

              {pendingPosts.length === 0 && (
                <p className="text-sm text-gray-400 mt-2">대기 중인 일정이 없어요</p>
              )}

              {pendingPosts.map((post) => (
                <div key={post.id} className="p-3 border mt-2 rounded">
                  <p>{post.title}</p>
                  <p className="text-sm">{post.content}</p>
                  <p className="text-sm text-gray-400">날짜: {post.default_date}</p>

                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => approvePost(post.id)}
                      className="px-3 py-1 bg-green-500 text-white rounded"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => rejectPost(post.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded"
                    >
                      거절
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 날짜 선택 대기 중 안내 */}
          {pendingPostId && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded flex items-center justify-between">
              <p className="text-blue-700">
                <strong>"{pendingPostTitle}"</strong> 일정을 추가할 날짜를 캘린더에서 선택해주세요
              </p>
              <button
                onClick={() => { setPendingPostId(null); setPendingPostTitle(null) }}
                className="text-gray-400 text-sm ml-4"
              >
                취소
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
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
                <h3 className="font-bold text-lg mb-4">🔔 새 일정 알림</h3>

                {notifications.length === 0 ? (
                  <p className="text-gray-400 text-sm">새 알림이 없어요</p>
                ) : (
                  notifications.map((notif) => (
                    <div key={notif.id} className="p-3 border rounded mt-2">
                      <p className="font-medium">{notif.posts.title}</p>
                      <p className="text-sm text-gray-500">{notif.posts.content}</p>
                      <p className="text-sm text-gray-400">기본 날짜: {notif.posts.default_date}</p>

                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => selectNotificationPost(notif)}
                          className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
                        >
                          날짜 선택해서 추가
                        </button>
                        <button
                          onClick={() => dismissNotification(notif)}
                          className="px-3 py-1 bg-gray-200 rounded text-sm"
                        >
                          거부
                        </button>
                      </div>
                    </div>
                  ))
                )}

                <button
                  onClick={() => setShowNotifications(false)}
                  className="mt-4 w-full py-2 bg-gray-100 rounded"
                >
                  닫기
                </button>
              </div>
            </div>
          )}

          {/* 내 일정 추가 팝업 */}
          {selectedDate && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-96">
                <h3 className="font-bold text-lg mb-4">📅 {selectedDate} 일정 추가</h3>

                <input
                  placeholder="제목"
                  value={popupTitle}
                  onChange={(e) => setPopupTitle(e.target.value)}
                  className="border p-2 w-full mb-2 rounded"
                />

                <textarea
                  placeholder="내용 (선택)"
                  value={popupContent}
                  onChange={(e) => setPopupContent(e.target.value)}
                  className="border p-2 w-full mb-4 rounded"
                />

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="px-4 py-2 bg-gray-200 rounded"
                  >
                    취소
                  </button>
                  <button
                    onClick={submitPost}
                    className="px-4 py-2 bg-green-500 text-white rounded"
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
