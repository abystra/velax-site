import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'velax',
  description: '写代码、学架构、聊技术。',

  server: {
    host: '0.0.0.0',
  },

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
  ],

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '归档', link: '/archives' },
    ],

    sidebar: [
      {
        text: 'DevOps',
        collapsed: false,
        items: [{ text: '概述', link: '/devops/' }],
      },
      {
        text: 'Agent 开发',
        collapsed: false,
        items: [{ text: '概述', link: '/agent/' }],
      },
      {
        text: 'Java 开发',
        collapsed: false,
        items: [{ text: '概述', link: '/java/' }],
      },
      {
        text: 'Python 开发',
        collapsed: false,
        items: [{ text: '概述', link: '/python/' }],
      },
      {
        text: '前端开发',
        collapsed: false,
        items: [{ text: '概述', link: '/frontend/' }],
      },
      {
        text: '问题记录',
        collapsed: false,
        items: [{ text: '概述', link: '/troubleshooting/' }],
      },
      {
        text: '指令备忘',
        collapsed: false,
        items: [{ text: '概述', link: '/cheatsheets/' }],
      },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 velax.cn',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com' },
    ],
  },
})
