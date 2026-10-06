from app.ai.discipline import infer_context
from app.ai.prompts import build_answer_messages


def test_teaching_context_is_explainable_and_request_goal_wins():
    context = infer_context("请比较两个算法的时间复杂度", "准备复习")
    assert context.learning_goal == "准备复习"
    assert context.discipline == "计算机科学"
    assert "算法" in context.matched_terms


def test_answer_prompt_includes_learning_goal_and_discipline():
    messages = build_answer_messages(
        "导数是什么？",
        "[第一讲] 课程片段",
        learning_goal="解决练习",
        discipline="数学",
    )
    assert "学习目标：解决练习" in messages[-1]["content"]
    assert "学科提示：数学" in messages[-1]["content"]
