import img from './preview.svg'

const content = `::: headStart
::: start
# 示例姓名
**求职意向：软件开发工程师**

icon:phone 000-0000-0000 | icon:email candidate@example.com

示例城市 | 个人主页：https://example.com
:::
![个人头像](/avatar-placeholder.svg)
::: end
::: headEnd

## 教育背景
::: start
### 示例大学 · 软件工程
:::
### 2020.09 - 2024.06
::: end
- 主修课程：数据结构、计算机网络、数据库、操作系统。
- 以下经历均为虚构示例，请替换为自己的真实信息。

## 工作经历
::: start
### 示例科技有限公司 · 开发工程师
:::
### 2024.07 - 至今
::: end
- 参与内部业务系统开发，负责接口设计、数据校验和自动化测试。
- 为关键流程增加日志与监控，协助定位问题并完善故障处理文档。

## 项目经历
### 示例知识库应用
\`TypeScript\` \`Vue\` \`Node.js\`

面向团队的文档管理示例项目，支持内容检索、版本管理和权限控制。
- 实现文档编辑与检索功能，并补充接口测试和使用说明。
- 根据使用反馈优化交互流程，减少重复操作。

## 专业技能
- 前端：熟悉 HTML、CSS、TypeScript 和 Vue。
- 后端：了解 API 设计、关系型数据库和常用测试方法。
- 工程实践：使用 Git、代码审查和持续集成维护项目。
`

export default {
  name: '通用简约示例/校招/简约',
  primaryColor: '#334155',
  primaryBackground: '#315579',
  font: 'Noto Sans SC',
  lineHeight: 20,
  img,
  content
}
