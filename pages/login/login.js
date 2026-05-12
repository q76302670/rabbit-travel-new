// pages/login/login.js — 登录页
const app = getApp()

Page({
  data: {
    statusBarHeight: 44,
    loading: false,
    agreed: true,
    redirect: '',
  },

  onLoad(query) {
    this.setData({ statusBarHeight: getApp().globalData.statusBarHeight || 44 })
    const raw = query.redirect || ''
    this.redirect = decodeURIComponent(raw)
    // 恢复pending action，防止页面重建丢失
    app.restorePendingAction()
  },

  /** TabBar 页面路径前缀，redirectTo 不允许用于 TabBar */
  _tabPages: ['/pages/index/index', '/pages/publish/publish', '/pages/profile/profile'],

  /** 判断是否 TabBar 页面 */
  _isTabPage(url) {
    return this._tabPages.some((p) => url.startsWith(p))
  },

  async doLogin() {
    console.log('[login] agreed:', this.data.agreed)
    // 检查协议勾选
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意协议', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      await app.doLogin()
      // ★★★ 清除退出标记，下次冷启动恢复正常自动登录 ★★★
      wx.removeStorageSync('hasLoggedOut')
      console.log('[login] 已清除退出标记 hasLoggedOut')
      wx.showToast({ title: '登录成功', icon: 'success', duration: 1000 })
      setTimeout(() => {
        // ★ 消费 pending action：登录后自动执行之前中断的动作
        const action = app.consumePendingAction()
        if (action) {
          switch (action.type) {
            case 'likeJournal':
            case 'collectJournal':
            case 'focusComment':
              // 这三种跳转的细节在 detail.js _handlePendingAction 处理
              // 用正常的 redirect 回详情页即可，onLoad 中自动消费
              break
            case 'openPublish':
              // 发布页在 onShow 中设了 pending，登录后跳回发布页
              wx.switchTab({ url: '/pages/publish/publish' })
              return
          }
        }

        if (this.redirect) {
          if (this._isTabPage(this.redirect)) {
            wx.switchTab({ url: this.redirect })
          } else {
            wx.redirectTo({ url: this.redirect })
          }
        } else {
          wx.switchTab({ url: '/pages/index/index' })
        }
      }, 1200)
    } catch (err) {
      console.error('登录失败', err)
      wx.showToast({ title: '登录失败，请重试', icon: 'error' })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 处理微信 bindgetuserinfo 事件（旧 open-type 兼容）
   * 用户点击按钮后触发 doLogin 完成实际登录
   */
  onGetUserInfo(e) {
    if (e.detail && e.detail.errMsg && e.detail.errMsg.indexOf('fail') !== -1) {
      // 用户拒绝授权，不打扰，静默处理
      return
    }
    this.doLogin()
  },

  /** 打开用户协议 */
  openAgreement() {
    wx.navigateTo({ url: '/pages/agreement/index?type=agreement' })
  },

  /** 打开隐私政策 */
  openPrivacy() {
    wx.navigateTo({ url: '/pages/agreement/index?type=privacy' })
  },

  /** 打开儿童协议 */
  openChildren() {
    wx.navigateTo({ url: '/pages/agreement/index?type=children' })
  },

  /** 其他登录方式（暂不实现） */
  onOtherLogin() {
    // 预留，暂不跳转
  },

  /** 勾选协议变更 */
  onAgreeChange() {
    const newVal = !this.data.agreed
    this.setData({ agreed: newVal })
    console.log('[agree] toggled:', newVal)
  },

  /** 关闭按钮：后退或回首页兜底 */
  closeLogin() {
    app.clearPendingAction() // 用户取消登录，清除pending
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack()
    } else {
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  skipLogin() {
    app.clearPendingAction() // 跳过登录，清除pending
    wx.switchTab({ url: '/pages/index/index' })
  },
})
