// config/index.js — 全局配置

/** 云开发环境 ID */
export const CLOUD_ENV = 'rabbit-travel-prod'

/** 云函数名称 */
export const CLOUD_FUNCTIONS = {
  LOGIN: 'login',
  JOURNAL: 'journal',
  COMMENT: 'comment',
  NOTIFICATION: 'notification',
  PARSE_EXIF: 'parseExif',
}

/** 数据库集合 */
export const DB = {
  USERS: 'users',
  JOURNALS: 'journals',
  NODES: 'nodes',
  COMMENTS: 'comments',
  NOTIFICATIONS: 'notifications',
}

/** 颜色 */
export const COLORS = {
  PRIMARY: '#8A4DFF',
  PRIMARY_DEEP: '#7C4DFF',
  ACCENT: '#FFB300',
  DANGER: '#FF4444',
  TEXT: '#1A1A1A',
  TEXT_SEC: '#999999',
  BG_LIGHT: '#F5F0FF',
}
