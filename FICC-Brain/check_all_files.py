import os
import glob

def get_file_size_kb(path):
    try:
        size = os.path.getsize(path)
        return round(size / 1024, 2)
    except:
        return 0

print("=" * 80)
print("ficc-brain 根目录下的原始文档")
print("=" * 80)
root_files = glob.glob(r"D:\project\FICC-Brain\ficc-brain\*.md")
root_total = 0
for f in sorted(root_files):
    size = get_file_size_kb(f)
    root_total += size
    print(f"{os.path.basename(f):<30} {size:>8} KB")

print("-" * 80)
print(f"{'根目录文档总计':<30} {root_total:>8} KB")

print("\n" + "=" * 80)
print("plans 目录下的拆分文档")
print("=" * 80)
plans_files = glob.glob(r"D:\project\FICC-Brain\ficc-brain\.lane\plans\*.md")
plans_total = 0
for f in sorted(plans_files):
    # 排除原始大文档
    if os.path.basename(f) not in ['architecture.md', 'data-model.md', 'spec.md', 'research.md', 'frontend_audit.md']:
        size = get_file_size_kb(f)
        plans_total += size
        print(f"{os.path.basename(f):<30} {size:>8} KB")

print("-" * 80)
print(f"{'拆分文档总计':<30} {plans_total:>8} KB")

print("\n" + "=" * 80)
print("对比分析")
print("=" * 80)
print(f"根目录原始文档总计: {root_total} KB")
print(f"plans拆分文档总计: {plans_total} KB")
print(f"差异: {plans_total - root_total:.2f} KB")
if root_total > 0:
    print(f"拆分文档是原始文档的 {plans_total/root_total:.1%}")
