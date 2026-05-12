import JournalModel from '../../models/journal-model'
import InteractionModel from '../../models/interaction-model'
import CommentModel from '../../models/comment-model'
import NotificationModel from '../../models/notification-model'
import handleImageError from '../../utils/image-helper'

const app = getApp()

Page({
  data: {
    journal: null, loading: true,
    isLiked: false, isCollected: false,
     
    isOwner: false, statusBarHeight: 44,
    comments: [], commentInput: '', commentCount: 0, currentUserId: null, isSubmittingComment: false,
    replyTarget: null,
    nodeCommentTarget: null,
    commentInputPlaceholder: '分享你的想法...',
    nodeCommentsMap: {},
    expandedNodeMap: {},
    expandedRepliesMap: {},
    hasGps: false, mapCenter: { lat: 39.9, lng: 116.4 }, mapMarkers: [],
  },

  onLoad(query) {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight || 44 })
    const id = query.id || ''
    if (id) {
      this.journalId = id
      this.loadDetail(id)
      // 从云端加载互动状态
      this.loadCloudInteraction(id)
      this.loadCloudComments(id)
    }
    // ★ 登录后自动恢复 pending action
    this._handlePendingAction()
  },

  onShow() {
    if (this.journalId) {
      this.loadCloudInteraction(this.journalId)
      this.loadCloudComments(this.journalId)
    }
  },

  /** 从云端加载点赞/收藏状态（覆盖本地） */
  async loadCloudInteraction(journalId) {
    var self = this
    try {
      var status = await this.getCloudLikeStatus(journalId)
      if (status) {
        self.setData({ isLiked: status.isLiked, isCollected: status.isCollected })
      }
    } catch (e) {
      console.warn('[详情页] 云端互动状态加载失败:', e)
    }
  },

  /** 从云端加载评论（覆盖本地） */
  async loadCloudComments(journalId) {
    var self = this
    try {
      var result = await this.getCloudComments(journalId)
      var journalComments = result.journalComments || []
      var nodeCommentsMap = result.nodeCommentsMap || {}

      // 格式化时间
      var fmtComments = journalComments.map(function(c) {
        return Object.assign({}, c, { timeText: self.formatTime(c.created_at) })
      })
      // 节点评论也格式化时间
      var fmtNodeMap = {}
      for (var key in nodeCommentsMap) {
        fmtNodeMap[key] = nodeCommentsMap[key].map(function(c) {
          c.timeText = self.formatTime(c.created_at)
          return c
        })
      }

      self.setData({
        comments: fmtComments,
        nodeCommentsMap: fmtNodeMap,
        commentCount: fmtComments.length,
        currentUserId: app.globalData.userId
      })

      // 更新节点评论数
      if (self.data.photos && self.data.photos.length > 0) {
        var newPhotos = self.data.photos.map(function(p) {
          return Object.assign({}, p, { nodeCommentCount: (fmtNodeMap[p._id] || []).length })
        })
        self.setData({ photos: newPhotos })
      }
    } catch (e) {
      console.warn('[详情页] 云端评论加载失败:', e)
    }
  },

  async loadDetail(id) {
    this.setData({ loading: true })
    try {
      // 云端优先，降级本地
      var result = await JournalModel.getWithFallback(id)
      console.log('[详情页] 数据来源:', result.source)
      var journal = result.journal
      if (journal) {
        journal._pubDate = this._formatDate(journal.published_at)
        journal._tripDays = this._calcTripDays(journal)

        // ★ 适配新 photos[] 模型 + 兼容旧 images[]
        var rawPhotos = journal.photos || []
        if (rawPhotos.length === 0) {
          // 兼容旧 images[]
          var oldImages = journal.images || []
          rawPhotos = oldImages.map(function(img, idx) {
            var url = typeof img === 'string' ? img : (img.path || img.url || '')
            var cap = typeof img === 'string' ? '' : (img.caption || '')
            var lat = typeof img === 'string' ? null : (img.lat || null)
            var lng = typeof img === 'string' ? null : (img.lng || null)
            return { _id: 'img_' + idx, url: url, description: cap, sort_index: idx, lat: lat, lng: lng }
          })
        }
        // 按 sort_index 排序
        rawPhotos.sort(function(a, b) {
          return (a.sort_index || 0) - (b.sort_index || 0)
        })
        // 处理为渲染格式
        var processedImages = rawPhotos.map(function(p, idx) {
          return {
            _key: p._id || 'img_' + idx,
            path: p.url || '',
            caption: p.description || '',
            lat: p.lat || null,
            lng: p.lng || null,
          }
        })
        journal.processedImages = processedImages
        journal.cover = journal.cover || (processedImages[0] ? processedImages[0].path : '')
        journal._photoCount = processedImages.length

        // 照片级点赞数据
        var photos = rawPhotos.map(function(p) {
          var time = p.shoot_time || ''
          var loc = p.location || ''
          var info = time ? (loc ? time + ' · ' + loc : time) : (loc || '')
          return {
            _id: p._id || '',
            url: p.url || '',
            description: p.description || '',
            like_count: p.like_count || 0,
            isLiked: false,
            nodeInfo: info,
            location: loc,
          }
        })

        // 地图（从照片中找有 GPS 的）
        var gpsItem = null
        for (var i = 0; i < processedImages.length; i++) {
          if (processedImages[i].lat && processedImages[i].lng) {
            gpsItem = processedImages[i]
            break
          }
        }
        var hasGps = !!gpsItem
        this.setData({
          journal: journal, hasGps: hasGps,
          mapCenter: gpsItem ? { lat: gpsItem.lat, lng: gpsItem.lng } : { lat: 39.9, lng: 116.4 },
          mapMarkers: hasGps ? [{ id: 0, latitude: gpsItem.lat, longitude: gpsItem.lng, title: journal.destination || '📍' }] : [],
          photos: photos,
          isOwner: app.globalData.userInfo && journal.author_id === app.globalData.userInfo._id,
          loading: false,
        })
      } else { this.setData({ loading: false }) }
    } catch (err) { console.error('加载详情失败', err); this.setData({ loading: false }) }
  },

  /** 行程天数：优先用新模型字段，兜底旧数据 */
  _calcTripDays(j) {
    // 新模型已有 trip_days
    if (j.trip_days && j.trip_days > 0) return '行程 · ' + j.trip_days + '天'
    // 从 start_date / end_date 计算
    if (j.start_date && j.end_date) {
      var days = Math.floor((new Date(j.end_date) - new Date(j.start_date)) / 86400000) + 1
      if (days > 0) return '行程 · ' + days + '天'
    }
    // 兜底：从旧图片时间跨度计算
    var images = j.images || []
    if (images.length === 0) {
      var photos = j.photos || []
      if (photos.length > 0) return photos.length + '张照片'
      return ''
    }
    var times = images.map(function(i) { return i.shot_time }).filter(Boolean).sort()
    if (times.length >= 2) {
      var days = Math.ceil((times[times.length - 1] - times[0]) / 86400000) + 1
      return '行程 · ' + Math.max(days, 1) + '天'
    }
    if (images.length > 0) return images.length + '张照片'
    return ''
  },

  loadInteraction(id) {
    this.setData({
      liked: InteractionModel.isLiked(id), collected: InteractionModel.isCollected(id),
      likeCount: InteractionModel.likeCount(id), collectCount: InteractionModel.collectCount(id),
    })
  },

  loadComments(id) {
    const comments = (CommentModel.getByJournal(id) || []).map((c) => ({ ...c, _time: this._fmtRelative(c.created_at) }))
    const user = app.globalData.userInfo
    this.setData({ comments, commentCount: comments.length, currentUserId: user ? user._id : null })
  },

  toggleLike() {
    if (!app.globalData.isLoggedIn) return this._redirectLogin('likeJournal')
    const r = InteractionModel.toggleLike(this.journalId)
    this.setData({ liked: r.liked, likeCount: r.count })
    if (r.liked && this.data.journal) NotificationModel.add({ receiver_id: this.data.journal.author_id, type: 'like', sender_id: app.globalData.userInfo?._id, sender_name: app.globalData.userInfo?.nickname, target_type: 'journal', target_id: this.journalId, target_title: this.data.journal.title })
  },

  toggleCollect() {
    if (!app.globalData.isLoggedIn) return this._redirectLogin('collectJournal')
    const r = InteractionModel.toggleCollect(this.journalId)
    this.setData({ collected: r.collected, collectCount: r.count })
    if (r.collected && this.data.journal) NotificationModel.add({ receiver_id: this.data.journal.author_id, type: 'collect', sender_id: app.globalData.userInfo?._id, sender_name: app.globalData.userInfo?.nickname, target_type: 'journal', target_id: this.journalId, target_title: this.data.journal.title })
  },

  /** 照片级点赞 */
  togglePhotoLike(e) {
    if (!app.globalData.isLoggedIn) return this._redirectLogin()
    var photoId = e.currentTarget.dataset.id
    var photos = this.data.photos.map(function(p) {
      if (p._id !== photoId) return p
      var isLiked = !p.isLiked
      var likeCount = (p.like_count || 0) + (isLiked ? 1 : -1)
      if (likeCount < 0) likeCount = 0
      return Object.assign({}, p, { isLiked: isLiked, like_count: likeCount })
    })
    this.setData({ photos: photos })
    // 持久化
    var updatedPhoto = null
    for (var i = 0; i < photos.length; i++) {
      if (photos[i]._id === photoId) { updatedPhoto = photos[i]; break }
    }
    if (updatedPhoto && JournalModel.updatePhotoLike) {
      JournalModel.updatePhotoLike(this.journalId, photoId, updatedPhoto.isLiked, updatedPhoto.like_count)
    }
  },

  onCommentInput(e) { this.setData({ commentInput: e.detail.value }) },

  /** 节点级点赞切换 */
  toggleNodeLike(e) {
    console.log('[节点点赞] toggleNodeLike 触发', JSON.stringify(e.currentTarget.dataset))
    var app = getApp()
    if (!app.globalData.userId) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    var self = this
    var nodeId = e.currentTarget.dataset.nodeid
    var index = e.currentTarget.dataset.index

    wx.cloud.callFunction({
      name: 'comment',
      data: { action: 'likeNode', nodeId: nodeId, journalId: self.journalId },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          var newIsLiked = res.result.isLiked
          var newLikeCount = res.result.likeCount
          self.setData({
            ['photos[' + index + '].isLiked']: newIsLiked,
            ['photos[' + index + '].likeCount']: newLikeCount
          })
          // 仅点赞成功触发通知
          if (newIsLiked && self.data.journal && self.data.journal.author_id) {
            wx.cloud.callFunction({
              name: 'addNotification',
              data: {
                receiverId: self.data.journal.author_id,
                type: 'like',
                targetId: nodeId,
                targetType: 'image',
                postId: self.journalId,
                imageId: nodeId
              }
            })
          }
        }
      },
      fail: function(err) {
        console.error('[节点点赞] 失败:', err)
      }
    })
  },

  /** 打开节点评论输入框 */
  openNodeCommentInput(e) {
    console.log('[节点评论] openNodeCommentInput 触发', JSON.stringify(e.currentTarget.dataset))
    var nodeId = e.currentTarget.dataset.nodeid
    this.setData({
      nodeCommentTarget: nodeId,
      replyTarget: null,
      commentInputPlaceholder: '评论这张照片...'
    })
  },

  /** 取消节点评论/回复 */
  cancelNodeComment() {
    this.setData({
      nodeCommentTarget: null,
      replyTarget: null,
      commentInput: '',
      commentInputPlaceholder: '分享你的想法...'
    })
  },

  submitComment() {
    const text = this.data.commentInput.trim()
    if (!text) return
    if (!app.globalData.isLoggedIn) return this._redirectLogin('focusComment')
    CommentModel.add(this.journalId, text)
    this.setData({ commentInput: '' })
    this.loadComments(this.journalId)
    if (this.data.journal) NotificationModel.add({ receiver_id: this.data.journal.author_id, type: 'comment', sender_id: app.globalData.userInfo?._id, sender_name: app.globalData.userInfo?.nickname, target_type: 'journal', target_id: this.journalId, target_title: this.data.journal.title })
    wx.showToast({ title: '评论成功', icon: 'none' })
  },

  deleteComment(e) { const id = e.currentTarget.dataset.id; if (CommentModel.delete(id)) { this.loadComments(this.journalId); wx.showToast({ title: '已删除', icon: 'none' }) } },

  /** 编辑游记 */
  editJournal() {
    var id = this.journalId
    wx.navigateTo({ url: '/pages/publish/publish?id=' + id })
  },

  /** 删除自己的游记 */
  deleteOwnJournal() {
    var self = this
    wx.showModal({
      title: '删除游记', content: '删除后无法恢复，确认删除？', confirmColor: '#FF4444',
      success: function(res) {
        if (!res.confirm) return
        wx.cloud.callFunction({
          name: 'deleteJournal',
          data: { journalId: self.journalId },
          success: function(r) {
            if (r.result && r.result.code === 0) {
              wx.showToast({ title: '已删除', icon: 'success' })
              setTimeout(function() {
                var pages = getCurrentPages()
                if (pages.length <= 1) { wx.switchTab({ url: '/pages/index/index' }) }
                else { wx.navigateBack() }
              }, 1500)
            } else {
              wx.showToast({ title: r.result.message || '删除失败', icon: 'error' })
            }
          },
          fail: function() { wx.showToast({ title: '删除失败', icon: 'error' }) }
        })
      }
    })
  },

  /** 滚动到评论区 */
  scrollToComments() {
    wx.pageScrollTo({ selector: '.detail-comments', duration: 300 })
  },

  /** 预览图片 */
  previewImage(e) {
    var idx = e.currentTarget.dataset.index || 0
    var photos = this.data.photos
    if (!photos || photos.length === 0) return
    var urls = []
    for (var i = 0; i < photos.length; i++) {
      if (photos[i].url) urls.push(photos[i].url)
    }
    if (urls.length === 0) return
    wx.previewImage({ current: urls[idx], urls: urls })
  },

  /** 跳转登录页，可附带 pending action 类型（登录后自动触发该动作） */
  _redirectLogin(actionType) {
    // 先记录 pending action（登录后恢复用）
    if (actionType) {
      app.setPendingAction(actionType, { journalId: this.journalId })
    }
    const cur = getCurrentPages().slice(-1)[0]
    const qs = Object.entries(cur.options || {}).filter(([, v]) => v).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&').replace(/^/, '?')
    wx.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent('/' + cur.route + qs) })
  },

  // ==================== pending action 恢复（登录后自动继续动作） ====================

  /** 登录后自动执行之前中断的互动动作 */
  _handlePendingAction() {
    var action = app.consumePendingAction()
    if (!action || !action.type) return
    if (!this.journalId || !action.params) return
    if (action.params.journalId !== this.journalId) return

    switch (action.type) {
      case 'likeJournal':
        console.log('[pending] 登录后自动点赞', this.journalId)
        this.toggleCloudLike()
        break
      case 'collectJournal':
        console.log('[pending] 登录后自动收藏', this.journalId)
        this.toggleCloudCollect()
        break
      case 'focusComment':
        console.log('[pending] 登录后滚动到评论区', this.journalId)
        var self = this
        setTimeout(function() {
          wx.pageScrollTo({ selector: '.detail-comments', duration: 300 })
        }, 800)
        break
    }
  },

  goToUserProfile() {
    var app = getApp()
    var authorId = this.data.journal ? this.data.journal.author_id : ''
    var currentUserId = app.globalData.userId

    console.log('[作者跳转] authorId:', authorId)
    console.log('[作者跳转] currentUserId:', currentUserId)
    console.log('[作者跳转] 是否相同:', authorId === currentUserId)

    if (!authorId || authorId === currentUserId) {
      wx.switchTab({ url: '/pages/profile/profile' })
    } else {
      wx.navigateTo({
        url: '/pages/user/profile?userId=' + authorId,
        fail: function() { wx.switchTab({ url: '/pages/index/index' }) }
      })
    }
  },
  handleImageError(e) {
    handleImageError.call(this, e)
  },

  goBack() {
    try {
      var pages = getCurrentPages()
      if (pages.length <= 1) {
        // 没有上一页，回到首页
        wx.switchTab({ url: '/pages/index/index' })
      } else {
        wx.navigateBack()
      }
    } catch (e) {
      wx.switchTab({ url: '/pages/index/index' })
    }
  },
  _formatDate(d) { if (!d) return ''; const date = new Date(d); return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日' },
  _fmtRelative(d) { if (!d) return ''; const m = Math.floor((Date.now() - d) / 60000); if (m < 1) return '刚刚'; if (m < 60) return m + '分钟前'; const h = Math.floor(m / 60); return h < 24 ? h + '小时前' : Math.floor(h / 24) + '天前' },
  // ==================== 云端互动 ====================

  /** 从云端获取点赞/收藏状态 */
  getCloudLikeStatus(journalId) {
    var self = this
    return new Promise(function(resolve) {
      wx.cloud.callFunction({
        name: 'getLikeStatus',
        data: { journalId: journalId },
        success: function(res) {
          if (res.result && res.result.code === 0) {
            resolve({ isLiked: res.result.isLiked, isCollected: res.result.isCollected })
          } else {
            resolve({ isLiked: false, isCollected: false })
          }
        },
        fail: function() { resolve({ isLiked: false, isCollected: false }) }
      })
    })
  },

  /** 从云端获取评论列表 */
  getCloudComments(journalId) {
    var self = this
    return new Promise(function(resolve) {
      wx.cloud.callFunction({
        name: 'comment',
        data: { action: 'getComments', journalId: journalId },
        success: function(res) {
          console.log('[云端评论] getComments 返回:', JSON.stringify(res.result).substring(0, 300))
          if (res.result && res.result.code === 0) {
            resolve(res.result)
          } else {
            resolve({ journalComments: [], nodeCommentsMap: {} })
          }
        },
        fail: function() { resolve([]) }
      })
    })
  },

  /** 云端点赞切换 */
  toggleCloudLike() {
    var self = this
    var journalId = self.journalId
    if (!app.globalData.isLoggedIn) return self._redirectLogin('likeJournal')

    wx.cloud.callFunction({
      name: 'toggleLike',
      data: { targetId: journalId, targetType: 'journal' },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          var isLiked = res.result.isLiked
          var count = (self.data.journal.like_count || 0) + (isLiked ? 1 : -1)
          if (count < 0) count = 0
          self.setData({
            isLiked: isLiked,
            'journal.like_count': count
          })
          // 通知游记作者（仅点赞成功时）
          if (isLiked && self.data.journal && self.data.journal.author_id) {
            wx.cloud.callFunction({
              name: 'addNotification',
              data: {
                receiverId: self.data.journal.author_id,
                type: 'like',
                targetId: self.journalId,
                targetType: 'journal'
              }
            })
          }
        }
      },
      fail: function(err) {
        console.error('[点赞] 云函数失败:', err)
        wx.showToast({ title: '网络异常，请稍后再试', icon: 'none' })
      }
    })
  },

  /** 云端收藏切换 */
  toggleCloudCollect() {
    var self = this
    var journalId = self.journalId
    if (!app.globalData.isLoggedIn) return self._redirectLogin('collectJournal')
    console.log('[收藏] journalId:', journalId)

    wx.cloud.callFunction({
      name: 'toggleCollect',
      data: { journalId: journalId },
      success: function(res) {
        console.log('[收藏] 云函数返回:', JSON.stringify(res.result))
        if (res.result && res.result.code === 0) {
          var isCollected = res.result.isCollected
          var count = (self.data.journal.collect_count || 0) + (isCollected ? 1 : -1)
          if (count < 0) count = 0
          self.setData({
            isCollected: isCollected,
            'journal.collect_count': count
          })
          // 通知游记作者
          if (isCollected && self.data.journal && self.data.journal.author_id) {
            wx.cloud.callFunction({
              name: 'addNotification',
              data: {
                receiverId: self.data.journal.author_id,
                type: 'collect', targetId: self.journalId,
                targetType: 'journal', journalId: self.journalId
              }
            })
          }
          wx.showToast({ title: isCollected ? '已收藏' : '已取消收藏', icon: 'success' })
        } else {
          wx.showToast({ title: (res.result && res.result.message) || '操作失败', icon: 'error' })
        }
      },
      fail: function(err) {
        console.error('[收藏] 云函数失败:', err)
        wx.showToast({ title: '网络异常，请稍后再试', icon: 'none' })
      }
    })
  },

  /** 云端提交评论（含防重复） */
  /** 聚焦照片级评论 */
  focusPhotoComment(e) {
    var photoId = e.currentTarget.dataset.id
    var index = e.currentTarget.dataset.index
    this.setData({
      commentTargetPhotoId: photoId,
      commentTargetType: 'photo'
    })
    // 聚焦输入框
    var commentPlaceholder = '评论这张照片…'
    // 输入框已有内容，聚焦即可
  },

  /** 点击回复按钮 */
  onTapReply(e) {
    console.log('[回复] onTapReply 触发', JSON.stringify(e.currentTarget.dataset))
    var commentId = e.currentTarget.dataset.commentid
    var userId = e.currentTarget.dataset.userid
    var userName = e.currentTarget.dataset.username
    this.setData({
      replyTarget: {
        parentCommentId: commentId,
        replyToUserId: userId,
        replyToUserName: userName
      }
    })
  },

  /** 取消回复 */
  cancelReply() {
    this.setData({ replyTarget: null, commentInput: '' })
  },

  /** 展开/折叠节点评论 */
  toggleNodeComments(e) {
    var nodeid = e.currentTarget.dataset.nodeid
    var map = Object.assign({}, this.data.expandedNodeMap)
    map[nodeid] = !map[nodeid]
    this.setData({ expandedNodeMap: map })
  },

  /** 展开/折叠二级回复 */
  toggleRepliesExpand(e) {
    var commentId = e.currentTarget.dataset.commentid
    var map = Object.assign({}, this.data.expandedRepliesMap)
    map[commentId] = !map[commentId]
    this.setData({ expandedRepliesMap: map })
  },

  submitCloudComment() {
    var self = this
    console.log('[评论提交] data:', JSON.stringify({ commentInput: this.data.commentInput, replyTarget: this.data.replyTarget, nodeCommentTarget: this.data.nodeCommentTarget }))
    if (self.data.isSubmittingComment) return
    var content = self.data.commentInput || ''
    if (!content.trim()) { wx.showToast({ title: '请输入评论内容', icon: 'none' }); return }
    if (!app.globalData.isLoggedIn) return self._redirectLogin('focusComment')

    self.setData({ commentInput: '', isSubmittingComment: true })
    var user = app.globalData.userInfo || {}
    var target = self.data.replyTarget
    var nodeTarget = self.data.nodeCommentTarget

    var params = {
      action: 'addComment',
      journalId: self.journalId,
      imageId: nodeTarget || self.data.commentTargetPhotoId || '',
      content: content.trim()
    }

    if (target) {
      params.parentCommentId = target.parentCommentId
      params.replyToUserId = target.replyToUserId
      params.replyToUserName = target.replyToUserName
    }

    console.log('[评论提交-前] 即将调用云函数, name: comment, data:', JSON.stringify(params))

    wx.cloud.callFunction({
      name: 'comment',
      data: params,
      success: function(res) {
        console.log('[评论提交-成功] 云函数返回:', JSON.stringify(res.result))
        self.setData({ isSubmittingComment: false })
        if (res.result && res.result.code === 0) {
          // 重新加载评论列表（树状结构）
          self.loadCloudComments(self.journalId)

          // 触发通知
          if (target) {
            // 二级回复 → 通知被回复者
            wx.cloud.callFunction({
              name: 'addNotification',
              data: {
                receiverId: target.replyToUserId,
                targetId: target.parentCommentId,
                targetType: 'comment',
                type: 'reply',
                postId: self.journalId,
                commentId: res.result.comment._id,
                parentCommentId: target.parentCommentId,
                contentPreview: content.trim().substring(0, 50)
              }
            })
          } else if (self.data.journal && self.data.journal.author_id) {
            // 一级评论 → 通知游记作者
            var isPhotoComment = self.data.commentTargetType === 'photo'
            var ntfData = {
              receiverId: self.data.journal.author_id,
              type: isPhotoComment ? 'image_comment' : 'journal_comment',
              targetType: isPhotoComment ? 'image' : 'journal',
              targetId: isPhotoComment ? (self.data.commentTargetPhotoId || self.journalId) : self.journalId,
              postId: self.journalId,
              contentPreview: content.trim().substring(0, 50)
            }
            if (isPhotoComment) {
              ntfData.imageId = self.data.commentTargetPhotoId || ''
            }
            wx.cloud.callFunction({
              name: 'addNotification',
              data: ntfData
            })
          }

          self.setData({ commentTargetType: 'journal', commentTargetPhotoId: null, replyTarget: null, nodeCommentTarget: null, commentInputPlaceholder: '分享你的想法...' })
          wx.showToast({ title: '评论成功', icon: 'success' })
        } else {
          wx.showToast({ title: (res.result && res.result.message) || '发送失败', icon: 'error' })
        }
      },
      fail: function(err) {
        self.setData({ isSubmittingComment: false })
        console.error('[评论提交-失败] 云函数错误:', err)
        wx.showToast({ title: '发送失败，请重试', icon: 'none' })
      }
    })
  },

  /** 删除自己的评论 */
  deleteCloudComment(e) {
    var self = this
    var commentId = e.currentTarget.dataset.id
    var journalId = this.journalId
    wx.showModal({
      title: '删除评论', content: '确定要删除这条评论吗？', confirmColor: '#FF4444',
      success: function(res) {
        if (!res.confirm) return
        wx.cloud.callFunction({
          name: 'deleteComment',
          data: { commentId: commentId, journalId: journalId },
          success: function(r) {
            if (r.result && r.result.code === 0) {
              var comments = self.data.comments.filter(function(c) { return c._id !== commentId })
              self.setData({ comments: comments, commentCount: comments.length })
              wx.showToast({ title: '已删除', icon: 'success' })
            } else {
              wx.showToast({ title: r.result.message || '删除失败', icon: 'error' })
            }
          },
          fail: function() { wx.showToast({ title: '删除失败', icon: 'error' }) }
        })
      }
    })
  },

  /** 格式化时间 */
  formatTime(timeStr) {
    if (!timeStr) return ''
    try {
      var date = new Date(timeStr)
      if (isNaN(date.getTime())) return ''
      var now = new Date()
      var diff = now - date
      var days = Math.floor(diff / 86400000)
      if (days === 0) return '今天'
      if (days === 1) return '昨天'
      if (days < 30) return days + '天前'
      return timeStr.slice(0, 10)
    } catch (e) {
      return ''
    }
  },

  onShareAppMessage() { const j = this.data.journal; return j ? { title: j.title || '兔子旅行', path: '/pages/journal/detail?id=' + j._id } : {} },
})
