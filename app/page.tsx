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

  // 내 일정 추가
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [defaultDate, setDefaultDate] = useState('') // 🆕 날짜

  // 다른 사용자 일정 수락 시 날짜
  const [selectedDates, setSelectedDates] = useState<Record<string, string>>({}) // 🆕

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

  // 내 일정 추가 (날짜 포함)
  const submitPost = async () => {
    if (!user) return
    if (!defaultDate) {
      alert('날짜를 선택해주세요!')
      return
    }

    const { data: postData, error } = await supabase
      .from('posts')
      .insert({
        title,
        content,
        status: 'pending',
        created_by: user.id,
        default_date: defaultDate, // 🆕
      })
      .select()
      .single()

    if (error) {
      alert(error.message)
      return
    }

    // 내 캘린더에 자동 추가
    await supabase.from('user_calendar').insert({
      user_id: user.id,
      post_id: postData.id,
      assigned_date: defaultDate, // 🆕 내가 입력한 날짜로 저장
    })

    setEvents(prev => [
      ...prev,
      { title, date: defaultDate },
    ])

    alert('내 캘린더에 추가됨!')
    setTitle('')
    setContent('')
    setDefaultDate('')
  }

  // 다른 사람 일정 수락 (날짜 직접 지정)
  const addToCalendar = async (postId: string) => {
    if (!user) return

    const date = selectedDates[postId]
    if (!date) {
      alert('날짜를 선택해주세요!')
      return
    }

    const { error } = await supabase
      .from('user_calendar')
      .insert({
        user_id: user.id,
        post_id: postId,
        assigned_date: date, // 🆕 내가 선택한 날짜
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

              {/* 🆕 날짜 picker - default_date를 기본값으로 */}
              <input
                type="date"
                value={selectedDates[post.id] || post.default_date || ''}
                onChange={(e) =>
                  setSelectedDates(prev => ({ ...prev, [post.id]: e.target.value }))
                }
                className="border p-2 w-full mt-2"
              />

              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => addToCalendar(post.id)}
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

          <Calendar events={events} />

          {/* 내 일정 추가 */}
          <div className="mt-8 p-4 border rounded">
            <h3 className="font-bold mb-2">📅 내 일정 추가하기</h3>

            <input
              placeholder="제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="border p-2 w-full mb-2"
            />

            <textarea
              placeholder="내용"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="border p-2 w-full mb-2"
            />

            {/* 🆕 날짜 picker */}
            <input
              type="date"
              value={defaultDate}
              onChange={(e) => setDefaultDate(e.target.value)}
              className="border p-2 w-full mb-2"
            />

            <button
              onClick={submitPost}
              className="px-4 py-2 bg-green-500 text-white rounded"
            >
              저장
            </button>
          </div>
        </>
      )}
    </div>
  )
}
