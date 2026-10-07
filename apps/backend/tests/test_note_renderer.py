"""笔记渲染的公式格式化契约。

本次暴露的真实问题：一份数学课件的笔记里，「公式与定理」渲染成了

    $$
    向量空间定义中的运算：加法 $+$ 和标量乘法 $\\cdot$。
    $$

即 **`$$` 里又嵌套了行内 `$`**——KaTeX 无法解析，公式在前端完全不显示。
根因是 LLM 把 `formulas` 字段写成了一句带行内公式的中文说明，
而渲染器无条件用 `$$` 包裹。本文件锁定修复后的三种输入形态。
"""

from __future__ import annotations

from app.notes.renderer import format_formula_entry, render_note_markdown


def _joined(entry: str) -> str:
    """把一条 formulas 记录渲染成多行并去掉结尾的空行分隔符。

    `format_formula_entry` 每条都带一个尾随空行（避免多条公式黏连），
    断言时不关心这个分隔符。
    """
    return "\n".join(format_formula_entry(entry)).rstrip("\n")


# ---------- 形态 1：纯 LaTeX → 块级公式 ----------


def test_pure_latex_becomes_block_formula() -> None:
    rendered = _joined(r"W^\perp = \{ \xi \in V \mid \langle \xi, W \rangle = 0 \}")

    assert rendered.startswith("$$")
    assert rendered.endswith("$$")
    assert rendered.count("$$") == 2


def test_pure_latex_single_dollar_is_stripped_then_wrapped() -> None:
    """LLM 偶尔会自带单个 $，应剥掉后再套 $$，不能出现 $ 之外再套一层。"""
    rendered = _joined(r"$E = mc^2$")

    assert rendered == "$$\nE = mc^2\n$$"


# ---------- 形态 2：已自带 $$ → 原样保留 ----------


def test_existing_block_formula_is_not_double_wrapped() -> None:
    rendered = _joined(r"$$ a^2 + b^2 = c^2 $$")

    assert rendered == r"$$ a^2 + b^2 = c^2 $$"
    assert rendered.count("$$") == 2


# ---------- 形态 3：夹带中文的说明句 → 保留为段落，不套 $$ ----------


def test_prose_with_inline_math_is_not_wrapped_in_block_delimiters() -> None:
    """回归核心 bug：说明句不能被 $$ 包裹，否则产生非法嵌套。"""
    entry = r"向量空间定义中的运算：加法 $+$ 和标量乘法 $\cdot$。"
    rendered = _joined(entry)

    assert "$$" not in rendered, "说明性语句不应被包成块级公式"
    assert rendered == entry


def test_subspace_condition_prose_is_preserved_as_paragraph() -> None:
    entry = (
        r"子空间判定条件：对于任意 $a, b \in F$ 和任意 $\alpha, \beta \in W$，"
        r"有 $a\alpha + b\beta \in W$。"
    )
    rendered = _joined(entry)

    assert "$$" not in rendered
    assert r"\alpha, \beta \in W" in rendered


def test_prose_without_any_math_is_kept_as_paragraph() -> None:
    rendered = _joined("该定理说明子空间的判定只需验证线性组合封闭性。")

    assert "$$" not in rendered
    assert "子空间" in rendered


# ---------- 边界 ----------


def test_blank_entry_produces_nothing() -> None:
    assert format_formula_entry("   ") == []
    assert format_formula_entry("") == []
    assert format_formula_entry("$") == []
    assert format_formula_entry("$$") == []


def test_no_entry_ever_produces_nested_dollar_delimiters() -> None:
    """兜底不变量：任何输入都不应产出 `$$` 内含奇数个 `$` 的非法结构。"""
    samples = [
        r"a + b",
        r"$a + b$",
        r"$$a + b$$",
        r"说明：$x$ 与 $y$ 的关系。",
        r"向量空间定义中的运算：加法 $+$ 和标量乘法 $\cdot$。",
        r"\int_0^1 x^2\,dx = \frac{1}{3}",
    ]
    for sample in samples:
        rendered = _joined(sample)
        for line in rendered.splitlines():
            if line.strip() == "$$":
                continue
            # 单行内出现 $$ 时，其内部不得再含 $ 定界符冲突
            if "$$" in line:
                inner = line.replace("$$", "").strip()
                assert "$" not in inner, f"非法嵌套：{sample!r} -> {line!r}"


# ---------- 整篇渲染 ----------


def test_note_markdown_renders_both_prose_and_pure_formulas() -> None:
    content = render_note_markdown(
        title="向量空间的定义",
        summary="向量空间是定义了加法与标量乘法的集合。",
        key_points=["满足八条公理"],
        methods=["验证线性组合封闭性"],
        formulas=[
            r"向量空间定义中的运算：加法 $+$ 和标量乘法 $\cdot$。",
            r"a\alpha + b\beta \in W",
        ],
        source_refs=[],
    )

    assert "## 公式与定理" in content
    # 说明句保持原样
    assert r"加法 $+$ 和标量乘法 $\cdot$。" in content
    # 纯公式被块级包裹
    assert "$$\na\\alpha + b\\beta \\in W\n$$" in content
    # 不出现说明句被 $$ 包裹的非法结构
    assert "$$\\n向量空间定义中的运算" not in content
