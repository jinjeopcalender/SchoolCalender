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

  // 팝업 상태
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [popupTitle, setPopupTitle] = useState('')
  const [popupContent, setPopupContent] = useState('')

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

  // 캘린더 날짜 클릭 → 팝업 열기
  const handleDateClick = (date: string) => {
    setSelectedDate(date)
    setPopupTitle('')
    setPopupContent('')
  }

  // 팝업에서 내 일정 저장
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

  // 다른 사람 일정 수락 (2단계에서 날짜 선택 추가 예정)
  const addToCalendar = async (postId: string, date: string) => {
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

    setPosts(prev => prev.filter(p => p.id !== postId))
    alert('캘린더에 추가됨!')
  }

  const dismissPost = async (postId: string) => {
    if (!user) return

    await supabase.from('user_actions').insert({
      user_id: user.id,
      post_id: postId,
      action: 'dismissed',
    })

    setPosts(prev => prev.filter(p => p.id !== postId))
    alert('다시 보지 않음')
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

    const approvedPost = pendingPosts.find(p => p.id === postId)
    if (approvedPost && approvedPost.created_by !== user?.id) {
      setPosts(prev => [...prev, approvedPost])
    }
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
          <p>{user.user_metadata.full_name}({isAdmin ? '관리자' : ''})님</p>
          <button onClick={logout}>로그아웃</button>

          {/* 관리자 승인 패널 */}
          {isAdmin && (
            <div className="mt-10 p-4 border rounded">
              <h2 className="text-xl font-bold">🛠 관리자 승인</h2>

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

          {/* 다른 사용자 일정 목록 */}
          <h2 className="mt-6 text-xl font-bold">📌 일정 목록</h2>

          {posts.map((post) => (
            <div key={post.id} className="p-3 border mt-2 rounded">
              <p>{post.title}</p>
              <p className="text-sm text-gray-500">{post.content}</p>
              <p className="text-sm text-gray-400">기본 날짜: {post.default_date}</p>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => addToCalendar(post.id, post.default_date)}
                  className="px-3 py-1 bg-blue-500 text-white rounded"
                >
                  추가
                </button>
                <button
                  onClick={() => dismissPost(post.id)}
                  className="px-3 py-1 bg-gray-300 rounded"
                >
                  거부
                </button>
              </div>
            </div>
          ))}

          {/* 캘린더 */}
          <Calendar events={events} onDateClick={handleDateClick} />

          {/* 날짜 클릭 팝업 */}
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
