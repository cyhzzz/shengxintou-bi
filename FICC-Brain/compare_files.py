def count_lines(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return len(f.readlines())
    except:
        return 0

research_lines = count_lines(r"D:\project\FICC-Brain\ficc-brain\research.md")
business_lines = count_lines(r"D:\project\FICC-Brain\ficc-brain\.lane\plans\01-业务侦察.md")

print(f"research.md 行数: {research_lines}")
print(f"01-业务侦察.md 行数: {business_lines}")
print(f"差异: {research_lines - business_lines} 行")

# 读取两个文件的内容进行比较
with open(r"D:\project\FICC-Brain\ficc-brain\research.md", 'r', encoding='utf-8') as f:
    research_content = f.read()

with open(r"D:\project\FICC-Brain\ficc-brain\.lane\plans\01-业务侦察.md", 'r', encoding='utf-8') as f:
    business_content = f.read()

print(f"\nresearch.md 字符数: {len(research_content)}")
print(f"01-业务侦察.md 字符数: {len(business_content)}")
print(f"字符差异: {len(research_content) - len(business_content)}")
