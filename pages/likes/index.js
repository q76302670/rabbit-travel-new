// pages/likes/index.js — 点赞列表（云端数据）
import handleImageError from '../../utils/image-helper'
Page({
  data: {
    statusBarHeight: 44,
    navPaddingRight: 95,
    journals: [],
    leftCol: [],
    rightCol: [],
    loading: false,
  },

  onLoad() {
    this.setData({
      statusBarHeight: getApp().globalData.statusBarHeight || 44,
      navPaddingRight: getApp().globalData.capsulePaddingRight || 95
    })
  },

  onShow() { this.load() },

  /** 将数组拆分为左右两列 */
  _splitColumns(arr) {
    var left = []
    var right = []
    for (var i = 0; i < arr.length; i++) {
      i % 2 === 0 ? left.push(arr[i]) : right.push(arr[i])
    }
    return { left: left, right: right }
  },

  load() {
    var self = this
    self.setData({ loading: true })
    wx.cloud.callFunction({
      name: 'getUserLikes',
      data: { type: 'journal' },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          var journals = (res.result.journals || []).map(function(j) {
            return { ...j, coverUrl: j.cover || (j.photos && j.photos[0] ? j.photos[0].url : '') }
          })
          var cols = self._splitColumns(journals)
          self.setData({ journals: journals, leftCol: cols.left, rightCol: cols.right, loading: false })
        } else {
          self.setData({ loading: false })
        }
      },
      fail: function(err) {
        console.error('[点赞列表] 加载失败:', err)
        self.setData({ loading: false })
        wx.showToast({ title: '加载失败', icon: 'none' })
      }
    })
  },

  handleImageError(e) {
    handleImageError.call(this, e)
  },

  goToDetail(e) {
    wx.navigateTo({ url: '/pages/journal/detail?id=' + e.currentTarget.dataset.id })
  },

  goBack() { wx.navigateBack() },
})
