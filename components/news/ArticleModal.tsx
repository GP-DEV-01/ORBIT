'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import { useLang } from '@/lib/LanguageContext'

interface Article {
  id: string
  headline: string
  summary: string
  source: string
  url: string
  datetime: number
  image: string
  category: string
}

interface Comment {
  id: string
  content: string
  created_at: string
  user_id: string
  user_email?: string
}

interface Props {
  article: Article
  onClose: () => void
}

export default function ArticleModal({ article, onClose }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { userId, userEmail } = useAuth()
  const { t } = useLang()

  useEffect(() => {
    fetchComments()

    // Close on ESC
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [article.url, onClose])

  async function fetchComments() {
    const { data } = await supabase
      .from('news_comments')
      .select('*')
      .eq('article_url', article.url)
      .order('created_at', { ascending: true })
    setComments((data || []) as Comment[])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !newComment.trim()) return
    setSubmitting(true)

    const { data } = await supabase.from('news_comments').insert({
      user_id: userId,
      article_url: article.url,
      article_headline: article.headline,
      content: newComment.trim(),
      user_email: userEmail,
    }).select().single()

    if (data) setComments(prev => [...prev, data as Comment])
    setNewComment('')
    setSubmitting(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('news_comments').delete().eq('id', id)
    setComments(prev => prev.filter(c => c.id !== id))
  }

  function timeAgo(ts: number | string) {
    const d = typeof ts === 'number' ? ts * 1000 : new Date(ts).getTime()
    const diff = Date.now() - d
    const m = Math.floor(diff / 60000)
    const h = Math.floor(m / 60)
    if (m < 60) return `${m}m ago`
    if (h < 24) return `${h}h ago`
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
        zIndex: 1000, display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        className="animate-fadeIn"
        style={{
          width: '560px',
          maxWidth: '100vw',
          height: '100vh',
          background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {article.source}
            </span>
            <span style={{ color: 'var(--border-light)', fontSize: '10px' }}>·</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{timeAgo(article.datetime)}</span>
            <span className="tag" style={{ marginLeft: '4px' }}>{article.category}</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px' }}
          >
            ×
          </button>
        </div>

        {/* Article content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {article.image && (
            <img
              src={article.image}
              alt=""
              style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '6px', marginBottom: '16px' }}
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          )}

          <h2 style={{ fontSize: '17px', fontWeight: '700', lineHeight: '1.4', marginBottom: '12px' }}>
            {article.headline}
          </h2>

          {article.summary && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.65', marginBottom: '16px' }}>
              {article.summary}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', fontSize: '12px' }}
            >
              {t('readFullArticle')}
            </a>

            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.headline)}&url=${encodeURIComponent(article.url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none', fontSize: '12px' }}
            >
              <span style={{ fontWeight: '700' }}>𝕏</span> Share
            </a>

            <a
              href={`https://twitter.com/search?q=${encodeURIComponent(article.headline)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', textDecoration: 'none', fontSize: '12px' }}
            >
              <span style={{ fontWeight: '700' }}>𝕏</span> Search
            </a>
          </div>

          {/* Divider */}
          <div style={{ margin: '24px 0', borderTop: '1px solid var(--border)' }} />

          {/* Comments */}
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: '600', marginBottom: '16px', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
              {t('discussion').toUpperCase()} · {comments.length} {comments.length !== 1 ? t('comments') : t('comment')}
            </h3>

            {comments.length === 0 && (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                {t('noComments')}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              {comments.map(c => (
                <div key={c.id} style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                      {c.user_email ? c.user_email.split('@')[0] : 'User'}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{timeAgo(c.created_at)}</span>
                      {c.user_id === userId && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', padding: '0' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5' }}>{c.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Comment form */}
        {userId ? (
          <form
            onSubmit={handleSubmit}
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              gap: '10px',
              flexShrink: 0,
              background: 'var(--bg-secondary)',
            }}
          >
            <input
              className="input-dark"
              placeholder={t('addComment')}
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              style={{ flex: 1 }}
              maxLength={500}
            />
            <button
              className="btn-primary"
              type="submit"
              disabled={submitting || !newComment.trim()}
              style={{ flexShrink: 0, padding: '9px 16px' }}
            >
              {t('post')}
            </button>
          </form>
        ) : (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('signInDiscuss')}</span>
          </div>
        )}
      </div>
    </div>
  )
}
