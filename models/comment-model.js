// ========================================
// 兔子旅行 — 评论数据模型（本地 localStorage）
// ========================================

const STORAGE_KEY = 'rabbit_travel_comments'

function genId() {
  return 'cmt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
}

const CommentModel = {

  /** 发表评论 */
  add(journalId, content) {
    const app = getApp()
    const user = app.globalData.userInfo || {}
    const comment = {
      _id: genId(),
      journal_id: journalId,
      author_id: user._id || 'guest',
      author_name: user.nickname || '旅行者',
      author_avatar: user.avatar || '',
      content: content.trim(),
      created_at: Date.now(),
    }

    const list = this._load()
    list.unshift(comment)
    this._save(list)
    return comment
  },

  /** 获取游记的全部评论（按时间倒序） */
  getByJournal(journalId) {
    return this._load().filter((c) => c.journal_id === journalId)
  },

  /** 评论数 */
  count(journalId) {
    return this.getByJournal(journalId).length
  },

  /** 删除评论（仅作者可删） */
  delete(commentId) {
    const app = getApp()
    const userId = app.globalData.userInfo?._id
    const list = this._load()
    const idx = list.findIndex((c) => c._id === commentId)
    if (idx === -1) return false

    // 仅评论作者可删
    if (userId && list[idx].author_id === userId) {
      list.splice(idx, 1)
      this._save(list)
      return true
    }
    return false
  },

  _load() {
    try {
      const raw = wx.getStorageSync(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  },

  _save(data) {
    wx.setStorageSync(STORAGE_KEY, JSON.stringify(data))
  },
}

export default CommentModel
