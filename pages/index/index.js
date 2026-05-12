// pages/index/index.js — 首页 V2（双模式切换 + 分页）
import JournalModel from '../../models/journal-model'
import handleImageError from '../../utils/image-helper'

Page({
  data: {
    journals: [],
    journalsLeft: [],
    journalsRight: [],
    loading: false,
    loaded: false,
    statusBarHeight: 44,
    displayMode: 'film',
    page: 1,
    hasMore: true,
    isLoadingMore: false,
  },

  onLoad() {
    var app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight || 44,
      navPaddingRight: app.globalData.capsulePaddingRight || 95,
    })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setSelected(0)
    }
    this.setData({ page: 1, hasMore: true })
    this.loadJournals()
  },

  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true })
    this.loadJournals().then(function() { wx.stopPullDownRefresh() })
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.isLoadingMore) return
    this.loadMore()
  },

  formatDate(d) {
    if (!d) return ''
    var date = new Date(d)
    return (date.getMonth() + 1) + '月' + date.getDate() + '日'
  },

  async loadJournals() {
    this.setData({ loading: true, page: 1 })
    try {
      var result = await JournalModel.listWithFallback(1)
      var list = result.journals || []
      var journals = list.map(function(j) {
        var coverUrl = j.cover || (j.photos && j.photos[0] ? j.photos[0].url : '')
        if (!coverUrl && j.images && j.images.length > 0) {
          coverUrl = typeof j.images[0] === 'string' ? j.images[0] : (j.images[0].url || j.images[0].path || '')
        }
        return { ...j, _pubDate: this.formatDate(j.published_at), coverUrl: coverUrl }
      }.bind(this))
      this.setData({ journals: journals, loaded: true })
      this.splitColumns(journals)
    } catch (err) {
      console.error('加载游记失败', err)
      this.setData({ loaded: true })
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadMore() {
    this.setData({ isLoadingMore: true })
    var nextPage = this.data.page + 1
    try {
      var result = await JournalModel.listWithFallback(nextPage)
      var list = result.journals || []
      if (list.length === 0) {
        this.setData({ hasMore: false, isLoadingMore: false })
        return
      }
      var processed = list.map(function(j) {
        var coverUrl = j.cover || (j.photos && j.photos[0] ? j.photos[0].url : '')
        return { ...j, _pubDate: this.formatDate(j.published_at), coverUrl: coverUrl }
      }.bind(this))
      var all = this.data.journals.concat(processed)
      this.setData({ journals: all, page: nextPage, isLoadingMore: false })
      this.splitColumns(all)
    } catch (e) {
      this.setData({ isLoadingMore: false })
    }
  },

  splitColumns(journals) {
    var left = []
    var right = []
    for (var i = 0; i < journals.length; i++) {
      i % 2 === 0 ? left.push(journals[i]) : right.push(journals[i])
    }
    this.setData({ journalsLeft: left, journalsRight: right })
  },

  switchMode(e) {
    var mode = e.currentTarget.dataset.mode
    this.setData({ displayMode: mode })
  },

  handleImageError(e) {
    handleImageError.call(this, e)
  },

  // 兼容旧写法，保留引用
  onImageError: function() {},

  goToDetail(e) {
    var id = e.currentTarget.dataset.id
    if (id) wx.navigateTo({ url: '/pages/journal/detail?id=' + id })
  },

  /** 搜索确认（键盘确认键） */
  onSearchConfirm(e) {
    var keyword = e.detail.value.trim()
    if (!keyword) return
    wx.navigateTo({ url: '/pages/search/search?keyword=' + encodeURIComponent(keyword) })
  },

  onSearchFocus() {
    // 可选：聚焦时不做额外处理
  },

  onSearchBlur() {
    // 可选：失焦不做处理
  },

  goToPublish() {
    wx.switchTab({ url: '/pages/publish/publish' })
  },
})
