# 开源工具复用

用户于 2026-10-08 确认：工具性能力可以借鉴 GitHub 开源项目。

优先使用项目现有依赖，通过公开接口复用；复制代码或资源时记录项目、对应版本/提交、修改范围并保留许可证要求的归属。新增库要有实际功能收益与验证。

| 已有工具 | 本项目用途 | 原项目 |
| --- | --- | --- |
| react-markdown | 章节与整本的 Markdown 阅读 | [remarkjs/react-markdown](https://github.com/remarkjs/react-markdown) |
| remark-math、rehype-katex、KaTeX | 数学公式渲染 | [remarkjs/remark-math](https://github.com/remarkjs/remark-math)、[KaTeX/KaTeX](https://github.com/KaTeX/KaTeX) |
| python-pptx | PPTX 文本、表格与对象读取 | [scanny/python-pptx](https://github.com/scanny/python-pptx) |
| python-docx | DOCX 章节、段落与表格读取 | [python-openxml/python-docx](https://github.com/python-openxml/python-docx) |
| pypdf | PDF 读取及原生文字提取 | [py-pdf/pypdf](https://github.com/py-pdf/pypdf) |

本轮继续使用上述现有依赖，没有新增运行时库。适用许可证以锁定版本随包附带的 LICENSE 为准；分发安装包时纳入第三方许可证。文档库可读取格式，不等于复杂公式、扫描页或 OCR 的质量已经验收。

Playwright CLI 仅用于本轮浏览器检查，未添加为产品运行依赖。
