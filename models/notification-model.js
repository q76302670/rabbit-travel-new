// ========================================
// 兔子旅行 — 消息通知模型（本地 localStorage）
// 类型: like / collect / comment
// ========================================

const STORAGE_KEY = 'rabbit_travel_notifications'

function genId() {
  return 'ntf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
}

const NotificationModel = {

  /** 创建通知 */
  add(data) {
    if (!data.receiver_id || !data.sender_id) return null
    // 不给自己发通知
    if (data.receiver_id === data.sender_id) return null

    const ntf = {
      _id: genId(),
      receiver_id: data.receiver_id,
      type: data.type,               // like | collect | comment
      sender_id: data.sender_id,
      sender_name: data.sender_name || '',
      target_type: data.target_type, // journal
      target_id: data.target_id,
      target_title: data.target_title || '',
      is_read: false,
      created_at: Date.now(),
    }

    const list = this._load()
    list.unshift(ntf)
    this._save(list)
    return ntf
  },

  /** 获取某用户的通知列表 */
  getByUser(userId) {
    return this._load().filter((n) => n.receiver_id === userId)
  },

  /** 未读数量 */
  unreadCount(userId) {
    return this._load().filter((n) => n.receiver_id === userId && !n.is_read).length
  },

  /** 标记单条已读 */
  markRead(ntfId) {
    const list = this._load()
    const n = list.find((i) => i._id === ntfId)
    if (n) {
      n.is_read = true
      this._save(list)
    }
  },

  /** 标记全部已读 */
  markAllRead(userId) {
    const list = this._load()
    let changed = false
    for (const n of list) {
      if (n.receiver_id === userId && !n.is_read) {
        n.is_read = true
        changed = true
      }
    }
    if (changed) this._save(list)
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

export default NotificationModel
