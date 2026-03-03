import os
import glob

def get_file_size_kb(path):
    try:
        size = os.path.getsize(path)
        return round(size / 1024, 2)
    except:
        return 0

print("=" * 80)
print("原始文档（需要被拆分的）")
print("=" * 80)

original_files = [
    ("research.md", r"D:\project\FICC-Brain\ficc-brain\research.md"),
    ("frontend_audit.md", r"D:\project\FICC-Brain\ficc-brain\.lane\frontend_audit.md"),
    ("spec.md", r"D:\project\FICC-Brain\ficc-brain\.lane\plans\spec.md"),
    ("data-model.md", r"D:\project\FICC-Brain\ficc-brain\.lane\plans\data-model.md"),
    ("architecture.md", r"D:\project\FICC-Brain\ficc-brain\.lane\plans\architecture.md"),
]

original_total = 0
for name, path in original_files:
    size = get_file_size_kb(path)
    original_total += size
    print(f"{name:<30} {size:>8} KB")

print("-" * 80)
print(f"{'原始文档总计':<30} {original_total:>8} KB")

print("\n" + "=" * 80)
print("拆分后的文档（plans目录，排除原始文档）")
print("=" * 80)

plans_files = glob.glob(r"D:\project\FICC-Brain\ficc-brain\.lane\plans\*.md")
plans_total = 0
for f in sorted(plans_files):
    basename = os.path.basename(f)
    # 排除原始大文档
    if basename not in ['architecture.md', 'data-model.md', 'spec.md']:
        size = get_file_size_kb(f)
        plans_total += size
        print(f"{basename:<30} {size:>8} KB")

print("-" * 80)
print(f"{'拆分文档总计':<30} {plans_total:>8} KB")

print("\n" + "=" * 80)
print("对比分析")
print("=" * 80)
print(f"原始文档总计: {original_total} KB")
print(f"拆分文档总计: {plans_total} KB")
diff = plans_total - original_total
print(f"差异: {diff:+.2f} KB ({diff/original_total*100:+.1f}%)")
print(f"拆分文档是原始文档的 {plans_total/original_total:.1%}")
