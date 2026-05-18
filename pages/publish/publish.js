// pages/publish/publish.js — 发布/编辑游记
// V2: 照片模型 + 封面选择 + 日期 + 发布校验
import JournalModel from '../../models/journal-model'

const app = getApp()

Page({
  data: {
    title: '',
    description: '',
    images: [],       // 上传的临时文件 { path, _key, caption }
    location: '',
    isEdit: false,
    isPublishedEdit: false,
    draftId: '',
    publishing: false,
    saving: false,
    dataReady: false,
    statusBarHeight: 44,
    _keyCounter: 0,
    _savedBeforeUnload: false,
    _publishedSuccess: false,

    // V2 新增字段
    startDate: '',
    endDate: '',
    tripDays: 0,
    coverIndex: 0,     // 封面在 photos 中的索引，-1 表示未选
    coverUrl: '',      // 封面预览URL

    // 预览 & 草稿状态
    previewMode: false,
    draftTitle: '',
    savedTime: '',
  },

  onLoad(query) {
    var capsulePaddingRight = app.globalData.capsulePaddingRight || 95
    this.setData({ statusBarHeight: app.globalData.statusBarHeight || 44, navPaddingRight: capsulePaddingRight })
    // 检查 query.id（navigateTo 传参，只在非 TabBar 跳转时有效）
    // 或 pendingDraftId（全局状态，草稿箱 switchTab 传参）
    var draftId = query.draftId || query.id || ''
    if (!draftId && app.globalData.pendingDraftId) {
      draftId = app.globalData.pendingDraftId
      app.globalData.pendingDraftId = null
    }
    console.log('[发布页] onLoad draftId:', draftId)
    if (draftId) {
      // 尝试加载草稿，如果是已发布游记则加载详情
      this.loadJournalForEdit(draftId)
    } else {
      this.setData({ dataReady: true })
    }
  },

  onShow() {
    // 主动通知自定义 TabBar 检测是否隐藏
    var tabBar = this.getTabBar ? this.getTabBar() : null
    if (tabBar && tabBar._checkVisibility) {
      tabBar._checkVisibility()
    }

    // 检查是否有 pendingDraftId（草稿箱 switchTab 传递）
    if (app.globalData.pendingDraftId && !this.data.draftId) {
      var draftId = app.globalData.pendingDraftId
      app.globalData.pendingDraftId = null
      console.log('[发布页] onShow 加载草稿:', draftId)
      this.loadDraft(draftId)
    }

    if (!app.globalData.isLoggedIn) {
      // 记录 pending action：登录后自动回到发布页
      app.setPendingAction('openPublish', {})
      const pages = getCurrentPages()
      const cur = pages[pages.length - 1]
      const qs = this._serializeQuery(cur.options || {})
      wx.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent('/' + cur.route + qs) })
      return
    }
  },

  /** 退出时自动保存草稿（仅当未手动保存过） */
  onUnload() {
    try {
      if (this.data._savedBeforeUnload) return
      if (this.data.publishing) return
      if (this.data._publishedSuccess) return
      if (this._hasContent()) {
        this._autoSaveDraft()
      }
    } catch (e) {
      console.warn('onUnload 异常', e)
    }
  },

  /** 判断是否已有可保存内容 */
  _hasContent() {
    try {
      return (this.data.title || '').trim() || (this.data.images || []).length > 0 || (this.data.description || '').trim()
    } catch (e) {
      return false
    }
  },

  /** 静默自动保存（不跳转、不 toast） */
  async _autoSaveDraft() {
    try {
      var data = this._buildData()
      if (data) {
        // 直接调云函数，跳过 JournalModel.saveDraft — _buildJournal 会过滤 EXIF 字段
        var payload = { ...data, status: 'draft' }
        if (this.data.draftId && typeof this.data.draftId === 'string' && !this.data.draftId.startsWith('local_')) {
          payload._id = this.data.draftId
        }
        await new Promise(function(resolve, reject) {
          wx.cloud.callFunction({
            name: 'saveJournal',
            data: { journal: payload },
            success: function(r) { if (r.result && r.result.code === 0) { resolve() } else { reject() } },
            fail: function() { reject() }
          })
        })
      }
    } catch (e) {
      console.warn('自动保存草稿失败', e)
    }
  },

  _serializeQuery(options) {
    return Object.entries(options).filter(([, v]) => v).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&').replace(/^/, '?')
  },

  // ==================== 草稿加载 ====================

  /** 为编辑加载游记（支持草稿和已发布） */
  async loadJournalForEdit(id) {
    try {
      // 先试草稿
      var draft = await JournalModel.getDraft(id)
      if (draft) {
        return this._fillFormFromJournal(draft)
      }
      // 不是草稿，从云端加载已发布游记
      var result = await JournalModel.getWithFallback(id)
      if (result && result.journal) {
        this.setData({ isEdit: true, draftId: id, isPublishedEdit: true })
        this._fillFormFromJournal(result.journal)
      } else {
        wx.showToast({ title: '游记不存在', icon: 'none' })
        setTimeout(function() { wx.navigateBack() }, 1500)
      }
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'error' })
    }
  },

  /** 从游记数据回填表单 */
  _fillFormFromJournal(journal) {
    var rawPhotos = journal.photos || []
    var images = rawPhotos.map(function(p, i) {
      return { _key: 'img_edit_' + i, path: p.url, caption: p.description || '', _cloudId: p.url.indexOf('cloud://') === 0 ? p.url : '' }
    })
    // 确定封面索引
    var coverIdx = 0
    var coverUrl = journal.cover || (images.length > 0 ? images[0].path : '')
    if (journal.cover && images.length > 0) {
      var found = -1
      for (var i = 0; i < images.length; i++) {
        if (images[i].path === journal.cover) { found = i; break }
      }
      if (found >= 0) {
        coverIdx = found
      }
    }

    this.setData({
      isEdit: true, draftId: journal._id,
      title: journal.title || '', description: journal.description || '',
      images: images, location: journal.destination || '',
      startDate: journal.start_date || '', endDate: journal.end_date || '',
      tripDays: journal.trip_days || 0,
      coverUrl: coverUrl,
      coverIndex: coverIdx, dataReady: true,
      draftTitle: journal.title || '',
    })
  },

  async loadDraft(id) {
    try {
      const draft = await JournalModel.getDraft(id)
      if (draft) {
        // 兼容旧 images 和新 photos
        var rawPhotos = draft.photos || []
        var oldImages = draft.images || []
        var images = []

        if (rawPhotos.length > 0) {
          images = rawPhotos.map(function(p, i) {
            return { _key: 'img_draft_' + i, path: p.url, caption: p.description || '' }
          })
        } else if (oldImages.length > 0) {
          images = oldImages.map(function(img, i) {
            var obj = typeof img === 'string' ? { path: img } : img
            return { _key: obj._key || 'img_draft_' + i, path: obj.path || obj.url || '', caption: obj.caption || '' }
          })
        }

        // 确定封面索引
        var coverIdx = 0
        var coverUrl = ''
        if (draft.cover && images.length > 0) {
          var found = -1
          for (var i = 0; i < images.length; i++) {
            if (images[i].path === draft.cover) { found = i; break }
          }
          if (found >= 0) {
            coverIdx = found
            coverUrl = images[found].path
          } else {
            coverUrl = draft.cover
          }
        } else if (images.length > 0) {
          coverUrl = images[0].path
        }

        this.setData({
          isEdit: true, draftId: draft._id,
          title: draft.title || '', description: draft.description || '',
          images: images, location: draft.destination || '',
          startDate: draft.start_date || '',
          endDate: draft.end_date || '',
          tripDays: draft.trip_days || 0,
          coverIndex: coverIdx,
          coverUrl: coverUrl,
          dataReady: true,
          draftTitle: draft.title || '',
        })
      } else {
        wx.showToast({ title: '草稿不存在或无权访问', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1500)
      }
    } catch (err) {
      wx.showToast({ title: '加载草稿失败', icon: 'error' })
    }
  },

  // ==================== 表单 ====================

  /** 标记有未保存的修改 */
  _markUnsaved() {
    if (!this.data.hasUnsavedDraft) {
      this.setData({ hasUnsavedDraft: true })
    }
  },

  onTitleInput(e) { this.setData({ title: e.detail.value }); this._markUnsaved() },
  onLocationInput(e) { this.setData({ location: e.detail.value }); this._markUnsaved() },

  onDescriptionInput(e) {
    this.setData({ description: e.detail.value, hasUnsavedDraft: true })
  },

  onCaptionInput(e) {
    var idx = e.currentTarget.dataset.index
    var val = e.detail.value
    var path = 'images[' + idx + '].caption'
    this.setData({ [path]: val })
    this._markUnsaved()
  },

  // ==================== 日期 ====================

  onStartDateChange(e) {
    var val = e.detail.value
    var tripDays = 0
    if (val && this.data.endDate) {
      tripDays = Math.floor((new Date(this.data.endDate) - new Date(val)) / 86400000) + 1
      if (tripDays < 1) tripDays = 0
    }
    this.setData({ startDate: val, tripDays: tripDays })
    this._markUnsaved()
  },

  onEndDateChange(e) {
    var val = e.detail.value
    var tripDays = 0
    if (val && this.data.startDate) {
      tripDays = Math.floor((new Date(val) - new Date(this.data.startDate)) / 86400000) + 1
      if (tripDays < 1) tripDays = 0
    }
    this.setData({ endDate: val, tripDays: tripDays })
    this._markUnsaved()
  },

  // ==================== 封面选择 ====================

  /** 点击封面区域 → 弹出照片选择器 */
  onCoverTap() {
    if (this.data.images.length === 0) {
      wx.showToast({ title: '请先添加照片', icon: 'none' })
      return
    }
    var self = this
    var items = this.data.images.map(function(img, idx) {
      return { name: '第' + (idx + 1) + '张照片', index: idx }
    })
    wx.showActionSheet({
      itemList: items.map(function(i) { return i.name }),
      success: function(res) {
        var idx = items[res.tapIndex].index
        self.setData({ coverIndex: idx, coverUrl: self.data.images[idx].path })
      }
    })
  },

  // ==================== 图片管理 ====================

  /** 上传单张图片到云存储 */
  uploadPhoto(tempFilePath, index) {
    var ext = 'jpg'
    var parts = (tempFilePath || '').split('.')
    if (parts.length > 1) ext = parts[parts.length - 1]
    var userId = (getApp().globalData.userId || 'guest').replace(/[^a-zA-Z0-9_]/g, '_')
    var cloudPath = 'journals/' + userId + '/' + Date.now() + '_' + index + '.' + ext

    return new Promise(function(resolve, reject) {
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: tempFilePath,
        success: function(res) { resolve(res.fileID) },
        fail: function(err) { reject(err) }
      })
    })
  },

  /** 选图（不上传，选择后统一在发布/保存时上传） */
  chooseImages() {
    var maxCount = 9 - this.data.images.length
    if (maxCount <= 0) { wx.showToast({ title: '最多 9 张照片', icon: 'none' }); return }

    var self = this
    wx.chooseMedia({
      count: maxCount, mediaType: ['image'], sourceType: ['album', 'camera'], sizeType: ['original'], // 强制原图保留EXIF
      success: function(res) {
        var kc = self.data._keyCounter
        var newItems = (res.tempFiles || []).map(function(f, i) {
          return {
            _key: 'img_' + (kc + i),
            path: f.tempFilePath,
            shot_time: f.time || null,
            caption: '',
            _cloudId: '',
          }
        })
        var merged = self.data.images.concat(newItems)
        var coverUrl = self.data.coverUrl || merged[0].path
        self.setData({
          images: merged,
          _keyCounter: kc + newItems.length,
          coverUrl: coverUrl,
        })
        self._markUnsaved()
      },
    })
  },

  /** 批量上传所有本地图片到云存储 */
  async uploadAllImages() {
    var images = this.data.images
    var needUpload = []
    for (var i = 0; i < images.length; i++) {
      if (!images[i]._cloudId && images[i].path && images[i].path.indexOf('cloud://') !== 0) {
        needUpload.push({ index: i, path: images[i].path })
      }
    }
    if (needUpload.length === 0) return

    wx.showLoading({ title: '上传照片中...', mask: true })
    try {
      for (var j = 0; j < needUpload.length; j++) {
        var item = needUpload[j]
        var fileId = await this.uploadPhoto(item.path, item.index)
        images[item.index]._cloudId = fileId
        if (images[item.index].path === this.data.coverUrl) {
          this.setData({ coverUrl: fileId })
        }
      }
      this.setData({ images: images })
    } catch (e) {
      console.warn('[发布页] 图片上传部分失败:', e)
    } finally {
      wx.hideLoading()
    }
  },

  /** 调用云函数解析单张照片的 EXIF（拍摄时间、GPS 坐标） */
  async parseExifFromCloud(fileID) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'parseExif',
        data: { fileID }
      })
      const result = res.result
      console.log('[EXIF]', result.reason, 'timestamp:', result.timestamp, 'lat:', result.lat, 'lng:', result.lng)
      return result
    } catch (e) {
      console.error('[EXIF] 云函数调用失败:', e)
      return { success: false, timestamp: null, lat: null, lng: null, reason: 'call_failed' }
    }
  },

  /** 批量解析所有已上传图片的 EXIF */
  async parseExifForImages() {
    var images = this.data.images
    if (!images || images.length === 0) {
      console.log('[EXIF] 无图片，跳过解析')
      return
    }

    console.log('[EXIF] 开始批量解析，图片数:', images.length)

    var tasks = []
    for (var i = 0; i < images.length; i++) {
      console.log('[EXIF] images[' + i + '] 写入前:', JSON.stringify(images[i]))
      if (images[i]._cloudId) {
        tasks.push(this.parseExifFromCloud(images[i]._cloudId))
      } else {
        console.log('[EXIF] images[' + i + '] 无 _cloudId，跳过')
        tasks.push(Promise.resolve({ success: false, timestamp: null, lat: null, lng: null }))
      }
    }
    var exifResults = await Promise.all(tasks)

    // 使用 setData 路径语法写入，避免 in-place 突变导致 WeChat 跳过 diff
    var patches = {}
    for (var i = 0; i < exifResults.length; i++) {
      var result = exifResults[i]
      console.log('[EXIF] images[' + i + '] 云函数返回:', JSON.stringify(result))
      if (result.timestamp) {
        var date = new Date(result.timestamp)
        var timeStr = date.getFullYear() + '-' +
          String(date.getMonth() + 1).padStart(2, '0') + '-' +
          String(date.getDate()).padStart(2, '0') + ' ' +
          String(date.getHours()).padStart(2, '0') + ':' +
          String(date.getMinutes()).padStart(2, '0')
        patches['images[' + i + '].shootTime'] = timeStr
        patches['images[' + i + '].shot_time'] = timeStr
        console.log('[EXIF] images[' + i + '] shootTime/shoot_time 写入:', timeStr)
      }
      if (result.lat && result.lng) {
        patches['images[' + i + '].lat'] = result.lat
        patches['images[' + i + '].lng'] = result.lng
        console.log('[EXIF] images[' + i + '] lat/lng 写入:', result.lat, result.lng)
      }
      if (result.locationName) {
        patches['images[' + i + '].location'] = result.locationName
        console.log('[EXIF] images[' + i + '] location 写入:', result.locationName)
      }
    }

    // 只写入有变化的字段，触发 WeChat 正确 diff
    if (Object.keys(patches).length > 0) {
      this.setData(patches)
      console.log('[EXIF] 写入完成，patches:', JSON.stringify(patches))
      // 确认写入结果
      for (var i = 0; i < exifResults.length; i++) {
        console.log('[EXIF写入后] images[' + i + ']:', JSON.stringify(this.data.images[i]))
      }
    } else {
      console.log('[EXIF] 无 EXIF 数据可写入')
    }
  },

  removeImage(e) {
    var idx = e.currentTarget.dataset.index
    var list = this.data.images.slice()
    list.splice(idx, 1)
    // 如果删的是当前封面，重置封面
    var coverIdx = this.data.coverIndex
    var coverUrl = this.data.coverUrl
    if (idx === coverIdx || idx < coverIdx) {
      coverIdx = 0
      coverUrl = list.length > 0 ? list[0].path : ''
    }
    this.setData({ images: list, coverIndex: coverIdx, coverUrl: coverUrl })
    this._markUnsaved()
  },

  // ==================== 保存 & 发布 ====================

  _buildData() {
    var user = app.globalData.userInfo || {}

    // 构建 photos[]
    var images = this.data.images || []
    var photos = images.map(function(img, idx) {
      // 优先用 cloud fileID，兜底本地路径
      var url = (img && img._cloudId) || (img && img.path) || ''
      // 优先用 shot_time（选图或EXIF写入时已同步），其次 shootTime（旧字段兼容），最后空字符串
      var rawShootTime = img && img.shot_time ? img.shot_time : (img && img.shootTime || '')
      console.log('[发布构建] photos[' + idx + '] shot_time:', img && img.shot_time, 'shootTime:', img && img.shootTime, '最终:', rawShootTime)
      return {
        _id: 'p_' + Date.now() + '_' + idx,
        url: url,
        description: img && img.caption ? img.caption : '',
        sort_index: idx,
        shoot_time: rawShootTime,
        lat: img && img.lat ? img.lat : null,
        lng: img && img.lng ? img.lng : null,
        location: img && img.location ? img.location : '',
      }
    })

    // 封面URL
    var cover = this.data.coverUrl || (photos.length > 0 ? photos[0].url : '')

    // 行程天数
    var tripDays = 0
    if (this.data.startDate && this.data.endDate) {
      tripDays = Math.floor((new Date(this.data.endDate) - new Date(this.data.startDate)) / 86400000) + 1
      if (tripDays < 1) tripDays = 0
    }

    return {
      title: (this.data.title || '').trim(),
      cover: cover,
      photos: photos,
      description: this.data.description || '',
      destination: (this.data.location || '').trim(),
      start_date: this.data.startDate,
      end_date: this.data.endDate,
      trip_days: tripDays,
      author_id: app.globalData.userId || user._id || 'guest',
      author_name: user.nickname || '旅行者',
      author_avatar: user.avatar || '',
    }
  },

  onFinishTripTap() {
    if (this.data.publishing) return;
    wx.showModal({
      title: '确认结束行程',
      content: '结束这次行程后，游记将公开发布到首页，所有人都能看到。确认结束吗？',
      confirmText: '确认结束',
      cancelText: '取消',
      confirmColor: '#8A4DFF',
      success: (res) => {
        if (res.confirm) {
          this.publish();
        }
      }
    });
  },

  async saveDraft() {
    this.setData({ saving: true, _savedBeforeUnload: true })
    try {
      // 先上传图片
      await this.uploadAllImages()
      // 解析 EXIF（拍摄时间、GPS 坐标）
      await this.parseExifForImages()
      var data = this._buildData()
      console.log('[保存草稿前] 完整 data.photos:', JSON.stringify(data.photos))

      // 直接调用云函数，跳过 JournalModel.saveDraft — 后者内部 _buildJournal 会过滤掉 EXIF 字段
      var cloudPayload = { ...data, status: 'draft' }
      if (this.data.draftId && typeof this.data.draftId === 'string' && !this.data.draftId.startsWith('local_')) {
        cloudPayload._id = this.data.draftId
      }
      var result = await new Promise(function(resolve, reject) {
        wx.cloud.callFunction({
          name: 'saveJournal',
          data: { journal: cloudPayload },
          success: function(r) {
            if (r.result && r.result.code === 0) resolve({ _id: r.result._id })
            else reject(new Error((r.result && r.result.message) || '云端保存失败'))
          },
          fail: function(err) { reject(err) }
        })
      })
      var draftId = result._id || ''
      var now = new Date()
      var t = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
      this.setData({ draftId: draftId, isEdit: true, draftTitle: this.data.title || '', savedTime: t, hasUnsavedDraft: false })
      wx.showToast({ title: '已保存草稿', icon: 'success', duration: 1200 })
      // 保存草稿后留在当前页，不跳转
    } catch (err) {
      console.error('[发布页] 保存草稿失败:', err)
      wx.showToast({ title: '保存失败', icon: 'error' })
    } finally {
      this.setData({ saving: false })
    }
  },

  async publish() {
    // 发布校验：标题 + 出发日期 + 返回日期 必填
    if (this.data.isPublishedEdit) {
      return this.savePublishedEdit()
    }
    if (!this.data.title.trim()) { wx.showToast({ title: '请输入标题', icon: 'none' }); return }
    if (this.data.images.length === 0) { wx.showToast({ title: '请至少添加一张照片', icon: 'none' }); return }
    if (!this.data.startDate) { wx.showToast({ title: '请选择出发日期', icon: 'none' }); return }
    if (!this.data.endDate) { wx.showToast({ title: '请选择返回日期', icon: 'none' }); return }

    this.setData({ publishing: true })
    try {
      // 先上传所有图片到云存储
      await this.uploadAllImages()
      // 解析 EXIF（拍摄时间、GPS 坐标）
      await this.parseExifForImages()
      var data = this._buildData()
      console.log('[保存前] 完整 data.photos:', JSON.stringify(data.photos))

      // 直接调云函数，跳过 JournalModel 任何方法 — _buildJournal 会过滤 EXIF 字段
      var cloudPayload = { ...data, status: 'published', updated_at: new Date().toISOString(), published_at: new Date().toISOString() }
      if (this.data.draftId) {
        cloudPayload._id = this.data.draftId
      }

      console.log('[publish→callFunction] 即将传给云函数 photos[0]:', JSON.stringify(cloudPayload.photos[0]))

      var callResult = await new Promise(function(resolve, reject) {
        wx.cloud.callFunction({
          name: 'saveJournal',
          data: { journal: cloudPayload },
          success: function(r) {
            console.log('[publish→callFunction] 云函数返回:', r.result)
            if (r.result && r.result.code === 0) resolve(r.result)
            else reject(new Error((r.result && r.result.message) || '发布失败'))
          },
          fail: function(err) { reject(err) }
        })
      })
      var journalId = callResult._id
      // 标记发布成功，阻止 onUnload 自动保存草稿
      this.setData({ _savedBeforeUnload: true, _publishedSuccess: true })

      wx.showToast({ title: '发布成功 🎉', icon: 'none', duration: 1500 })
      var self = this
      setTimeout(function() { wx.redirectTo({ url: '/pages/journal/detail?id=' + journalId }) }, 1600)
    } catch (err) {
      console.error('[发布页] 发布失败:', err)
      wx.showToast({ title: '发布失败', icon: 'error' })
    } finally {
      this.setData({ publishing: false })
    }
  },

  /** 保存已发布游记的修改 */
  async savePublishedEdit() {
    this.setData({ publishing: true })
    try {
      await this.uploadAllImages()
      // 解析 EXIF（拍摄时间、GPS 坐标）
      await this.parseExifForImages()
      var data = this._buildData()
      data._id = this.data.draftId
      data.status = 'published'
      console.log('[保存编辑前] 完整 data.photos:', JSON.stringify(data.photos))

      var res = await new Promise(function(resolve, reject) {
        wx.cloud.callFunction({
          name: 'saveJournal',
          data: { journal: data },
          success: function(r) { resolve(r.result) },
          fail: function(err) { reject(err) }
        })
      })

      if (res && res.code === 0) {
        this.setData({ _savedBeforeUnload: true, _publishedSuccess: true })
        wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 })
        var self = this
        setTimeout(function() { wx.redirectTo({ url: '/pages/journal/detail?id=' + self.data.draftId }) }, 1600)
      } else {
        wx.showToast({ title: (res && res.message) || '保存失败', icon: 'error' })
      }
    } catch (err) {
      wx.showToast({ title: '保存失败', icon: 'error' })
    } finally {
      this.setData({ publishing: false })
    }
  },

  // ==================== 预览 & 草稿 ====================

  /** 预览当前编辑内容 — 构建数据跳转到预览页 */
  onPreview() {
    var data = this._buildPreviewData()
    getApp().globalData.previewData = data
    wx.navigateTo({ url: '/pages/preview/index' })
  },

  /** 构建预览用数据（不含保存逻辑） */
  _buildPreviewData() {
    var user = getApp().globalData.userInfo || {}
    var photos = (this.data.images || []).map(function(img, idx) {
      return {
        _id: 'p_' + Date.now() + '_' + idx,
        url: img._cloudId || img.path || '',
        description: img.caption || '',
        sort_index: idx,
      }
    })
    var tripDays = 0
    if (this.data.startDate && this.data.endDate) {
      tripDays = Math.floor((new Date(this.data.endDate) - new Date(this.data.startDate)) / 86400000) + 1
      if (tripDays < 1) tripDays = 0
    }
    return {
      title: (this.data.title || '').trim(),
      cover: this.data.coverUrl || (photos.length > 0 ? photos[0].url : ''),
      photos: photos,
      description: this.data.description || '',
      destination: this.data.location || '',
      start_date: this.data.startDate,
      end_date: this.data.endDate,
      trip_days: tripDays,
      author_name: user.nickname || '旅行者',
      author_avatar: user.avatar || '',
    }
  },

  /** 关闭预览（保留用于兼容旧调用） */
  onClosePreview() {
    // 已迁移到独立预览页，此方法保留避免引用报错
  },

  /** 跳转草稿箱 */
  goToDrafts() {
    wx.navigateTo({ url: '/pages/drafts/drafts' })
  },

  goBack() {
    try {
      var pages = getCurrentPages()
      if (pages.length <= 1) {
        wx.switchTab({ url: '/pages/index/index' })
      } else {
        wx.navigateBack()
      }
    } catch (e) {
      wx.switchTab({ url: '/pages/index/index' })
    }
  },
})
