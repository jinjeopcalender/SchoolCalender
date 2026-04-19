'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Calendar from '@/components/Calendar'

export default function Home() {
  // 불러오기
  const [user, setUser] = useState<any>(null)
  const [posts, setPosts] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])

  // 사용자 일정 등록 기능
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  // 관리자 지정
  const isAdmin = user?.user_metadata?.email === 'jinjeopcalender@gmail.com'
  const [pendingPosts, setPendingPosts] = useState<any[]>([])

  // 시작하자마자 실행

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      const currentUser = data.user

      if (!currentUser) return

      setUser(currentUser)

      await supabase.from('users').upsert({
        id: currentUser.id,
        name: currentUser.user_metadata.full_name,
      })

      const { data: postsData } = await supabase
        .from('posts')
        .select('*')
        .eq('status', 'approved')

      // 내가 거부한 것
      const { data: actions } = await supabase
        .from('user_actions')
        .select('post_id')
        .eq('user_id', currentUser.id)

      // 내가 캘린더에 넣은 것
      const { data: calendar } = await supabase
        .from('user_calendar')
        .select('post_id')
        .eq('user_id', currentUser.id)

      const dismissedIds = actions?.map(a => a.post_id) || []
      const calendarIds = calendar?.map(c => c.post_id) || []

      const filteredPosts = (postsData || []).filter(post => {
        return (
          !dismissedIds.includes(post.id) &&
          !calendarIds.includes(post.id) &&
          post.created_by !== currentUser.id // 🔥 추가
        )
      })

      setPosts(filteredPosts)

      // 캘린더 데이터 가져오기
      const { data: calendarData } = await supabase
        .from('user_calendar')
        .select('assigned_date, posts(title)')
        .eq('user_id', currentUser.id)

      // FullCalendar 형식으로 변환
      const formattedEvents = (calendarData || []).map((item: any) => ({
        title: item.posts.title,
        date: item.assigned_date,
      }))


      // 관리자
      if (currentUser.user_metadata.email === 'jinjeopcalender@gmail.com') {
        const { data } = await supabase
          .from('posts')
          .select('*')
          .eq('status', 'pending')

        setPendingPosts(data || [])
      }

      setEvents(formattedEvents)
    }

    init()
  }, [])

  // 로그인 / 로그아웃 기능

  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
    })
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  // 캘린더 추가 및 거절 기능

  const addToCalendar = async (postId: string) => {
    if (!user) return

    const { data, error } = await supabase
      .from('user_calendar')
      .insert({
        user_id: user.id,
        post_id: postId,
        assigned_date: new Date().toISOString().split('T')[0],
      })

    if (error) {
      console.error(error)
      alert('에러 발생: ' + error.message)
      return
    }

    // 🔥 이 줄 추가
    setPosts(prev => prev.filter(p => p.id !== postId))

    alert('캘린더에 추가됨')
  }

  const dismissPost = async (postId: string) => {
    if (!user) return

    await supabase.from('user_actions').insert({
      user_id: user.id,
      post_id: postId,
      action: 'dismissed',
    })

    // 🔥 추가
    setPosts(prev => prev.filter(p => p.id !== postId))

    alert('다시 보지 않음')
  }

  // 사용자 입력 함수

  const submitPost = async () => {
    if (!user) return

    // 1️⃣ posts에 저장
    const { data: postData, error } = await supabase
      .from('posts')
      .insert({
        title,
        content,
        status: 'pending',
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      alert(error.message)
      return
    }

    // 2️⃣ 내 캘린더에 자동 추가 🔥
    await supabase.from('user_calendar').insert({
      user_id: user.id,
      post_id: postData.id,
      assigned_date: new Date().toISOString().split('T')[0],
    })

    setEvents(prev => [
      ...prev,
      {
        title,
        date: new Date().toISOString().split('T')[0],
      }
    ])

    alert('내 캘린더에 추가됨 + 승인 대기')

    setTitle('')
    setContent('')
  }

  // 관리자 승인/거절
  const approvePost = async (postId: string) => {
    const { error } = await supabase
      .from('posts')
      .update({ status: 'approved' })
      .eq('id', postId)

    if (error) {
      alert(error.message)
      return
    }

    // 🔥 pending 목록에서 제거
    setPendingPosts(prev => prev.filter(p => p.id !== postId))

    // 🔥 posts 목록에도 추가 (핵심)
    const approvedPost = pendingPosts.find(p => p.id === postId)
    if (approvedPost && approvedPost.created_by !== user.id) {
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

          {isAdmin && (
            <div className="mt-10 p-4 border rounded">
              <h2 className="text-xl font-bold">🛠 관리자 승인</h2>

              {pendingPosts.map((post) => (
                <div key={post.id} className="p-3 border mt-2 rounded">
                  <p>{post.title}</p>
                  <p className="text-sm">{post.content}</p>

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

          <h2 className="mt-6 text-xl font-bold">📌 일정 목록</h2>

          {posts.map((post) => (
            <div key={post.id} className="p-3 border mt-2 rounded">
              <p>{post.title}</p>
              <p className="text-sm text-gray-500">{post.content}</p>

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

          <div className="mt-8 p-4 border rounded">
            <h3 className="font-bold mb-2">📤 일정 제안하기</h3>

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

            <button
              onClick={submitPost}
              className="px-4 py-2 bg-green-500 text-white rounded"
            >
              제출
            </button>
          </div>
        </>
      )}
    </div>
  )
}