const tools = require('../../modules/tools.js')

Page({
  data: {
    keyword: '',
    toolGroups: [],
    hasTools: true
  },

  onLoad() {
    this.refreshTools()
  },

  onSearchInput(e) {
    this.setData({
      keyword: e.detail.value
    }, () => {
      this.refreshTools()
    })
  },

  clearSearch() {
    this.setData({
      keyword: ''
    }, () => {
      this.refreshTools()
    })
  },

  refreshTools() {
    const keyword = this.data.keyword.trim().toLowerCase()
    const visibleTools = tools
      .filter((tool) => tool.enabled)
      .filter((tool) => {
        if (!keyword) {
          return true
        }

        return [tool.name, tool.category, tool.key]
          .join(' ')
          .toLowerCase()
          .includes(keyword)
      })
    const toolGroups = this.groupToolsByCategory(visibleTools)

    this.setData({
      toolGroups,
      hasTools: visibleTools.length > 0
    })
  },

  groupToolsByCategory(toolList) {
    const groupMap = {}
    const groups = []

    toolList.forEach((tool) => {
      if (!groupMap[tool.category]) {
        groupMap[tool.category] = {
          category: tool.category,
          tools: []
        }
        groups.push(groupMap[tool.category])
      }

      groupMap[tool.category].tools.push(tool)
    })

    return groups
  },

  MapsToTool(e) {
    const tool = e.currentTarget.dataset.tool

    if (!tool || !tool.pagePath) {
      wx.showToast({
        title: '工具暂不可用',
        icon: 'none'
      })
      return
    }

    if (tool.requiresBackend) {
      wx.showToast({
        title: '该工具暂未开放',
        icon: 'none'
      })
      return
    }

    wx.navigateTo({
      url: tool.pagePath
    })
  }
})
