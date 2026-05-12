// pages/drafts/drafts.js — 草稿箱
import JournalModel from '../../models/journal-model'
import handleImageError from '../../utils/image-helper'

const app = getApp()

Page({
  data: {
    statusBarHeight: 44,
    drafts: [],
    loading: false,
  },

  onLoad() {
    this.setData({ statusBarHeight: app.globalData.statusBarHeight || 44 })
  },

  onShow() {
    if (!app.globalData.isLoggedIn) {
      const pages = getCurrentPages()
      const current = pages[pages.length - 1]
      const qs = this._serializeQuery(current.options || {})
      const redirect = '/' + current.route + qs
      wx.navigateTo({ url: '/pages/login/login?redirect=' + encodeURIComponent(redirect) })
      return
    }
    this.loadDrafts()
  },

  _serializeQuery(options) {
    if (!options) return ''
    return Object.entries(options).filter(([, v]) => v).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&').replace(/^/, '?')
  },

  async loadDrafts() {
    this.setData({ loading: true })
    try {
      // 统一走 model — 云端优先，本地兜底
      const drafts = await JournalModel.listDrafts()
      const list = (drafts || []).map(function(d) {
        return {
          ...d,
          _isDraft: true,
          _time: this._formatTime(d.updated_at),
          coverUrl: d.cover || (d.photos && d.photos[0] ? d.photos[0].url : ''),
          // 兼容字段：model 输出 photo_count（snake_case），这里给 WXML 备一个驼峰
          photoCount: d.photo_count || 0
        }
      }.bind(this))
      this.setData({ drafts: list })
    } catch (e) {
      console.error('加载草稿失败', e)
    } finally {
      this.setData({ loading: false })
    }
  },

  _formatTime(d) {
    if (!d) return ''
    const date = new Date(d)
    return (date.getMonth() + 1) + '/' + date.getDate() + ' ' + (date.getHours() < 10 ? '0' : '') + date.getHours() + ':' + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
  },

  editDraft(e) {
    var id = e.currentTarget.dataset.id
    console.log('[草稿箱] 跳转编辑草稿 id:', id)
    // 发布页是 TabBar 页，不能 navigateTo，用全局状态传参
    var app = getApp()
    app.globalData.pendingDraftId = id
    wx.switchTab({ url: '/pages/publish/publish' })
  },

  handleImageError(e) {
    handleImageError.call(this, e)
  },

  async deleteDraft(e) {
    var id = e.currentTarget.dataset.id
    var title = e.currentTarget.dataset.title || '未命名'
    var self = this
    wx.showModal({
      title: '删除草稿', content: '确定要删除「' + title + '」吗？', confirmColor: '#FF4444',
      success: function(res) {
        if (!res.confirm) return
        // 先 await 删除完成，再重新加载列表 — 避免云端未删完就刷新导致"删了又出现"
        (async () => {
          try {
            await JournalModel.deleteDraft(id)
            self.loadDrafts()
            wx.showToast({ title: '已删除', icon: 'none' })
          } catch (err) {
            console.error('删除草稿失败', err)
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        })()
      }
    })
  },

  goBack() {
    try {
      var pages = getCurrentPages()
      if (pages.length <= 1) {
        wx.switchTab({ url: '/pages/profile/profile' })
      } else {
        wx.navigateBack()
      }
    } catch (e) {
      wx.switchTab({ url: '/pages/profile/profile' })
    }
  },
})
