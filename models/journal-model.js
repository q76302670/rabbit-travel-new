// ========================================
// 兔子旅行 — 游记数据模型
// 支持云端（云数据库）和本地（localStorage）双通道
// 当前阶段：云端优先，失败降级本地
// ========================================

const STORAGE_KEY = 'rabbit_travel_journals'
const app = getApp()

function genId() {
  return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

function formatDate() {
  return new Date()
}

const JournalModel = {

  // ==================== 发布相关 ====================

  /** 创建并发布游记 */
  async create(data) {
    const journal = this._buildJournal(data, 'published')
    journal.published_at = formatDate()

    const saved = this._tryCloud('create', journal) || this._saveLocal(journal)
    return saved
  },

  /** 获取已发布的游记列表 */
  async list() {
    const data = this._tryCloud('list', { status: 'published' })
    if (data) return data

    return this._loadLocal()
      .filter((j) => j.status === 'published')
      .map((j) => this._normalize(j))
  },

  /** 获取单篇游记（不限状态） */
  async get(id) {
    const data = this._tryCloud('get', { id })
    if (data) return this._normalize(data)

    const raw = this._getLocal(id)
    return this._normalize(raw)
  },

  /** 按作者获取游记 */
  listByAuthor(authorId) {
    return this._loadLocal()
      .filter((j) => j.author_id === authorId)
      .map((j) => this._normalize(j))
  },

  /** 加载全部原始数据 */
  loadAll() {
    return this._loadLocal().map((j) => this._normalize(j))
  },

  // ==================== 草稿相关 — 云端优先 ====================
  // 全部草稿操作以云端为主链，本地 localStorage 仅做兜底降级

  /** 获取当前登录用户 ID */
  _currentUserId() {
    const app = getApp()
    return app && app.globalData && app.globalData.userInfo ? app.globalData.userInfo._id : null
  },

  /** 校验草稿 ownership */
  _ownDraft(j) {
    const uid = this._currentUserId()
    return uid && j.status === 'draft' && j.author_id === uid
  },

  /** 保存草稿（云端优先，本地兜底）
   *  - 无 draftId：新建云端草稿，返回云端 _id
   *  - 有 draftId：更新已有云端草稿 */
  async saveDraft(data, draftId) {
    const journalData = this._buildJournal(data, 'draft')

    try {
      let cloudPayload = { ...journalData, status: 'draft' }

      if (draftId && typeof draftId === 'string' && !String(draftId).startsWith('local_')) {
        // 已有云端草稿，带上 _id 走更新
        cloudPayload._id = draftId
      } else {
        // 新建草稿 — 去掉本地临时 _id（如 local_xxx），让云端生成
        delete cloudPayload._id
      }

      const result = await this._saveDraftCloud(cloudPayload)

      // 云端成功后同步写本地兜底
      const localCopy = { ...journalData, _id: result._id, cloudId: result._id }
      this._saveLocal(localCopy)

      return { source: 'cloud', _id: result._id }
    } catch (e) {
      console.error('[JournalModel] 云端存草稿失败，降级本地:', e)
      this._saveLocal(journalData)
      return { source: 'local', _id: journalData._id }
    }
  },

  /** 云端保存草稿（内部方法） */
  _saveDraftCloud(data) {
    return new Promise(function(resolve, reject) {
      wx.cloud.callFunction({
        name: 'saveJournal',
        data: { journal: data },
        success: function(res) {
          if (res.result && res.result.code === 0) {
            resolve({ _id: res.result._id })
          } else {
            reject(new Error((res.result && res.result.message) || '云端保存失败'))
          }
        },
        fail: function(err) { reject(err) }
      })
    })
  },

  /** 获取当前用户草稿列表（云端优先，本地兜底） */
  async listDrafts() {
    const uid = this._currentUserId()
    if (!uid) return []

    try {
      const result = await new Promise(function(resolve, reject) {
        wx.cloud.callFunction({
          name: 'getUserJournals',
          data: { type: 'draft' },
          success: function(r) { resolve(r.result) },
          fail: function(err) { reject(err) }
        })
      })
      if (result && result.code === 0) {
        return (result.journals || []).map(function(j) { return this._normalize(j) }.bind(this))
      }
      throw new Error(result ? result.message : '云端加载失败')
    } catch (e) {
      console.warn('[JournalModel] 草稿列表云端加载失败，降级本地:', e)
      return this._loadLocal()
        .filter((j) => this._ownDraft(j))
        .map((j) => this._normalize(j))
    }
  },

  /** 获取单篇草稿（云端优先，本地兜底） */
  async getDraft(id) {
    // 本地临时 ID 直接命中本地
    if (String(id).startsWith('local_')) {
      const j = this._getLocal(id)
      if (!j || !this._ownDraft(j)) return null
      return this._normalize(j)
    }

    try {
      const result = await new Promise(function(resolve, reject) {
        wx.cloud.callFunction({
          name: 'getJournalDetail',
          data: { journalId: id },
          success: function(r) { resolve(r.result) },
          fail: function(err) { reject(err) }
        })
      })
      if (result && result.code === 0 && result.journal && result.journal.status === 'draft') {
        return this._normalize(result.journal)
      }
      throw new Error(result ? result.message : '云端加载失败')
    } catch (e) {
      console.warn('[JournalModel] 草稿云端加载失败，降级本地:', e)
      const j = this._getLocal(id)
      if (!j || !this._ownDraft(j)) return null
      return this._normalize(j)
    }
  },

  /** 删除草稿（云端优先，本地兜底） */
  async deleteDraft(id) {
    var deletedLocal = false
    // 先删本地
    const list = this._loadLocal()
    const newList = list.filter((j) => j._id !== id)
    if (newList.length !== list.length) {
      wx.setStorageSync(STORAGE_KEY, JSON.stringify(newList))
      deletedLocal = true
    }

    // 再删云端
    try {
      await new Promise(function(resolve, reject) {
        wx.cloud.callFunction({
          name: 'deleteJournal',
          data: { journalId: id },
          success: function(r) {
            // 必须检查云端返回的 code — 只有 code===0 才算成功
            if (r.result && r.result.code === 0) {
              resolve(r.result)
            } else {
              reject(new Error((r.result && r.result.message) || '云端删除失败'))
            }
          },
          fail: function(err) { reject(err) }
        })
      })
      return true
    } catch (e) {
      console.warn('[JournalModel] 云端删除失败:', e)
      // 云端删除失败（包括业务错误如无权限），必须向调用方抛出
      // 本地即使已删也会在下次从云端重拉时恢复
      throw e
    }
  },

  /** 草稿 → 发布（云端优先）
   *  将草稿 status 更新为 published，同时回填标题、图片等完整数据 */
  async publishDraft(id) {
    try {
      // 用 saveJournal 更新云端，含 status='published'
      // 先从本地/云端获取草稿数据作为 base
      var base = await this.getDraft(id)
      if (!base) throw new Error('草稿不存在')

      var published = {
        ...base,
        _id: id,
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      await new Promise(function(resolve, reject) {
        wx.cloud.callFunction({
          name: 'saveJournal',
          data: { journal: published },
          success: function(r) {
            if (r.result && r.result.code === 0) resolve(r.result)
            else reject(new Error((r.result && r.result.message) || '发布失败'))
          },
          fail: function(err) { reject(err) }
        })
      })

      // 清理本地草稿
      this._removeLocal(id)
      return { source: 'cloud', _id: id }
    } catch (e) {
      console.error('[JournalModel] 云端发布草稿失败:', e)
      // 降级本地
      const list = this._loadLocal()
      const idx = list.findIndex((j) => j._id === id)
      if (idx === -1) return null
      if (!this._ownDraft(list[idx])) return null

      list[idx].status = 'published'
      list[idx].published_at = new Date().toISOString()
      list[idx].updated_at = new Date().toISOString()
      wx.setStorageSync(STORAGE_KEY, JSON.stringify(list))
      return { source: 'local', _id: id }
    }
  },

  /** 从本地 localStorage 移除指定 ID */
  _removeLocal(id) {
    const list = this._loadLocal()
    const newList = list.filter((j) => j._id !== id)
    wx.setStorageSync(STORAGE_KEY, JSON.stringify(newList))
  },

  // ==================== 内部方法 ====================

  /** 旧 images[] → 新 photos[] 迁移 */
  _migrateToPhotos(data) {
    if (data.photos && data.photos.length > 0) {
      // 已经是新结构
      return data.photos
    }
    // 从旧 images[] 转换
    var oldImages = data.images || []
    if (oldImages.length === 0) return []

    return oldImages.map(function(img, idx) {
      var url = ''
      var caption = ''
      if (typeof img === 'string') {
        url = img
      } else {
        url = img.path || ''
        caption = img.caption || ''
      }
      return {
        _id: 'p_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).slice(2, 6),
        url: url,
        description: caption,
        sort_index: idx
      }
    })
  },

  /** 兼容读取：确保数据含 photos[] 和新字段 */
  _normalize(j) {
    if (!j) return j
    var photos = this._migrateToPhotos(j)
    var startDate = j.start_date || ''
    var endDate = j.end_date || ''
    var tripDays = j.trip_days || 0
    if (!tripDays && startDate && endDate) {
      tripDays = Math.floor((new Date(endDate) - new Date(startDate)) / 86400000) + 1
    }
    return {
      _id: j._id,
      title: j.title || '',
      cover: j.cover || (photos.length > 0 ? photos[0].url : ''),
      author_id: j.author_id || 'guest',
      author_name: j.author_name || '旅行者',
      author_avatar: j.author_avatar || '',
      status: j.status || 'draft',
      destination: j.destination || '',
      description: j.description || '',
      start_date: startDate,
      end_date: endDate,
      trip_days: tripDays,
      like_count: typeof j.like_count === 'number' ? j.like_count : 0,
      collect_count: typeof j.collect_count === 'number' ? j.collect_count : 0,
      comment_count: typeof j.comment_count === 'number' ? j.comment_count : 0,
      photo_count: photos.length,
      photos: photos,
      images: photos.map(function(p) { return p.url }),  // 向下兼容
      created_at: j.created_at || '',
      updated_at: j.updated_at || '',
      published_at: j.published_at || '',
    }
  },

  _buildJournal(data, status) {
    var photos = []
    var rawPhotos = data.photos || []
    if (rawPhotos.length > 0) {
      // 新格式：直接保存
      photos = rawPhotos.map(function(p, idx) {
        return {
          _id: p._id || 'p_' + Date.now() + '_' + idx,
          url: p.url || '',
          description: p.description || '',
          sort_index: typeof p.sort_index === 'number' ? p.sort_index : idx
        }
      })
    } else {
      // 兼容旧 images[]，保存为 photos
      var oldImages = data.images || []
      photos = oldImages.map(function(img, idx) {
        var url = typeof img === 'string' ? img : (img.path || '')
        var caption = typeof img === 'string' ? '' : (img.caption || '')
        return {
          _id: 'p_' + Date.now() + '_' + idx,
          url: url,
          description: caption,
          sort_index: idx
        }
      })
    }

    var startDate = data.start_date || ''
    var endDate = data.end_date || ''
    var tripDays = 0
    if (startDate && endDate) {
      tripDays = Math.floor((new Date(endDate) - new Date(startDate)) / 86400000) + 1
    }

    var journal = {
      _id: genId(),
      title: data.title || '',
      cover: data.cover || (photos.length > 0 ? photos[0].url : ''),
      author_id: data.author_id || 'guest',
      author_name: data.author_name || '旅行者',
      author_avatar: data.author_avatar || '',
      status: status,
      destination: data.destination || '',
      description: data.description || '',
      start_date: startDate,
      end_date: endDate,
      trip_days: tripDays,
      like_count: 0,
      collect_count: 0,
      comment_count: 0,
      photo_count: photos.length,
      photos: photos,
      images: photos.map(function(p) { return p.url }),  // 向下兼容
      created_at: formatDate(),
      updated_at: formatDate(),
      published_at: null
    }

    return journal
  },

  // ==================== 云端操作 ====================

  /** 发布游记到云端 */
  publishCloud(journalData) {
    var self = this
    return new Promise(function(resolve, reject) {
      wx.cloud.callFunction({
        name: 'saveJournal',
        data: {
          journal: {
            ...journalData,
            status: 'published',
            published_at: new Date().toISOString()
          }
        },
        success: function(res) {
          if (res.result && res.result.code === 0) {
            resolve({ source: 'cloud', _id: res.result._id })
          } else {
            reject(new Error((res.result && res.result.message) || '云端保存失败'))
          }
        },
        fail: function(err) {
          reject(err)
        }
      })
    })
  },

  /** 保存草稿到云端 */
  saveDraftCloud(journalData) {
    var self = this
    return new Promise(function(resolve, reject) {
      wx.cloud.callFunction({
        name: 'saveJournal',
        data: {
          journal: {
            ...journalData,
            status: 'draft'
          }
        },
        success: function(res) {
          if (res.result && res.result.code === 0) {
            resolve({ source: 'cloud', _id: res.result._id })
          } else {
            reject(new Error((res.result && res.result.message) || '云端保存失败'))
          }
        },
        fail: function(err) {
          reject(err)
        }
      })
    })
  },

  /** 云端写入 + 本地降级 */
  async publishWithFallback(journalData) {
    try {
      var result = await this.publishCloud(journalData)
      // 云端成功，同时存本地兜底
      var localJournal = this._buildJournal(journalData, 'published')
      localJournal.published_at = new Date().toISOString()
      localJournal.cloudId = result._id
      this._saveLocal(localJournal)
      return result
    } catch (e) {
      console.error('[JournalModel] 云端发布失败，降级本地:', e)
      var journal = this._buildJournal(journalData, 'published')
      journal.published_at = new Date().toISOString()
      this._saveLocal(journal)
      return { source: 'local', _id: journal._id }
    }
  },

  /** 云端保存草稿 + 本地降级 */
  async saveDraftWithFallback(journalData) {
    try {
      var result = await this.saveDraftCloud(journalData)
      // 云端成功，同时存本地兜底
      var localJournal = this._buildJournal(journalData, 'draft')
      localJournal.cloudId = result._id
      this._saveLocal(localJournal)
      return result
    } catch (e) {
      console.error('[JournalModel] 云端存草稿失败，降级本地:', e)
      var journal = this._buildJournal(journalData, 'draft')
      this._saveLocal(journal)
      return { source: 'local', _id: journal._id }
    }
  },

  // ==================== 云端读取 ====================

  /** 从云端获取已发布游记列表 */
  listCloud(page) {
    if (!page) page = 1
    return new Promise(function(resolve, reject) {
      wx.cloud.callFunction({
        name: 'getJournals',
        data: { page: page, pageSize: 10 },
        success: function(res) {
          if (res.result && res.result.code === 0) {
            resolve(res.result.journals)
          } else {
            reject(new Error((res.result && res.result.message) || '获取列表失败'))
          }
        },
        fail: function(err) { reject(err) }
      })
    })
  },

  /** 云端获取列表 + 本地降级 */
  async listWithFallback(page) {
    if (!page) page = 1
    try {
      var journals = await this.listCloud(page)
      return { source: 'cloud', journals: journals }
    } catch (e) {
      console.error('[JournalModel] 云端读取列表失败，降级本地:', e)
      var localJournals = this.list()
      return { source: 'local', journals: localJournals }
    }
  },

  /** 从云端获取单篇游记详情 */
  getCloud(journalId) {
    return new Promise(function(resolve, reject) {
      wx.cloud.callFunction({
        name: 'getJournalDetail',
        data: { journalId: journalId },
        success: function(res) {
          if (res.result && res.result.code === 0) {
            resolve(res.result.journal)
          } else {
            reject(new Error((res.result && res.result.message) || '获取详情失败'))
          }
        },
        fail: function(err) { reject(err) }
      })
    })
  },

  /** 云端获取详情 + 本地降级 */
  async getWithFallback(id) {
    try {
      var journal = await this.getCloud(id)
      return { source: 'cloud', journal: journal }
    } catch (e) {
      console.error('[JournalModel] 云端读取详情失败，降级本地:', e)
      var localJournal = this.get(id)
      return { source: 'local', journal: localJournal }
    }
  },

  /** 尝试云端（静默降级） */
  _tryCloud(action, data) {
    return null
  },

  _saveLocal(journal) {
    const list = this._loadLocal()
    // 替换已有或新增
    const idx = list.findIndex((j) => j._id === journal._id)
    if (idx >= 0) {
      list[idx] = journal
    } else {
      list.unshift(journal)
    }
    wx.setStorageSync(STORAGE_KEY, JSON.stringify(list))
    return journal
  },

  _loadLocal() {
    try {
      const raw = wx.getStorageSync(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  },

  _getLocal(id) {
    const list = this._loadLocal()
    return list.find((j) => j._id === id) || null
  },

  /** 照片级点赞持久化 */
  updatePhotoLike(journalId, photoId, isLiked, likeCount) {
    var list = this._loadLocal()
    var journal = null
    for (var i = 0; i < list.length; i++) {
      if (list[i]._id === journalId) { journal = list[i]; break }
    }
    if (!journal || !journal.photos) return
    for (var j = 0; j < journal.photos.length; j++) {
      if (journal.photos[j]._id === photoId) {
        journal.photos[j].like_count = likeCount
        break
      }
    }
    wx.setStorageSync(STORAGE_KEY, JSON.stringify(list))
  },
}

export default JournalModel
