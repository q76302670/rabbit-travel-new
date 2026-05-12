// pages/poster/index.js — 节点海报生成（占位）
import handleImageError from '../../utils/image-helper'
const app = getApp()

Page({
  data: {
    statusBarHeight: 44,
    navPaddingRight: 95,
    photos: [],
    selectedIndex: 0,
  },

  onLoad(query) {
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight || 44,
      navPaddingRight: app.globalData.capsulePaddingRight || 95
    })
    if (query.id) {
      // 从缓存获取游记照片
      var journalId = query.id
      this.loadJournalPhotos(journalId)
    }
  },

  loadJournalPhotos(journalId) {
    var self = this
    wx.cloud.callFunction({
      name: 'getJournalDetail',
      data: { journalId: journalId },
      success: function(res) {
        if (res.result && res.result.code === 0) {
          var photos = (res.result.journal.photos || []).sort(function(a,b) { return a.sort_index - b.sort_index })
          self.setData({ photos: photos })
        }
      }
    })
  },

  handleImageError(e) {
    handleImageError.call(this, e)
  },

  selectPhoto(e) {
    this.setData({ selectedIndex: e.currentTarget.dataset.index })
  },

  savePoster() {
    wx.showToast({ title: '保存成功', icon: 'success' })
  },

  sharePoster() {
    wx.showToast({ title: '分享成功', icon: 'success' })
  },

  goBack() { wx.navigateBack() },
})
