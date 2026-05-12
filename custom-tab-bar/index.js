Component({
  data: {
    value: '',
    hidden: false
  },
  lifetimes: {
    attached() {
      this._checkVisibility();
    }
  },
  pageLifetimes: {
    show() {
      this._checkVisibility();
    }
  },
  methods: {
    _checkVisibility() {
      var pages = getCurrentPages();
      var curPage = pages[pages.length - 1];
      if (curPage) {
        var route = curPage.route || '';

        // TabBar 页面路由 → tab value 映射
        var tabRouteMap = {
          'pages/index/index': 'home',
          'pages/publish/publish': 'publish',
          'pages/profile/profile': 'profile'
        };

        // 可见性：发布页（及所有 pages/publish 开头页面）隐藏，其他显示
        var hide = route.indexOf('pages/publish') === 0;
        // tab 选中值：命中映射表则取对应值，否则保持当前值不变
        var value = tabRouteMap[route] || this.data.value || '';

        console.log('[TabBar] 当前路径:', route, '是否隐藏:', hide, '选中:', value, 'pages:', pages.length);
        this.setData({ hidden: hide, value: value });
      } else {
        console.log('[TabBar] curPage 为空，pages:', pages.length);
      }
    },
    setSelected(idx) {
      var map = { 0: 'home', 1: 'publish', 2: 'profile' };
      this.setData({ value: map[idx] || 'home' });
    },
    onTabTap(e) {
      var tab = e.currentTarget.dataset.tab;

      // ★ 即时更新选中态：不等 pageLifetimes.show()，避免 switchTab 时序竞争
      var tabValueMap = { home: 'home', publish: 'publish', profile: 'profile' };
      if (tabValueMap[tab] !== undefined) {
        this.setData({ value: tabValueMap[tab] });
      }

      var map = {
        home: '/pages/index/index',
        publish: '/pages/publish/publish',
        profile: '/pages/profile/profile'
      };
      if (tab === 'profile') {
        var userInfo = wx.getStorageSync('userInfo');
        if (!userInfo) {
          wx.navigateTo({ url: '/pages/login/login' });
          return;
        }
      }
      var url = map[tab];
      if (url) {
        wx.switchTab({ url: url });
      }
    }
  }
});
