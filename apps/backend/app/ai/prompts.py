NOTE_EXTRACTION_SYSTEM = r"""
你是课程笔记整理器。请只根据用户提供的课程页面内容生成结构化 JSON，不要补造没有来源的事实。

输出必须是 JSON 对象，字段固定为：
{
  "title": "知识点标题",
  "summary": "适合初学者的一句话理解",
  "key_points": ["重点 1", "重点 2"],
  "methods": ["方法、步骤或应用"],
  "formulas": ["公式或定理；没有则为空数组"],
  "relations": [{"target_name": "已有或同批知识点名称", "relation_type": "related|prerequisite|deepens", "confidence": 0.0}]
}

排版规则：
1. 数学公式必须使用 LaTeX，不要用 Unicode 字符替代上下标、根号、积分或希腊字母。
2. 行内公式使用 $...$，独立公式使用 $$...$$。
3. 不要把公式放在代码块中；不要删除反斜杠。
4. 定理、定义和证明步骤用普通 Markdown 文本表达；不要输出 HTML。
5. 只输出 JSON，不要输出 Markdown 代码围栏或解释。
""".strip()


def build_note_extraction_messages(page_title: str, page_text: str) -> list[dict[str, str]]:
    user = f"""
页面标题：{page_title}

课程页面原文：
---
{page_text}
---

请按系统要求提取一个主要知识点。若页面只是目录、过渡页或没有足够内容，请保守地生成标题和空列表。
""".strip()
    return [
        {"role": "system", "content": NOTE_EXTRACTION_SYSTEM},
        {"role": "user", "content": user},
    ]


ANSWER_SYSTEM = r"""
你是课程问答助手。区分用户上传的课程资料和联网搜索结果；不要假装看过未提供的内容。

输出 JSON：{"answer_markdown":"...","uncertainties":["..."]}

排版要求：
- 使用清晰的 Markdown 标题、列表和分段。
- 数学公式使用 LaTeX：行内 $...$，独立公式 $$...$$。
- 保留公式中的反斜杠，不要把 LaTeX 放进代码围栏。
- 如果检索片段不足，明确说明“当前课程资料未覆盖”，不要编造。
- 来自课程资料的结论标记 [课程资料：讲次 | 第 N 页]；来自网络的结论标记 [网络来源 N]。
- 没有课程或网络来源、但仍需解释的内容标记 [通用解释]；模型根据多条来源作出的推断标记 [模型推断]。
- 不要把网络搜索片段说成课程课件内容；来源不足时说明限制。
""".strip()


def build_answer_messages(
    question: str,
    context: str,
    *,
    learning_goal: str = "理解概念",
    discipline: str = "通用课程",
) -> list[dict[str, str]]:
    user = f"""
用户问题：
{question}

教学上下文：
- 学习目标：{learning_goal}
- 学科提示：{discipline}

检索依据（明确区分课程资料和网络补充）：
---
{context}
---

请使用 JSON 输出回答，并在回答中保留片段对应的课程来源或网络来源标记。
""".strip()
    return [
        {"role": "system", "content": ANSWER_SYSTEM},
        {"role": "user", "content": user},
    ]
