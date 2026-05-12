// pages/admin/index.js — 管理后台（云端）
import handleImageError from '../../utils/image-helper'
const app = getApp()

Page({
  data: {
    statusBarHeight: 44,
    navPaddingRight: 95,
    stats: { totalUsers: 0, totalJournals: 0, todayUsers: 0, todayJournals: 0 },
    journals: [],
    users: [],
    tab: 'journals',
    loading: false,
    /** 批量选择：已勾选的游记 _id 集合 */
    selectedIds: [],
    /** 批量选择模式 */
    batchMode: false,
  },

  onLoad() {
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight || 44,
      navPaddingRight: app.globalData.capsulePaddingRight || 95
    })
    // 非管理员拦截
    if (!app.globalData.isAdmin) {
      wx.showToast({ title: '无权限', icon: 'error' })
      setTimeout(() => wx.switchTab({ url: '/pages/profile/profile' }), 1200)
      return
    }
    this.loadStats()
    this.loadJournals()
  },

  // ==================== 系统统计 ====================
  /** 来源：getAdminStats 云函数（count 聚合） */
  loadStats() {
    wx.cloud.callFunction({
      name: 'getAdminStats',
      data: {},
      success: (res) => {
        if (res.result && res.result.code === 0) {
          this.setData({ stats: res.result.stats })
        }
      },
      fail: () => {
        wx.showToast({ title: '统计加载失败', icon: 'error' })
      }
    })
  },

  // ==================== 游记管理 ====================
  /** 来源：getAdminJournals 云函数（管理员专用，全量拉取） */
  loadJournals() {
    this.setData({ loading: true })
    wx.cloud.callFunction({
      name: 'getAdminJournals',
      data: {},
      success: (res) => {
        if (res.result && res.result.code === 0) {
          const list = (res.result.journals || []).map(j => ({
            ...j,
            _statusLabel: j.status === 'published' ? '已发布' : '草稿',
            _time: j.published_at || j.updated_at || ''
          }))
          this.setData({ journals: list })
        } else {
          wx.showToast({ title: res.result.message || '游记加载失败', icon: 'error' })
        }
      },
      fail: () => {
        wx.showToast({ title: '游记加载失败', icon: 'error' })
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  },

  /** 单条删除游记 — 来源：adminDeleteJournal 云函数 */
  deleteJournal(e) {
    const id = e.currentTarget.dataset.id
    const title = e.currentTarget.dataset.title || '未命名'
    wx.showModal({
      title: '删除游记',
      content: '确定要删除「' + title + '」吗？',
      confirmColor: '#FF4444',
      success: (res) => {
        if (!res.confirm) return
        wx.cloud.callFunction({
          name: 'adminDeleteJournal',
          data: { journalId: id },
          success: (r) => {
            if (r.result && r.result.code === 0) {
              this.loadStats()
              this.loadJournals()
              wx.showToast({ title: '已删除', icon: 'success' })
            } else {
              wx.showToast({ title: r.result.message || '删除失败', icon: 'error' })
            }
          },
          fail: () => { wx.showToast({ title: '删除失败', icon: 'error' }) }
        })
      }
    })
  },

  /** 切换批量选择模式 */
  toggleBatchMode() {
    this.setData({
      batchMode: !this.data.batchMode,
      selectedIds: []
    })
  },

  /** 勾选 / 取消勾选游记 */
  toggleSelect(e) {
    const id = e.currentTarget.dataset.id
    let selected = this.data.selectedIds
    if (selected.includes(id)) {
      selected = selected.filter(sid => sid !== id)
    } else {
      selected = [...selected, id]
    }
    this.setData({ selectedIds: selected })
  },

  /** 全选 / 取消全选 */
  toggleSelectAll() {
    const allIds = this.data.journals.map(j => j._id)
    if (this.data.selectedIds.length === allIds.length) {
      this.setData({ selectedIds: [] })
    } else {
      this.setData({ selectedIds: allIds })
    }
  },

  /** 批量删除 */
  batchDelete() {
    const ids = this.data.selectedIds
    if (!ids.length) {
      wx.showToast({ title: '请先选择游记', icon: 'none' })
      return
    }
    wx.showModal({
      title: '批量删除',
      content: `确定要删除选中的 ${ids.length} 篇游记吗？`,
      confirmColor: '#FF4444',
      success: (res) => {
        if (!res.confirm) return
        // 逐个删除（云数据库单次 remove 不支持批量 _id）
        let successCount = 0
        let failCount = 0
        let done = 0
        const total = ids.length
        ids.forEach((id) => {
          wx.cloud.callFunction({
            name: 'adminDeleteJournal',
            data: { journalId: id },
            success: (r) => {
              if (r.result && r.result.code === 0) {
                successCount++
              } else {
                failCount++
              }
            },
            fail: () => { failCount++ },
            complete: () => {
              done++
              if (done >= total) {
                this.setData({ selectedIds: [], batchMode: false })
                this.loadStats()
                this.loadJournals()
                wx.showToast({ title: `删除完成 (成功${successCount}, 失败${failCount})`, icon: successCount > 0 ? 'success' : 'error' })
              }
            }
          })
        })
      }
    })
  },

  // ==================== 用户管理 ====================
  /** 来源：getAdminUsers 云函数（管理员专用，含游记计数） */
  loadUsers() {
    this.setData({ loading: true })
    wx.cloud.callFunction({
      name: 'getAdminUsers',
      data: {},
      success: (res) => {
        if (res.result && res.result.code === 0) {
          this.setData({ users: res.result.users || [] })
        }
      },
      fail: () => {
        wx.showToast({ title: '用户加载失败', icon: 'error' })
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  },

  // ==================== Tab 切换 ====================
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ tab: tab })
    if (tab === 'users') this.loadUsers()
  },

  // ==================== 工具栏 ====================
  handleImageError(e) {
    handleImageError.call(this, e)
  },

  goBack() { wx.navigateBack() },
})
