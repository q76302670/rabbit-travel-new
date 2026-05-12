/**
 * utils/image-helper.js — 通用图片加载失败处理
 *
 * 所有页面统一使用此工具处理图片加载失败，确保：
 * - 图片失败时清空 URL → 触发 wx:else 显示占位
 * - 头像类、封面类有统一的占位风格
 *
 * 用法：
 *   1. import handleImageError from '../../utils/image-helper'
 *   2. WXML: <image src="{{...}}" binderror="handleImageError" data-imgfield="fieldName" />
 *   3. 列表项：binderror 会自动清除 data-imgfield 指定的字段
 */

export default function handleImageError(e) {
  const ds = e.currentTarget.dataset || {}
  const field = ds.imgfield || 'coverUrl'

  // 如果指定了 data-imglist（列表页：列表数据变量名），在列表中查找并清除
  const listKey = ds.imglist
  if (listKey && ds.id !== undefined && ds.id !== null) {
    const id = ds.id
    const list = Array.isArray(this.data[listKey]) ? [...this.data[listKey]] : []

    // 如果指定了 data-imgidfield，则用该字段作为 id 匹配 key
    const idField = ds.imgidfield || '_id'

    // 如果也指定了 data-idx（索引），优先用索引更新
    if (ds.idx !== undefined) {
      const idx = parseInt(ds.idx, 10)
      if (!isNaN(idx) && idx >= 0 && idx < list.length) {
        list[idx] = { ...list[idx], [field]: '' }
        return this.setData({ [listKey]: list })
      }
    }

    // 按 idField 匹配
    let changed = false
    const updated = list.map(function (item) {
      if (item[idField] !== undefined && String(item[idField]) === String(id)) {
        if (item[field]) {
          changed = true
          return Object.assign({}, item, { [field]: '' })
        }
      }
      return item
    })
    if (changed) {
      // 如果设置了 data-update-cols，自动重分列
      this.setData({ [listKey]: updated })
      if (ds.updateCols && typeof this.splitColumns === 'function') {
        this.splitColumns(updated)
      }
    }
    return
  }

  // 单图：直接清空指定字段
  const update = {}
  update[field] = ''
  this.setData(update)
}
