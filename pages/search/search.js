// pages/search/search.js — 搜索页
import JournalModel from '../../models/journal-model'
import handleImageError from '../../utils/image-helper'

Page({
  data: { statusBarHeight: 44 },
  onLoad(options) {
    var app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight || 44,
      navPaddingRight: app.globalData.capsulePaddingRight || 95,
    })
    // 从 URL 参数接收关键词并自动搜索
    if (options && options.keyword) {
      this.setData({ keyword: options.keyword })
      this.onSearch()
    }
  },
  data: {
    keyword: '',
    results: [],
    hasSearched: false,
  },

  handleImageError(e) {
    handleImageError.call(this, e)
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearch() {
    const kw = this.data.keyword.trim()
    if (!kw) return

    const all = JournalModel.loadAll()
    const published = all.filter((j) => j.status === 'published')
    const results = published.filter((j) => {
      return j.title && j.title.toLowerCase().includes(kw.toLowerCase())
    })

    this.setData({ results, hasSearched: true })
  },

  clearKeyword() {
    this.setData({ keyword: '', results: [], hasSearched: false })
  },

  goToDetail(e) {
    wx.navigateTo({ url: '/pages/journal/detail?id=' + e.currentTarget.dataset.id })
  },

  goBack() { wx.navigateBack() },
})
