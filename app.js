// ========================================
// 兔子旅行 — 小程序入口
// ========================================
const userService = require('./services/user-service')

App({
  globalData: {
    isCloudReady: false,
    userInfo: null,
    /** 用户唯一ID，统一来源，游记 author_id 以此为准 */
    userId: null,
    isLoggedIn: false,
    isAdmin: false,
    /** 等待登录后执行的动作 */
    pendingAction: null,
    statusBarHeight: 44,
    navBarHeight: 44,
  },

  onLaunch() {
    this.initSystemInfo()
    this.initCloud()

    // ★★★ 退出标记检查：如果用户主动退出过，保持游客态，不恢复也不自动登录 ★★★
    if (wx.getStorageSync('hasLoggedOut')) {
      console.log('[app] 检测到退出标记，保持游客态')
      this.globalData.isLoggedIn = false
      return
    }

    // 无退出标记 → 恢复本地缓存 + 云端登录
    this.restoreLogin()
    this.doLogin()
  },

  /** 获取系统信息（状态栏高度等），存入全局供页面读取 */
  initSystemInfo() {
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const menu = wx.getMenuButtonBoundingClientRect()
      this.globalData.statusBarHeight = info.statusBarHeight || 44
      this.globalData.navBarHeight = menu
        ? (menu.top - info.statusBarHeight) * 2 + menu.height
        : 44
      // 胶囊右侧安全区：导航栏内容需在胶囊左侧
      if (menu) {
        this.globalData.capsulePaddingRight = info.screenWidth - menu.left + 8
      } else {
        this.globalData.capsulePaddingRight = 95
      }
    } catch (e) {
      this.globalData.statusBarHeight = 44
      this.globalData.navBarHeight = 44
      this.globalData.capsulePaddingRight = 95
    }
  },

  initCloud() {
    if (!wx.cloud) {
      console.warn('请使用 2.2.3 或以上版本基础库以使用云能力')
      return
    }
    wx.cloud.init({
      env: 'cloudbase-0gx2xhccf8b7742d',
      traceUser: true,
    })
    this.globalData.isCloudReady = true
    console.log('[兔子旅行] 云开发已初始化')
    console.log('[ENV] CloudBase环境ID: cloudbase-0gx2xhccf8b7742d')
  },

  /** 恢复登录态（本地缓存） */
  restoreLogin() {
    // 从 token + userInfo 两个 key 恢复（app.doLogin 写入的）
    const token = wx.getStorageSync('token')
    var user = null
    var raw = null
    try {
      raw = wx.getStorageSync('userInfo')
      if (raw) user = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch (e) {}
    // 也尝试 userService 的 key（兼容旧路径）
    if (!user) user = userService.checkLogin()
    if (token && user) {
      this.globalData.userInfo = user
      this.globalData.userId = user._id || user.openid || ''
      this.globalData.isLoggedIn = true
      this.globalData.isAdmin = user.is_admin || false
    }
  },

  /** 执行登录 */
  async doLogin() {
    var user = null
    var source = 'none'
    // 优先云端登录
    if (this.globalData.isCloudReady) {
      try {
        var res = await wx.cloud.callFunction({ name: 'login' })
        console.log('[app] 云函数返回:', JSON.stringify(res))
        if (res.result && res.result.code === 0) {
          user = res.result.user
          source = 'cloud'
        }
      } catch (err) {
        console.warn('[app] 云端登录失败', err)
      }
    }
    // 降级本地
    if (!user) {
      user = await userService.login()
      source = 'local'
    }
    this.globalData.userInfo = user
    this.globalData.userId = (user && (user.openid || user._id)) || ''
    this.globalData.isLoggedIn = true
    this.globalData.isAdmin = (user && user.is_admin) || false
    // 持久化
    if (this.globalData.userId) {
      wx.setStorageSync('userId', this.globalData.userId)
      wx.setStorageSync('userInfo', JSON.stringify(user))
      wx.setStorageSync('token', this.globalData.userId)
    }
    console.log('[app] 登录完成, source:', source, ', userId:', this.globalData.userId)
    return user
  },

  /** 退出登录 */
  doLogout() {
    userService.logout()
    this.globalData.userInfo = null
    this.globalData.userId = null
    this.globalData.isLoggedIn = false
    this.globalData.isAdmin = false
  },

  // ==================== pending action（登录后自动继续动作） ====================

  /** 设置 pending action，存入 globalData 和 storage 防止页面重建丢失 */
  setPendingAction(type, params) {
    const action = { type, params }
    this.globalData.pendingAction = action
    try { wx.setStorageSync('pendingAction', JSON.stringify(action)) } catch (e) {}
  },

  /** 消费（读取并清除）pending action，返回 null 或动作对象 */
  consumePendingAction() {
    const action = this.globalData.pendingAction
    this.globalData.pendingAction = null
    try { wx.removeStorageSync('pendingAction') } catch (e) {}
    return action
  },

  /** 从 storage 恢复 pending action（页面初始化时调用） */
  restorePendingAction() {
    try {
      const raw = wx.getStorageSync('pendingAction')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.type) {
          this.globalData.pendingAction = parsed
        }
      }
    } catch (e) {}
  },

  /** 清除 pending action（登录取消/跳过时调用） */
  clearPendingAction() {
    this.globalData.pendingAction = null
    try { wx.removeStorageSync('pendingAction') } catch (e) {}
  },
})
