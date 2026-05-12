// ========================================
// 兔子旅行 — 互动数据模型（点赞 + 收藏）
// 全部走本地 localStorage 闭环
// ========================================

const LIKES_KEY = 'rabbit_travel_likes'
const COLLECTS_KEY = 'rabbit_travel_collects'

/**
 * 获取当前用户 ID
 * ⚠️ getApp() 在函数内部调用，避免模块加载时 App 未初始化
 */
function currentUserId() {
  try {
    const app = getApp()
    return app && app.globalData && app.globalData.userInfo ? app.globalData.userInfo._id : null
  } catch {
    return null
  }
}

const InteractionModel = {

  // ==================== 点赞 ====================

  /** 切换点赞状态，返回 { liked, count } */
  toggleLike(journalId) {
    const list = this._load(LIKES_KEY)
    const userId = currentUserId()
    if (!userId) return { liked: false, count: this._countByJournal(LIKES_KEY, journalId) }

    const idx = list.findIndex((i) => i.journal_id === journalId && i.user_id === userId)
    if (idx >= 0) {
      list.splice(idx, 1)
      this._save(LIKES_KEY, list)
      return { liked: false, count: this._countByJournal(LIKES_KEY, journalId) }
    }

    list.push({ journal_id: journalId, user_id: userId, created_at: Date.now() })
    this._save(LIKES_KEY, list)
    return { liked: true, count: this._countByJournal(LIKES_KEY, journalId) }
  },

  /** 当前用户是否已点赞 */
  isLiked(journalId) {
    const userId = currentUserId()
    if (!userId) return false
    return this._load(LIKES_KEY).some((i) => i.journal_id === journalId && i.user_id === userId)
  },

  /** 游记点赞数（所有用户合计） */
  likeCount(journalId) {
    return this._countByJournal(LIKES_KEY, journalId)
  },

  /** 当前用户点赞过的游记 ID 列表 */
  getLikedJournalIds() {
    const userId = currentUserId()
    if (!userId) return []
    return this._load(LIKES_KEY)
      .filter((i) => i.user_id === userId)
      .map((i) => i.journal_id)
  },

  // ==================== 收藏 ====================

  toggleCollect(journalId) {
    const list = this._load(COLLECTS_KEY)
    const userId = currentUserId()
    if (!userId) return { collected: false, count: this._countByJournal(COLLECTS_KEY, journalId) }

    const idx = list.findIndex((i) => i.journal_id === journalId && i.user_id === userId)
    if (idx >= 0) {
      list.splice(idx, 1)
      this._save(COLLECTS_KEY, list)
      return { collected: false, count: this._countByJournal(COLLECTS_KEY, journalId) }
    }

    list.push({ journal_id: journalId, user_id: userId, created_at: Date.now() })
    this._save(COLLECTS_KEY, list)
    return { collected: true, count: this._countByJournal(COLLECTS_KEY, journalId) }
  },

  isCollected(journalId) {
    const userId = currentUserId()
    if (!userId) return false
    return this._load(COLLECTS_KEY).some((i) => i.journal_id === journalId && i.user_id === userId)
  },

  collectCount(journalId) {
    return this._countByJournal(COLLECTS_KEY, journalId)
  },

  getCollectedJournalIds() {
    const userId = currentUserId()
    if (!userId) return []
    return this._load(COLLECTS_KEY)
      .filter((i) => i.user_id === userId)
      .map((i) => i.journal_id)
  },

  /** 当前用户所有游记的获赞总数 */
  totalLikesReceived(journals) {
    let total = 0
    for (const j of journals || []) {
      total += this._countByJournal(LIKES_KEY, j._id)
    }
    return total
  },

  // ==================== 内部 ====================

  _load(key) {
    try {
      const raw = wx.getStorageSync(key)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  },

  _save(key, data) {
    wx.setStorageSync(key, JSON.stringify(data))
  },

  _countByJournal(key, journalId) {
    return this._load(key).filter((i) => i.journal_id === journalId).length
  },
}

export default InteractionModel
