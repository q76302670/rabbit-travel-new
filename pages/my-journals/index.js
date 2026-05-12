// pages/my-journals/index.js — 我的游记（云端优先）
import JournalModel from '../../models/journal-model'
import handleImageError from '../../utils/image-helper'

const app = getApp()

Page({
  data: {
    statusBarHeight: 44,
    journals: [],
    loading: false,
  },

  onLoad() {
    this.setData({ statusBarHeight: getApp().globalData.statusBarHeight || 44 })
  },

  onShow() {
    this.load()
  },

  load() {
    this.setData({ loading: true })

    // 云端优先
    var self = this
    wx.cloud.callFunction({
      name: 'getUserJournals',
      data: { type: 'published' },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          var journals = (res.result.journals || []).map(function(j) {
            return {
              ...j,
              _time: self._fmt(j.published_at),
              _location: j.destination || j.location || '兔子窝',
              coverUrl: j.cover || (j.photos && j.photos[0] ? j.photos[0].url : '')
            }
          })
          self.setData({ journals: journals, loading: false })
        } else {
          throw new Error(res.result ? res.result.message : '加载失败')
        }
      },
      fail: function() {
        // 降级本地
        var user = app.globalData.userInfo
        if (!user) { self.setData({ loading: false }); return }
        try {
          var list = JournalModel.listByAuthor(user._id)
            .filter(function(j) { return j.status === 'published' })
            .map(function(j) { return { ...j, _time: self._fmt(j.published_at), _location: j.destination || j.location || '兔子窝' } })
          self.setData({ journals: list, loading: false })
        } catch (e) {
          self.setData({ loading: false })
        }
      }
    })
  },

  _fmt(d) {
    if (!d) return ''
    var date = new Date(d)
    return date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate()
  },

  handleImageError(e) {
    handleImageError.call(this, e)
  },

  goToDetail(e) {
    wx.navigateTo({ url: '/pages/journal/detail?id=' + e.currentTarget.dataset.id })
  },

  goBack() {
    var pages = getCurrentPages()
    if (pages.length <= 1) {
      wx.switchTab({ url: '/pages/profile/profile' })
    } else {
      wx.navigateBack()
    }
  },
})
