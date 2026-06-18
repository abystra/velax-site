import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'velax',
  description: '写代码、学架构、聊技术。',

  base: '/velax-site/',

  cleanUrls: true,
  lastUpdated: true,

  server: {
    host: '0.0.0.0',
  },

  head: [
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'velax' }],
    ['meta', { property: 'og:description', content: '写代码、学架构、聊技术。' }],
    ['link', { rel: 'icon', href: '/favicon.ico' }],
  ],

  themeConfig: {
    search: {
      provider: 'local',
    },

    nav: [
      { text: '首页', link: '/' },
      { text: '归档', link: '/archives' },
      {
        text: '后端开发',
        items: [
          { text: 'Java 开发', link: '/java/' },
          { text: 'Python 开发', link: '/python/' },
        ],
      },
      { text: '前端开发', link: '/frontend/' },
      { text: 'DevOps', link: '/devops/' },
      { text: 'Agent 开发', link: '/agent/' },
      {
        text: '随手记',
        items: [
          { text: '问题记录', link: '/troubleshooting/' },
          { text: '指令备忘', link: '/cheatsheets/' },
        ],
      },
    ],

    sidebar: false,

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 velax.cn',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com' },
    ],
  },
})
