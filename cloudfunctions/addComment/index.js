const cloud = require('wx-server-sdk')
cloud.init({ env: 'cloudbase-0gx2xhccf8b7742d' })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext()
    const { journalId, targetType = 'journal', photoId, content, authorName, authorAvatar } = event

    if (!content || !content.trim()) {
      return { code: -1, message: '评论内容不能为空' }
    }

    const comment = {
      journal_id: journalId,
      photo_id: photoId || null,
      target_type: targetType,
      openid: OPENID,
      author_name: authorName || '旅行者',
      author_avatar: authorAvatar || '',
      content: content.trim(),
      created_at: new Date().toISOString()
    }

    const result = await db.collection('comments').add({ data: comment })

    try {
      await db.collection('journals').doc(journalId)
        .update({ data: { comment_count: _.inc(1) } })
    } catch (e) {
      console.warn('[addComment] 更新 comment_count 失败:', e.message)
    }

    return { code: 0, comment: { ...comment, _id: result._id } }
  } catch (e) {
    console.error('[addComment]', e)
    return { code: -1, message: e.message }
  }
}
