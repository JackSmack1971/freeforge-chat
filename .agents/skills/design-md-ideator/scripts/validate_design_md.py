#!/usr/bin/env python3
"""Validate DESIGN.md against the attached base spec or the skill's strict profile.

No third-party dependencies. The YAML parser intentionally accepts only the
mapping/scalar subset emitted by this skill and rejects executable YAML features.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable

EXIT_OK = 0
EXIT_VALIDATION = 1
EXIT_USAGE_OR_IO = 2
EXIT_INTERNAL = 3

DIMENSION_RE = re.compile(r"^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem)$", re.IGNORECASE)
HEX_COLOR_RE = re.compile(r"^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")
TOKEN_REF_RE = re.compile(r"^\{([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*)\}$")
KEY_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")
FUNCTION_COLOR_RE = re.compile(
    r"^(?:rgb|rgba|hsl|hsla|hwb|oklch|oklab|lch|lab|color-mix)\(.+\)$",
    re.IGNORECASE,
)

CSS_NAMED_COLORS = frozenset(
    """
aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue
cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey
darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon
darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet
deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen
fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew
hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon
lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey
lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey
lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine
mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen
mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite
navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen
paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple
rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell
sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan
teal thistle tomato transparent turquoise violet wheat white whitesmoke yellow
yellowgreen currentcolor
""".split()
)

CANONICAL_SECTIONS = (
    "Overview",
    "Colors",
    "Typography",
    "Layout",
    "Elevation & Depth",
    "Shapes",
    "Components",
    "Do's and Don'ts",
)
SECTION_ALIASES = {
    "overview": "Overview",
    "brand & style": "Overview",
    "colors": "Colors",
    "typography": "Typography",
    "layout": "Layout",
    "layout & spacing": "Layout",
    "elevation & depth": "Elevation & Depth",
    "elevation": "Elevation & Depth",
    "shapes": "Shapes",
    "components": "Components",
    "do's and don'ts": "Do's and Don'ts",
    "do’s and don’ts": "Do's and Don'ts",
}

TOP_LEVEL_KEYS = {"version", "name", "description", "colors", "typography", "rounded", "spacing", "components"}
REQUIRED_STRICT_KEYS = {"name", "colors", "typography", "rounded", "spacing", "components"}
TYPOGRAPHY_REQUIRED = {"fontFamily", "fontSize", "fontWeight", "lineHeight"}
TYPOGRAPHY_ALLOWED = TYPOGRAPHY_REQUIRED | {"letterSpacing", "fontFeature", "fontVariation"}
COMPONENT_PROPERTIES = {
    "backgroundColor",
    "textColor",
    "typography",
    "rounded",
    "padding",
    "size",
    "height",
    "width",
}


@dataclass(frozen=True)
class Issue:
    severity: str
    code: str
    message: str
    line: int | None = None
    path: str | None = None


class Collector:
    def __init__(self) -> None:
        self.issues: list[Issue] = []

    def error(self, code: str, message: str, *, line: int | None = None, path: str | None = None) -> None:
        self.issues.append(Issue("error", code, message, line, path))

    def warn(self, code: str, message: str, *, line: int | None = None, path: str | None = None) -> None:
        self.issues.append(Issue("warning", code, message, line, path))

    @property
    def errors(self) -> list[Issue]:
        return [issue for issue in self.issues if issue.severity == "error"]

    @property
    def warnings(self) -> list[Issue]:
        return [issue for issue in self.issues if issue.severity == "warning"]


def strip_yaml_comment(text: str) -> str:
    quote: str | None = None
    escaped = False
    for index, char in enumerate(text):
        if escaped:
            escaped = False
            continue
        if char == "\\" and quote == '"':
            escaped = True
            continue
        if char in {"'", '"'}:
            if quote is None:
                quote = char
            elif quote == char:
                quote = None
            continue
        if char == "#" and quote is None and (index == 0 or text[index - 1].isspace()):
            return text[:index].rstrip()
    return text.rstrip()


def split_mapping_line(text: str) -> tuple[str, str] | None:
    quote: str | None = None
    escaped = False
    for index, char in enumerate(text):
        if escaped:
            escaped = False
            continue
        if char == "\\" and quote == '"':
            escaped = True
            continue
        if char in {"'", '"'}:
            if quote is None:
                quote = char
            elif quote == char:
                quote = None
            continue
        if char == ":" and quote is None:
            return text[:index].strip(), text[index + 1 :].strip()
    return None


def parse_scalar(text: str, collector: Collector, line: int) -> Any:
    if text.startswith('"'):
        try:
            value = json.loads(text)
        except json.JSONDecodeError as exc:
            collector.error("yaml.invalid-double-quoted-string", f"Invalid quoted string: {exc.msg}", line=line)
            return text
        if not isinstance(value, str):
            collector.error("yaml.invalid-scalar", "Double-quoted YAML values must decode to strings.", line=line)
        return value
    if text.startswith("'"):
        if len(text) < 2 or not text.endswith("'"):
            collector.error("yaml.invalid-single-quoted-string", "Unterminated single-quoted string.", line=line)
            return text
        return text[1:-1].replace("''", "'")
    if text in {"{}", "{ }"}:
        return {}
    if text in {"[]", "[ ]"}:
        collector.error("yaml.sequences-not-supported", "Sequences are outside the supported DESIGN.md token subset.", line=line)
        return []
    if re.fullmatch(r"[-+]?\d+", text):
        try:
            return int(text)
        except ValueError:
            pass
    if re.fullmatch(r"[-+]?(?:\d+\.\d*|\d*\.\d+)", text):
        try:
            return float(text)
        except ValueError:
            pass
    if text.lower() in {"null", "~"}:
        collector.error("yaml.null-not-supported", "Null values are not valid design-token values.", line=line)
        return None
    return text


def parse_restricted_yaml(lines: list[str], start_line: int, collector: Collector) -> dict[str, Any]:
    root: dict[str, Any] = {}
    stack: list[tuple[int, dict[str, Any]]] = [(-2, root)]

    for offset, raw_line in enumerate(lines):
        line_number = start_line + offset
        if not raw_line.strip() or raw_line.lstrip().startswith("#"):
            continue
        if "\t" in raw_line:
            collector.error("yaml.tabs", "Tabs are not allowed; use two-space indentation.", line=line_number)
            continue

        indent = len(raw_line) - len(raw_line.lstrip(" "))
        if indent % 2 != 0:
            collector.error("yaml.indentation", "Indentation must use multiples of two spaces.", line=line_number)
        content = strip_yaml_comment(raw_line.strip())
        if not content:
            continue
        if content.startswith("-"):
            collector.error("yaml.sequences-not-supported", "YAML sequences are outside the supported token subset.", line=line_number)
            continue
        if content.startswith(("%", "---", "...")):
            collector.error("yaml.directive-or-document", "Nested YAML documents/directives are not allowed.", line=line_number)
            continue

        while len(stack) > 1 and indent <= stack[-1][0]:
            stack.pop()
        expected_indent = stack[-1][0] + 2
        if indent != expected_indent:
            collector.error(
                "yaml.indentation-jump",
                f"Expected indentation of {expected_indent} spaces, found {indent}.",
                line=line_number,
            )
            while len(stack) > 1 and indent < stack[-1][0] + 2:
                stack.pop()

        parsed = split_mapping_line(content)
        if parsed is None:
            collector.error("yaml.mapping", "Expected a 'key: value' mapping entry.", line=line_number)
            continue
        key, value_text = parsed
        if not key or not KEY_RE.fullmatch(key):
            collector.error("yaml.key", f"Invalid or unsupported key: {key!r}.", line=line_number)
            continue

        parent = stack[-1][1]
        if key in parent:
            collector.error("yaml.duplicate-key", f"Duplicate YAML key {key!r}.", line=line_number, path=key)
            continue

        if value_text == "":
            child: dict[str, Any] = {}
            parent[key] = child
            stack.append((indent, child))
        else:
            if value_text.startswith(("&", "*", "!", "|", ">")):
                collector.error(
                    "yaml.unsafe-feature",
                    "YAML anchors, aliases, tags, and block scalars are not allowed.",
                    line=line_number,
                )
            parent[key] = parse_scalar(value_text, collector, line_number)

    return root


def is_dimension(value: Any) -> bool:
    return isinstance(value, str) and bool(DIMENSION_RE.fullmatch(value.strip()))


def dimension_number(value: str) -> float:
    match = re.match(r"^-?(?:\d+(?:\.\d+)?|\.\d+)", value)
    return float(match.group(0)) if match else 0.0


def is_css_color(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    text = value.strip()
    if HEX_COLOR_RE.fullmatch(text):
        return True
    if text.casefold() in CSS_NAMED_COLORS:
        return True
    if FUNCTION_COLOR_RE.fullmatch(text):
        # Basic safety/sanity check; full CSS parsing is intentionally out of scope.
        return text.count("(") == text.count(")")
    return False


def get_path(root: dict[str, Any], path: str) -> tuple[bool, Any]:
    current: Any = root
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return False, None
        current = current[part]
    return True, current


def resolve_value(root: dict[str, Any], value: Any, visited: set[str] | None = None) -> tuple[bool, Any, str | None]:
    if not isinstance(value, str):
        return True, value, None
    match = TOKEN_REF_RE.fullmatch(value.strip())
    if not match:
        return True, value, None
    path = match.group(1)
    visited = set() if visited is None else set(visited)
    if path in visited:
        return False, None, f"Reference cycle detected at {path!r}."
    visited.add(path)
    exists, target = get_path(root, path)
    if not exists:
        return False, None, f"Reference target {path!r} does not exist."
    if isinstance(target, str) and TOKEN_REF_RE.fullmatch(target.strip()):
        return resolve_value(root, target, visited)
    return True, target, None


def validate_frontmatter(data: dict[str, Any], profile: str, collector: Collector) -> None:
    for key in data:
        if key not in TOP_LEVEL_KEYS:
            collector.warn("schema.unknown-top-level", f"Unknown top-level token group {key!r} is preserved.", path=key)

    if profile == "strict":
        for key in sorted(REQUIRED_STRICT_KEYS - data.keys()):
            collector.error("schema.missing-key", f"Strict profile requires top-level key {key!r}.", path=key)
    elif "name" not in data:
        collector.error("schema.missing-name", "Frontmatter must include a design-system name.", path="name")

    for key in ("version", "name", "description"):
        if key in data and (not isinstance(data[key], str) or not data[key].strip()):
            collector.error("schema.metadata-type", f"{key!r} must be a non-empty string.", path=key)

    colors = data.get("colors")
    if colors is not None:
        if not isinstance(colors, dict) or not colors:
            collector.error("schema.colors-map", "'colors' must be a non-empty map.", path="colors")
        else:
            if "primary" not in colors:
                collector.error("schema.primary-color", "At least colors.primary must be defined.", path="colors.primary")
            for name, value in colors.items():
                path = f"colors.{name}"
                if isinstance(value, str) and TOKEN_REF_RE.fullmatch(value.strip()):
                    ok, resolved, reason = resolve_value(data, value)
                    if not ok:
                        collector.error("reference.invalid", reason or "Invalid token reference.", path=path)
                    elif not is_css_color(resolved):
                        collector.error("schema.color", f"Resolved value is not a supported CSS color: {resolved!r}.", path=path)
                elif not is_css_color(value):
                    collector.error("schema.color", f"Invalid CSS color value {value!r}.", path=path)

    typography = data.get("typography")
    if typography is not None:
        if not isinstance(typography, dict) or not typography:
            collector.error("schema.typography-map", "'typography' must be a non-empty map.", path="typography")
        else:
            for name, token in typography.items():
                path = f"typography.{name}"
                if not isinstance(token, dict) or not token:
                    collector.error("schema.typography-token", "Typography tokens must be non-empty maps.", path=path)
                    continue
                for missing in sorted(TYPOGRAPHY_REQUIRED - token.keys()):
                    collector.error("schema.typography-required", f"Missing required property {missing!r}.", path=f"{path}.{missing}")
                for prop in token:
                    if prop not in TYPOGRAPHY_ALLOWED:
                        collector.warn("schema.typography-unknown", f"Unknown typography property {prop!r} is preserved.", path=f"{path}.{prop}")
                if "fontFamily" in token and (not isinstance(token["fontFamily"], str) or not token["fontFamily"].strip()):
                    collector.error("schema.font-family", "fontFamily must be a non-empty string.", path=f"{path}.fontFamily")
                if "fontSize" in token and not is_dimension(token["fontSize"]):
                    collector.error("schema.font-size", "fontSize must be a px, em, or rem dimension.", path=f"{path}.fontSize")
                if "fontWeight" in token:
                    weight = token["fontWeight"]
                    if isinstance(weight, str) and re.fullmatch(r"\d+", weight):
                        weight = int(weight)
                    if not isinstance(weight, (int, float)) or isinstance(weight, bool) or not (1 <= float(weight) <= 1000):
                        collector.error("schema.font-weight", "fontWeight must be numeric from 1 through 1000.", path=f"{path}.fontWeight")
                if "lineHeight" in token:
                    line_height = token["lineHeight"]
                    valid = (
                        isinstance(line_height, (int, float))
                        and not isinstance(line_height, bool)
                        and float(line_height) > 0
                    ) or is_dimension(line_height)
                    if not valid:
                        collector.error("schema.line-height", "lineHeight must be a positive number or dimension.", path=f"{path}.lineHeight")
                if "letterSpacing" in token and not is_dimension(token["letterSpacing"]):
                    collector.error("schema.letter-spacing", "letterSpacing must be a px, em, or rem dimension.", path=f"{path}.letterSpacing")
                if profile == "strict" and "letterSpacing" not in token:
                    collector.warn("profile.letter-spacing", "Generated typography should include letterSpacing for completeness.", path=f"{path}.letterSpacing")
                for prop in ("fontFeature", "fontVariation"):
                    if prop in token and not isinstance(token[prop], str):
                        collector.error("schema.typography-string", f"{prop} must be a string.", path=f"{path}.{prop}")

    rounded = data.get("rounded")
    if rounded is not None:
        if not isinstance(rounded, dict) or not rounded:
            collector.error("schema.rounded-map", "'rounded' must be a non-empty map.", path="rounded")
        else:
            for name, value in rounded.items():
                path = f"rounded.{name}"
                ok, resolved, reason = resolve_value(data, value)
                if not ok:
                    collector.error("reference.invalid", reason or "Invalid token reference.", path=path)
                elif not is_dimension(resolved):
                    collector.error("schema.rounded-dimension", "Rounded values must be px, em, or rem dimensions.", path=path)
                elif dimension_number(resolved) < 0:
                    collector.error("schema.rounded-negative", "Rounded values cannot be negative.", path=path)

    spacing = data.get("spacing")
    if spacing is not None:
        if not isinstance(spacing, dict) or not spacing:
            collector.error("schema.spacing-map", "'spacing' must be a non-empty map.", path="spacing")
        else:
            for name, value in spacing.items():
                path = f"spacing.{name}"
                ok, resolved, reason = resolve_value(data, value)
                if not ok:
                    collector.error("reference.invalid", reason or "Invalid token reference.", path=path)
                elif is_dimension(resolved) or (isinstance(resolved, (int, float)) and not isinstance(resolved, bool)):
                    continue
                elif profile == "strict":
                    collector.error("profile.spacing-value", "Strict spacing values must be dimensions or numbers.", path=path)
                else:
                    collector.warn("schema.spacing-unknown", "Unknown spacing value is preserved as a string by base-spec consumers.", path=path)

    components = data.get("components")
    if components is not None:
        if not isinstance(components, dict) or not components:
            collector.error("schema.components-map", "'components' must be a non-empty map.", path="components")
        else:
            for component_name, token_map in components.items():
                component_path = f"components.{component_name}"
                if not isinstance(token_map, dict) or not token_map:
                    collector.error("schema.component-token", "Component entries must be non-empty maps.", path=component_path)
                    continue
                for prop, value in token_map.items():
                    path = f"{component_path}.{prop}"
                    if prop not in COMPONENT_PROPERTIES:
                        collector.warn("schema.component-unknown", f"Unknown component property {prop!r} is preserved.", path=path)
                    if isinstance(value, (dict, list)) or value is None or isinstance(value, bool):
                        collector.error("schema.component-value", "Component property values must be scalar strings or token references.", path=path)
                        continue
                    ok, resolved, reason = resolve_value(data, value)
                    if not ok:
                        collector.error("reference.invalid", reason or "Invalid token reference.", path=path)
                        continue
                    if isinstance(resolved, dict) and prop != "typography":
                        collector.error("reference.composite", "Only component typography may reference a composite token.", path=path)
                        continue
                    if prop in {"backgroundColor", "textColor"} and not is_css_color(resolved):
                        collector.error("schema.component-color", "Color properties must resolve to a valid CSS color.", path=path)
                    elif prop in {"rounded", "padding", "size", "height", "width"} and not is_dimension(resolved):
                        collector.error("schema.component-dimension", f"{prop} must resolve to a px, em, or rem dimension.", path=path)
                    elif prop == "typography" and not isinstance(resolved, (dict, str)):
                        collector.error("schema.component-typography", "typography must reference a typography token or be a string.", path=path)

    # Validate all token references, including unknown extension fields.
    def walk(node: Any, path: str) -> Iterable[tuple[str, str]]:
        if isinstance(node, dict):
            for key, value in node.items():
                child_path = f"{path}.{key}" if path else key
                yield from walk(value, child_path)
        elif isinstance(node, str) and TOKEN_REF_RE.fullmatch(node.strip()):
            yield path, node

    for path, value in walk(data, ""):
        ok, _resolved, reason = resolve_value(data, value)
        if not ok and not any(issue.path == path and issue.code == "reference.invalid" for issue in collector.issues):
            collector.error("reference.invalid", reason or "Invalid token reference.", path=path)


def parse_markdown_headings(lines: list[str]) -> list[tuple[int, int, str]]:
    headings: list[tuple[int, int, str]] = []
    fence: str | None = None
    for line_number, raw in enumerate(lines, start=1):
        stripped = raw.lstrip()
        fence_match = re.match(r"^(`{3,}|~{3,})", stripped)
        if fence_match:
            marker = fence_match.group(1)[0]
            if fence is None:
                fence = marker
            elif fence == marker:
                fence = None
            continue
        if fence is not None:
            continue
        match = re.match(r"^(#{1,6})\s+(.+?)\s*$", raw)
        if not match:
            continue
        title = re.sub(r"\s+#+\s*$", "", match.group(2)).strip()
        headings.append((line_number, len(match.group(1)), title))
    return headings


def validate_markdown(body_lines: list[str], body_start_line: int, profile: str, collector: Collector) -> None:
    local_headings = parse_markdown_headings(body_lines)
    headings = [(line + body_start_line - 1, level, title) for line, level, title in local_headings]

    seen_h2: dict[str, int] = {}
    normalized_seen: dict[str, tuple[str, int]] = {}
    recognized: list[tuple[int, str, str]] = []

    for line, level, title in headings:
        normalized = SECTION_ALIASES.get(title.casefold())
        if normalized and level != 2:
            collector.error("markdown.heading-level", f"Section {title!r} must use an H2 heading ('##').", line=line)
        if level != 2:
            continue
        folded = title.casefold()
        if folded in seen_h2:
            collector.error("markdown.duplicate-heading", f"Duplicate H2 heading {title!r}.", line=line)
        else:
            seen_h2[folded] = line
        if normalized:
            if normalized in normalized_seen:
                prior_title, _prior_line = normalized_seen[normalized]
                collector.error(
                    "markdown.duplicate-section",
                    f"Sections {prior_title!r} and {title!r} map to the same canonical section {normalized!r}.",
                    line=line,
                )
            else:
                normalized_seen[normalized] = (title, line)
            recognized.append((line, normalized, title))
        else:
            collector.warn("markdown.unknown-section", f"Unknown H2 section {title!r} is preserved by base-spec consumers.", line=line)

    order = {name: index for index, name in enumerate(CANONICAL_SECTIONS)}
    positions = [order[canonical] for _line, canonical, _title in recognized]
    if positions != sorted(positions):
        collector.error("markdown.section-order", "Recognized sections are not in the required sequence.")

    if profile == "strict":
        for canonical in CANONICAL_SECTIONS:
            if canonical not in normalized_seen:
                collector.error("profile.missing-section", f"Strict profile requires section '## {canonical}'.")
        for line, canonical, actual in recognized:
            if actual != canonical:
                collector.error(
                    "profile.canonical-heading",
                    f"Strict profile requires exact heading '## {canonical}', not '## {actual}'.",
                    line=line,
                )

        # Every canonical section must contain non-whitespace content before the next H2.
        h2_positions = [(index, line, title) for index, (line, level, title) in enumerate(headings) if level == 2]
        body_text_lines = body_lines
        for i, (_idx, absolute_line, title) in enumerate(h2_positions):
            canonical = SECTION_ALIASES.get(title.casefold())
            if not canonical:
                continue
            local_heading_line = absolute_line - body_start_line + 1
            next_absolute = h2_positions[i + 1][1] if i + 1 < len(h2_positions) else body_start_line + len(body_lines)
            next_local_line = next_absolute - body_start_line + 1
            content = "\n".join(body_text_lines[local_heading_line: next_local_line - 1]).strip()
            if not content:
                collector.error("profile.empty-section", f"Section {canonical!r} must contain guidance.", line=absolute_line)


def extract_document(text: str, profile: str, collector: Collector) -> tuple[dict[str, Any] | None, list[str], int]:
    lines = text.splitlines()
    if not lines:
        collector.error("document.empty", "The document is empty.")
        return None, [], 1

    if lines[0] == "---":
        closing_index = None
        for index in range(1, len(lines)):
            if lines[index] == "---":
                closing_index = index
                break
        if closing_index is None:
            collector.error("frontmatter.unclosed", "Frontmatter begins with '---' but has no exact closing delimiter.", line=1)
            return None, [], 1
        yaml_lines = lines[1:closing_index]
        data = parse_restricted_yaml(yaml_lines, 2, collector)
        body_lines = lines[closing_index + 1 :]
        return data, body_lines, closing_index + 2

    if lines[0].strip() == "---":
        collector.error("frontmatter.delimiter-whitespace", "The opening frontmatter delimiter must be exactly '---'.", line=1)
    if profile == "strict":
        collector.error("profile.frontmatter-required", "Strict profile requires YAML frontmatter beginning on line 1.", line=1)
    return None, lines, 1


def validate_document(path: Path, profile: str) -> Collector:
    collector = Collector()
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        collector.error("io.encoding", "File must be valid UTF-8.")
        return collector

    data, body_lines, body_start_line = extract_document(text, profile, collector)
    if data is not None:
        validate_frontmatter(data, profile, collector)
    validate_markdown(body_lines, body_start_line, profile, collector)
    return collector


def format_text(path: Path, profile: str, collector: Collector, warnings_as_errors: bool) -> str:
    effective_fail = bool(collector.errors or (warnings_as_errors and collector.warnings))
    status = "FAIL" if effective_fail else "PASS"
    lines = [
        f"DESIGN.md validation: {status}",
        f"File: {path}",
        f"Profile: {profile}",
        f"Errors: {len(collector.errors)} | Warnings: {len(collector.warnings)}",
    ]
    for issue in collector.issues:
        location_parts = []
        if issue.line is not None:
            location_parts.append(f"line {issue.line}")
        if issue.path:
            location_parts.append(issue.path)
        location = f" ({', '.join(location_parts)})" if location_parts else ""
        lines.append(f"[{issue.severity.upper()}] {issue.code}{location}: {issue.message}")
    return "\n".join(lines)


def format_json(path: Path, profile: str, collector: Collector, warnings_as_errors: bool) -> str:
    effective_fail = bool(collector.errors or (warnings_as_errors and collector.warnings))
    payload = {
        "status": "fail" if effective_fail else "pass",
        "file": str(path),
        "profile": profile,
        "warnings_as_errors": warnings_as_errors,
        "summary": {
            "errors": len(collector.errors),
            "warnings": len(collector.warnings),
        },
        "errors": [asdict(issue) for issue in collector.errors],
        "warnings": [asdict(issue) for issue in collector.warnings],
    }
    return json.dumps(payload, indent=2, sort_keys=True)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate DESIGN.md structure and design tokens.")
    parser.add_argument("file", type=Path, help="Path to DESIGN.md")
    parser.add_argument(
        "--profile",
        choices=("strict", "spec"),
        default="strict",
        help="strict requires the skill's complete output profile; spec permits optional frontmatter/sections",
    )
    parser.add_argument("--format", choices=("text", "json"), default="text", help="Output format")
    parser.add_argument("--warnings-as-errors", action="store_true", help="Return failure when warnings exist")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not args.file.exists():
        print(f"ERROR: file does not exist: {args.file}", file=sys.stderr)
        return EXIT_USAGE_OR_IO
    if not args.file.is_file():
        print(f"ERROR: path is not a file: {args.file}", file=sys.stderr)
        return EXIT_USAGE_OR_IO

    try:
        collector = validate_document(args.file, args.profile)
        output = (
            format_json(args.file, args.profile, collector, args.warnings_as_errors)
            if args.format == "json"
            else format_text(args.file, args.profile, collector, args.warnings_as_errors)
        )
        print(output)
        failed = bool(collector.errors or (args.warnings_as_errors and collector.warnings))
        return EXIT_VALIDATION if failed else EXIT_OK
    except Exception as exc:  # Defensive boundary; validation failures should not crash.
        if args.format == "json":
            print(json.dumps({"status": "error", "code": "internal", "message": str(exc)}, indent=2))
        else:
            print(f"INTERNAL ERROR: {exc}", file=sys.stderr)
        return EXIT_INTERNAL


if __name__ == "__main__":
    raise SystemExit(main())
