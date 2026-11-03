#!/usr/bin/env python3
"""One-time migration of the MkDocs (Material) docs in openeverest/everest-doc
to Docusaurus MDX.

Usage:
    mkdocs_to_docusaurus.py --src <everest-doc checkout> --out <docs repo root>

Writes <out>/docs/ (pages + images) and <out>/sidebars.json (from the MkDocs
nav). Existing <out>/docs/ is replaced.

Handles the MkDocs features used by everest-doc: admonitions (!!!),
collapsible blocks (???), content tabs (===), Material icons, attr_list,
mkdocs-macros variables, md_in_html grids, raw HTML, and MDX escaping.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import unquote

import yaml

# --------------------------------------------------------------------------
# YAML loading (mkdocs configs use !ENV and !!python/name tags)
# --------------------------------------------------------------------------


class _AnyTagLoader(yaml.SafeLoader):
    pass


def _ignore_tag(loader, suffix, node):  # noqa: ARG001
    if isinstance(node, yaml.ScalarNode):
        return loader.construct_scalar(node)
    if isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node)
    return loader.construct_mapping(node)


_AnyTagLoader.add_multi_constructor("!", _ignore_tag)
_AnyTagLoader.add_multi_constructor("tag:yaml.org,2002:python/", _ignore_tag)


def load_yaml(path: Path):
    with path.open(encoding="utf-8") as f:
        return yaml.load(f, Loader=_AnyTagLoader)  # noqa: S506 - custom safe loader


def load_nav(src: Path):
    for name in ("mkdocs-base.yml", "mkdocs.yml"):
        p = src / name
        if p.exists():
            cfg = load_yaml(p) or {}
            if "nav" in cfg:
                return cfg["nav"]
    raise SystemExit("nav not found in mkdocs config")


# --------------------------------------------------------------------------
# Mappings
# --------------------------------------------------------------------------

ADMONITION_TYPES = {
    "note": "note",
    "info": "info",
    "abstract": "info",
    "summary": "info",
    "tldr": "info",
    "example": "info",
    "quote": "info",
    "cite": "info",
    "question": "info",
    "help": "info",
    "faq": "info",
    "tip": "tip",
    "hint": "tip",
    "important": "tip",
    "success": "tip",
    "check": "tip",
    "done": "tip",
    "warning": "warning",
    "caution": "warning",
    "attention": "warning",
    "danger": "danger",
    "error": "danger",
    "failure": "danger",
    "fail": "danger",
    "missing": "danger",
    "bug": "danger",
}

ICONS = {
    "material-arrow-right": "→",
    "octicons-link-external-16": "↗",
    "material-telescope": "🔭",
    "material-security": "🔒",
    "material-frequently-asked-questions": "❓",
    "material-database-import": "📥",
    "material-api": "🔌",
    "material-microsoft-windows": "",
    "fontawesome-brands-linux": "",
}

# Unicons used to show OpenEverest UI elements.
UNICONS = {
    "cog": "⚙️",
    "setting": "⚙️",
    "database": "🗄️",
    "apps": "▦",
    "ellipsis-h": "⋯",
    "toggle-off": "⏻",
}

# Raw HTML tags that are kept as JSX; any other `<word` is escaped.
ALLOWED_TAGS = {
    "a", "b", "br", "code", "details", "div", "em", "hr", "i", "img", "kbd",
    "li", "ol", "p", "pre", "span", "strong", "sub", "summary", "sup", "table",
    "tbody", "td", "th", "thead", "tr", "u", "ul", "video", "source", "iframe",
    "Tabs", "TabItem",
}
VOID_TAGS = {"br", "hr", "img", "source"}

FENCE_RE = re.compile(r"^(\s*)(`{3,}(?=[^`]*$)|~{3,})\s*(.*?)\s*$")
LIST_ITEM_RE = re.compile(r"^(\s*)(?:[-*+]|\d+[.)])\s+\S")
ADMONITION_RE = re.compile(
    r'^(\s*)(!!!|\?\?\?\+?)\s*([A-Za-z][\w-]*)((?:\s+[A-Za-z][\w-]*)*)\s*(?:"(.*)")?\s*$'
)
TAB_RE = re.compile(r'^(\s*)===\+?\s*"(.*)"\s*$')


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------


def indent_of(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def collect_indented(lines: list[str], start: int, min_indent: int) -> tuple[list[str], int]:
    """Collect lines that belong to an indented block starting at `start`."""
    body = []
    i = start
    in_fence = None
    while i < len(lines):
        line = lines[i]
        if in_fence:
            body.append(line)
            m = FENCE_RE.match(line)
            if m and m.group(2)[0] == in_fence[0] and len(m.group(2)) >= len(in_fence) and not m.group(3):
                in_fence = None
            i += 1
            continue
        if line.strip() == "":
            body.append(line)
            i += 1
            continue
        if indent_of(line) < min_indent:
            break
        m = FENCE_RE.match(line)
        if m:
            in_fence = m.group(2)
        body.append(line)
        i += 1
    # Trailing blank lines belong to the outer block.
    while body and body[-1].strip() == "":
        body.pop()
        i -= 1
    return body, i


def dedent(lines: list[str], n: int) -> list[str]:
    out = []
    for line in lines:
        if line.strip() == "":
            out.append("")
        else:
            out.append(line[min(n, indent_of(line)):])
    return out


def reindent(lines: list[str], prefix: str) -> list[str]:
    return [(prefix + line) if line.strip() else "" for line in lines]


def slugify(text: str) -> str:
    s = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE).strip().lower()
    return re.sub(r"[\s_]+", "-", s) or "tab"


def jsx_string(text: str) -> str:
    return text.replace("&", "&amp;").replace('"', "&quot;")


# --------------------------------------------------------------------------
# Inline conversion (text outside code)
# --------------------------------------------------------------------------

CODE_SPAN_RE = re.compile(r"(`+)(.+?)\1")
ATTR_LIST_RE = re.compile(
    r"""\{\s*:?\s*(?:(?:\.[\w\\.-]+|\#[\w-]+|[\w-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s}]+))\s*)+\}"""
)
BUTTON_RE = re.compile(
    r"\[((?:[^\[\]]|\[[^\]]*\])+)\]\(([^)\s]+)\)\s*\{\s*:?\s*\.md-button(\s+\.md-button--primary)?\s*\}"
)
ICON_RE = re.compile(r"\s?:((?:material|octicons|fontawesome)-[a-z0-9-]+):")
UNICON_RE = re.compile(r'<i class="uil uil-([\w-]+)"\s*>\s*</i>\s?')
AUTOLINK_RE = re.compile(r"<((?:https?|mailto):[^>\s]+)>")
TAG_RE = re.compile(r"<(/?)([A-Za-z][\w-]*)([^<>]*?)(/?)>")


def convert_html_tag(m: re.Match) -> str:
    closing, name, attrs, selfclose = m.group(1), m.group(2), m.group(3), m.group(4)
    if name not in ALLOWED_TAGS:
        return "&lt;" + m.group(0)[1:-1] + "&gt;"
    if name.lower() in VOID_TAGS and closing:
        # "</br>" is a common typo for "<br>".
        return f"<{name} />"
    attrs = re.sub(r"\bclass=", "className=", attrs)
    attrs = re.sub(r"\bfor=", "htmlFor=", attrs)

    def style_to_jsx(sm: re.Match) -> str:
        decls = [d.strip() for d in sm.group(1).split(";") if d.strip()]
        props = []
        for d in decls:
            if ":" not in d:
                continue
            k, v = d.split(":", 1)
            k = re.sub(r"-([a-z])", lambda x: x.group(1).upper(), k.strip())
            props.append(f"{k}: {json.dumps(v.strip())}")
        return "style={{" + ", ".join(props) + "}}"

    attrs = re.sub(r'style="([^"]*)"', style_to_jsx, attrs)
    if name.lower() in VOID_TAGS and not closing:
        return f"<{name}{attrs.rstrip()} />"
    return f"<{closing}{name}{attrs}{selfclose}>"


def convert_text(seg: str) -> str:
    """Convert a text segment that contains no code spans."""
    # Material buttons -> styled span around a regular markdown link, so that
    # Docusaurus still resolves relative .md links.
    def button(m: re.Match) -> str:
        cls = "oe-button oe-button--primary" if m.group(3) else "oe-button"
        return f'<span className="{cls}">[{m.group(1).strip()}]({m.group(2)})</span>'

    seg = BUTTON_RE.sub(button, seg)

    def icon(m: re.Match) -> str:
        glyph = ICONS.get(m.group(1), "")
        return f" {glyph}" if glyph else ""

    seg = ICON_RE.sub(icon, seg)

    def unicon(m: re.Match) -> str:
        glyph = UNICONS.get(m.group(1), "")
        return f"{glyph} " if glyph else ""

    seg = UNICON_RE.sub(unicon, seg)

    # attr_list: keep heading ids, drop everything else.
    def attr(m: re.Match) -> str:
        ids = re.findall(r"(?<![\w.])#([\w-]+)", m.group(0))
        return f"{{#{ids[0]}}}" if ids and "." not in m.group(0) else ""

    seg = ATTR_LIST_RE.sub(attr, seg)

    seg = AUTOLINK_RE.sub(lambda m: f"[{m.group(1)}]({m.group(1)})", seg)

    # Escape MDX expression braces, except heading ids produced above.
    seg = re.sub(r"(?<!\\)\{(?!#[\w-]+\})", r"\\{", seg)
    seg = _escape_close_braces(seg)

    # Raw HTML -> JSX; unknown "<placeholder>" text is escaped.
    seg = TAG_RE.sub(convert_html_tag, seg)
    seg = re.sub(r"<(?![A-Za-z/!])", "&lt;", seg)
    return seg


def _escape_close_braces(seg: str) -> str:
    out = []
    i = 0
    while i < len(seg):
        m = re.match(r"\{#[\w-]+\}", seg[i:])
        if m:
            out.append(m.group(0))
            i += m.end()
            continue
        ch = seg[i]
        if ch == "}" and (i == 0 or seg[i - 1] != "\\"):
            out.append("\\}")
        else:
            out.append(ch)
        i += 1
    return "".join(out)


def convert_inline(line: str) -> str:
    parts = []
    pos = 0
    for m in CODE_SPAN_RE.finditer(line):
        parts.append(convert_text(line[pos:m.start()]))
        parts.append(m.group(0))
        pos = m.end()
    parts.append(convert_text(line[pos:]))
    return "".join(parts)


# --------------------------------------------------------------------------
# Block conversion
# --------------------------------------------------------------------------


def convert_fence_info(info: str) -> str:
    info = info.strip()
    if not info:
        return ""
    attrs = ""
    m = re.match(r"^\{(.*)\}$", info)
    if m:
        inner = m.group(1)
        classes = re.findall(r"\.([\w+-]+)", inner)
        lang = next((c for c in classes if c not in ("no-copy",)), "")
        return lang
    m = re.match(r"^([\w+-]+)?\s*(.*)$", info)
    lang, rest = (m.group(1) or ""), m.group(2)
    if rest:
        title = re.search(r'title="([^"]*)"', rest)
        hl = re.search(r'hl_lines="([^"]*)"', rest)
        if hl:
            attrs += " {" + ",".join(hl.group(1).split()) + "}"
        if title:
            attrs += f' title="{title.group(1)}"'
        if "linenums" in rest:
            attrs += " showLineNumbers"
    return (lang + attrs).strip()


def colon_depth(lines: list[str]) -> int:
    depth = 0
    for line in lines:
        m = re.match(r"^\s*(:{3,})", line)
        if m:
            depth = max(depth, len(m.group(1)))
    return depth


class FileState:
    def __init__(self) -> None:
        self.needs_tabs = False


def convert_lines(lines: list[str], state: FileState) -> list[str]:
    out: list[str] = []
    # Content columns of open list items (Python-Markdown uses 4-space indents).
    list_cols: list[int] = []
    prev_blank = True
    i = 0
    while i < len(lines):
        line = lines[i]

        if line.strip():
            ind_n = indent_of(line)
            if LIST_ITEM_RE.match(line):
                while list_cols and list_cols[-1] > ind_n:
                    list_cols.pop()
                if not list_cols or list_cols[-1] <= ind_n:
                    list_cols.append(ind_n + 4)
            elif prev_blank:
                # Allow 3-space continuation ("1. " lists written CommonMark-style).
                while list_cols and ind_n < list_cols[-1] - 1:
                    list_cols.pop()
                base = list_cols[-1] if list_cols else 0
                if ind_n >= base + 4 and not FENCE_RE.match(line) and not ADMONITION_RE.match(line) \
                        and not TAB_RE.match(line):
                    # Indented code block (not supported by MDX) -> fenced block.
                    body, i = collect_indented(lines, i, base + 4)
                    pad = " " * base
                    out += [f"{pad}```", *[(pad + b) if b.strip() else "" for b in dedent(body, base + 4)], f"{pad}```"]
                    prev_blank = False
                    continue
        prev_blank = not line.strip()

        m = FENCE_RE.match(line)
        if m:
            ind, fence, info = m.groups()
            out.append(f"{ind}{fence}{convert_fence_info(info)}")
            i += 1
            while i < len(lines):
                cm = FENCE_RE.match(lines[i])
                out.append(lines[i])
                i += 1
                if cm and cm.group(2)[0] == fence[0] and len(cm.group(2)) >= len(fence) and not cm.group(3):
                    break
            continue

        m = ADMONITION_RE.match(line)
        if m:
            ind, marker, kind, _extra, title = m.groups()
            n = len(ind)
            body, i = collect_indented(lines, i + 1, n + 1)
            body_indent = min((indent_of(b) for b in body if b.strip()), default=n + 4)
            inner = convert_lines(dedent(body, body_indent), state)
            if marker.startswith("???"):
                summary = convert_inline(title) if title else kind.capitalize()
                block = [f"<details{' open' if marker.endswith('+') else ''}>",
                         f"<summary>{summary}</summary>", "", *inner, "", "</details>"]
            else:
                colons = ":" * max(3, colon_depth(inner) + 1)
                adm = ADMONITION_TYPES.get(kind.lower(), "note")
                head = f"{colons}{adm}"
                if title:
                    head += "[" + convert_inline(title).replace("[", "\\[").replace("]", "\\]") + "]"
                block = [head, "", *inner, "", colons]
            out.extend(reindent(block, ind))
            continue

        m = TAB_RE.match(line)
        if m:
            ind = m.group(1)
            n = len(ind)
            tabs = []
            while True:
                tm = TAB_RE.match(lines[i]) if i < len(lines) else None
                if not tm or len(tm.group(1)) != n:
                    break
                body, i = collect_indented(lines, i + 1, n + 1)
                body_indent = min((indent_of(b) for b in body if b.strip()), default=n + 4)
                tabs.append((tm.group(2), convert_lines(dedent(body, body_indent), state)))
                # Allow blank lines between consecutive tabs.
                j = i
                while j < len(lines) and lines[j].strip() == "":
                    j += 1
                nxt = TAB_RE.match(lines[j]) if j < len(lines) else None
                if nxt and len(nxt.group(1)) == n:
                    i = j
                else:
                    break
            state.needs_tabs = True
            block = ["<Tabs>"]
            seen: set[str] = set()
            for label, inner in tabs:
                value = slugify(label)
                while value in seen:
                    value += "-1"
                seen.add(value)
                block += [f'<TabItem value="{value}" label="{jsx_string(label)}">', "", *inner, "", "</TabItem>"]
            block.append("</Tabs>")
            out.extend(reindent(block, ind))
            continue

        stripped = line.strip()
        # attr_list on its own line, e.g. "{.power-number}".
        if ATTR_LIST_RE.fullmatch(stripped):
            i += 1
            continue

        # md_in_html grids on the landing page.
        if "markdown" in stripped and stripped.startswith("<div"):
            ind = line[: indent_of(line)]
            for tag in re.findall(r"<div[^>]*>", stripped):
                cls = "oe-grid" if "data-grid" in tag else "oe-card" if "data-banner" in tag else ""
                out += [f'{ind}<div className="{cls}">' if cls else f"{ind}<div>", ""]
            i += 1
            continue
        if re.fullmatch(r"(</div>\s*)+(<div[^>]*>\s*)*", stripped):
            ind = line[: indent_of(line)]
            for tag in re.findall(r"</?div[^>]*>", stripped):
                if tag.startswith("</"):
                    out += ["", f"{ind}</div>", ""]
                else:
                    cls = "oe-grid" if "data-grid" in tag else "oe-card" if "data-banner" in tag else ""
                    out += [f'{ind}<div className="{cls}">' if cls else f"{ind}<div>", ""]
            i += 1
            continue

        out.append(convert_inline(line))
        i += 1
    return out


def preprocess(text: str, variables: dict) -> str:
    text = text.replace("\r\n", "\n").replace("\t", "    ")

    # mkdocs-macros: escaped braces and variables.
    text = re.sub(r'\{\{\s*"\{\{"\s*\}\}', "{{", text)
    text = re.sub(r'\{\{\s*"\}\}"\s*\}\}', "}}", text)

    def var(m: re.Match):
        cur = variables
        for key in m.group(1).split("."):
            if not isinstance(cur, dict) or key not in cur:
                return m.group(0)
            cur = cur[key]
        return str(cur) if not isinstance(cur, dict) else m.group(0)

    text = re.sub(r"\{\{\s*([A-Za-z_][\w.]*)\s*\}\}", var, text)

    # Misnested <pre><code> blocks -> fenced code.
    def pre(m: re.Match) -> str:
        ind = m.group(1)
        body = m.group(2).rstrip()
        lines = body.split("\n")
        return f"{ind}```\n{ind}{lines[0]}\n" + "\n".join(lines[1:]) + f"\n{ind}```"

    text = re.sub(r"^([ ]*)<pre><code>(.*?)</(?:pre></code|code></pre)>", pre, text, flags=re.S | re.M)

    # HTML comments -> MDX comments (outside code fences).
    out_lines = []
    in_fence = None
    in_comment = False
    for line in text.split("\n"):
        fm = FENCE_RE.match(line)
        if in_fence:
            out_lines.append(line)
            if fm and fm.group(2)[0] == in_fence[0] and not fm.group(3):
                in_fence = None
            continue
        if fm and not in_comment:
            in_fence = fm.group(2)
            out_lines.append(line)
            continue
        if in_comment:
            if "-->" in line:
                in_comment = False
                line = line.replace("-->", "*/}", 1)
            out_lines.append(line.replace("{", "(").replace("}", ")") if "*/}" not in line else line)
            continue
        if "<!--" in line:
            line = line.replace("<!--", "{/*", 1)
            if "-->" in line:
                line = line.replace("-->", "*/}", 1)
            else:
                in_comment = True
        out_lines.append(line)
    return "\n".join(out_lines)


def split_front_matter(text: str) -> tuple[str, str]:
    m = re.match(r"^---\n(.*?)\n---\n", text, flags=re.S)
    if m:
        try:
            data = yaml.safe_load(m.group(1))
            if isinstance(data, dict):
                return m.group(0), text[m.end():]
        except yaml.YAMLError:
            pass
    return "", text


def convert_markdown(text: str, variables: dict) -> str:
    front, body = split_front_matter(text)
    body = preprocess(body, variables)
    state = FileState()
    lines = convert_lines(body.split("\n"), state)
    result = "\n".join(lines)
    result = re.sub(r"\n{3,}", "\n\n", result).strip("\n") + "\n"
    if state.needs_tabs:
        result = "import Tabs from '@theme/Tabs';\nimport TabItem from '@theme/TabItem';\n\n" + result
    return front + result


# --------------------------------------------------------------------------
# Sidebar
# --------------------------------------------------------------------------


def doc_id(path: str) -> str:
    return re.sub(r"\.md$", "", path)


def nav_to_sidebar(items, renames: dict[str, str]) -> list:
    out = []
    for item in items:
        if isinstance(item, str):
            out.append({"type": "doc", "id": doc_id(renames.get(item, item))})
            continue
        for label, value in item.items():
            label = str(label).strip()
            if isinstance(value, list):
                out.append({
                    "type": "category",
                    "label": label,
                    "collapsed": True,
                    "items": nav_to_sidebar(value, renames),
                })
            elif re.match(r"^https?://", str(value)):
                out.append({"type": "link", "label": label, "href": value})
            else:
                value = str(value).strip()
                out.append({"type": "doc", "id": doc_id(renames.get(value, value)), "label": label})
    return out


def nav_files(items) -> list[str]:
    files = []
    for item in items:
        if isinstance(item, str):
            files.append(item.strip())
            continue
        for value in item.values():
            if isinstance(value, list):
                files += nav_files(value)
            elif not re.match(r"^https?://", str(value)):
                files.append(str(value).strip())
    return files


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

SKIP_DIRS = {"css", "js", "fonts", "img", "overrides"}
LINK_RE = re.compile(r"\]\(\s*<?((?:[^()\s>#]|\([^()\s]*\))+\.md)(?:#[^)\s]*)?>?(?:\s+\"[^\"]*\")?\s*\)")


MD_LINK_RE = re.compile(
    r"(!?)\[((?:[^\[\]]|\[[^\]]*\])*)\]\(\s*((?:[^()\s]|\([^()\s]*\))+?)(\s+\"[^\"]*\")?\s*\)"
)


def quote_path(path: str) -> str:
    return path.replace(" ", "%20")


def safe_name(rel: str) -> str:
    """Docusaurus routes treat "(...)" as regex groups, and spaces are awkward
    in URLs, so page paths are normalized: "A (b).md" -> "A-b.md"."""
    new = rel.replace(" ", "-").replace("(", "").replace(")", "")
    return re.sub(r"-{2,}", "-", new)


def repair_links(
    text: str, src_rel: str, out_rel: str, files: set[str], renames: dict[str, str], report: list[str]
) -> str:
    """Point relative links/images at the converted files.

    Applies page renames, and fixes links to missing files: MkDocs only warns
    about these, Docusaurus fails the build. A broken link is re-targeted when
    exactly one file with the same name exists; otherwise links become plain
    text and images are dropped.
    """
    by_name: dict[str, list[str]] = {}
    for f in files:
        by_name.setdefault(os.path.basename(f).lower(), []).append(f)
    src_base = os.path.dirname(src_rel)
    out_base = os.path.dirname(out_rel) or "."

    def fix(m: re.Match) -> str:
        bang, label, target, title = m.group(1), m.group(2), m.group(3), m.group(4) or ""
        if re.match(r"^([a-z][a-z0-9+.-]*:|#|/)", target, flags=re.I):
            return m.group(0)
        path, _, anchor = target.partition("#")
        if not path:
            return m.group(0)
        anchor = f"#{anchor}" if anchor else ""
        path = unquote(path)
        if path.endswith(".html"):
            path = path[: -len(".html")] + ".md"
        resolved = os.path.normpath(os.path.join(src_base, path))
        if not os.path.splitext(path)[1] and (resolved + ".md" in renames or resolved + ".md" in files):
            resolved += ".md"
        resolved = renames.get(resolved, resolved)
        if resolved in files:
            new = quote_path(os.path.relpath(resolved, out_base))
            return m.group(0) if new == target.partition("#")[0] else f"{bang}[{label}]({new}{anchor}{title})"
        candidates = by_name.get(os.path.basename(safe_name(path)).lower(), [])
        if len(candidates) == 1:
            new = quote_path(os.path.relpath(candidates[0], out_base))
            report.append(f"{src_rel}: fixed {target} -> {new}")
            return f"{bang}[{label}]({new}{anchor}{title})"
        report.append(f"{src_rel}: removed broken {'image' if bang else 'link'} {target}")
        return "" if bang else label

    return MD_LINK_RE.sub(fix, text)


def reachable_pages(src_docs: Path, roots: list[str]) -> set[str]:
    """Pages in the nav plus every page linked from them (transitively)."""
    seen: set[str] = set()
    todo = [r for r in roots if (src_docs / r).exists()]
    while todo:
        rel = todo.pop()
        if rel in seen:
            continue
        seen.add(rel)
        text = (src_docs / rel).read_text(encoding="utf-8")
        for target in LINK_RE.findall(text):
            if re.match(r"^[a-z]+://", target):
                continue
            resolved = os.path.normpath(os.path.join(os.path.dirname(rel), target))
            if (src_docs / resolved).exists() and resolved not in seen:
                todo.append(resolved)
    return seen


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", required=True, type=Path, help="everest-doc checkout")
    ap.add_argument("--out", required=True, type=Path, help="docs repo root")
    args = ap.parse_args()

    src_docs = args.src / "docs"
    out_docs = args.out / "docs"
    variables = load_yaml(args.src / "variables.yml") if (args.src / "variables.yml").exists() else {}
    nav = load_nav(args.src)

    pages = reachable_pages(src_docs, nav_files(nav))
    # Normalize page names; when two pages collide ("A (b).md" and "A-(b).md"),
    # the one without spaces wins.
    renames: dict[str, str] = {}
    winners: dict[str, str] = {}
    for rel in sorted(pages, key=lambda r: (" " in r, r)):
        new = safe_name(rel)
        winners.setdefault(new, rel)
        if new != rel:
            renames[rel] = new

    if out_docs.exists():
        shutil.rmtree(out_docs)
    out_docs.mkdir(parents=True)

    plan: list[tuple[Path, str, str]] = []
    for path in sorted(src_docs.rglob("*")):
        rel = path.relative_to(src_docs).as_posix()
        if path.is_dir() or rel.split("/")[0] in SKIP_DIRS:
            continue
        if path.suffix == ".md":
            if rel not in pages or winners[safe_name(rel)] != rel:
                continue
            plan.append((path, rel, renames.get(rel, rel)))
        else:
            plan.append((path, rel, rel))
    out_files = {out for _, _, out in plan}

    report: list[str] = []
    for path, rel, out in plan:
        target = out_docs / out
        target.parent.mkdir(parents=True, exist_ok=True)
        if path.suffix != ".md":
            shutil.copy2(path, target)
            continue
        text = path.read_text(encoding="utf-8")
        text = repair_links(text, rel, out, out_files, renames, report)
        target.write_text(convert_markdown(text, variables), encoding="utf-8")

    for line in report:
        print(f"  {line}")

    sidebar = {"docsSidebar": nav_to_sidebar(nav, renames)}
    (args.out / "sidebars.json").write_text(json.dumps(sidebar, indent=2) + "\n", encoding="utf-8")
    print(f"converted {len(pages)} pages from {args.src} -> {out_docs}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
