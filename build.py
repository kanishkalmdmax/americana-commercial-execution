"""Inline FieldDrive/src into FieldDrive/index.html (the single deliverable)."""
from pathlib import Path
import re

SRC = Path(__file__).parent / "src"
OUT = Path(__file__).parent / "index.html"


def main():
    tpl = (SRC / "template.html").read_text(encoding="utf-8")
    css = (SRC / "styles.css").read_text(encoding="utf-8")
    js = "\n;\n".join(p.read_text(encoding="utf-8") for p in sorted(SRC.glob("*.js")))
    fonts = (SRC / "fonts.css").read_text(encoding="utf-8")
    html = tpl.replace("{{FONTS}}", fonts).replace("{{CSS}}", css).replace("{{JS}}", js.replace("</script", "<\\/script"))
    emoji = re.findall(r"[\U0001F300-\U0001FAFF☀-➿]", html)
    if emoji:
        raise SystemExit(f"emoji found: {sorted(set(emoji))}")
    OUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUT} ({len(html) // 1024} KB)")


if __name__ == "__main__":
    main()
