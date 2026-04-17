# Aha! Custom Field Schema Reference

## What this is

`aha_custom_field_schema.json` is a machine-readable reference of all custom fields defined in the
SMART Technologies Aha! account, grouped by record type (Competitor, Feature, Epic, etc.).

It is used by aha-mcp at runtime so Claude knows which custom field `api_key` values exist for each
record type, what their field types are, and which workspaces use them — without needing to
enumerate this via the Aha! API (which has no endpoint for listing custom field definitions).

## Where to put it in the repo

Place both files in a `config/` directory at the root of the aha-mcp repo:

```
aha-mcp/
  config/
    aha_custom_field_schema.json
    aha_custom_field_schema_README.md   ← this file
  scripts/
    parse_custom_fields.py              ← regeneration script (see below)
  src/
    ...
```

## How to reference it from Claude Desktop config

In your `claude_desktop_config.json`, point the server at the repo root so it can resolve
`config/aha_custom_field_schema.json` relative to `__dirname` or `process.cwd()`. No changes
to the MCP config format are needed — the server reads this file at startup.

In `src/index.ts` (or a new `src/schema.ts`), load it once at startup:

```typescript
import schema from '../config/aha_custom_field_schema.json';
// schema.custom_fields_by_record_type.Competitor -> array of field definitions
```

Claude Code can then include the relevant record type's fields in tool descriptions or use it
for validation/documentation without making additional API calls.

## How to keep it current

Aha! custom fields change infrequently, but when your team adds or renames a custom field the
schema file needs to be regenerated.

**Steps to regenerate:**

1. In Aha!, go to **Settings → Account → Custom fields**
2. Click **Export** (top right) — this downloads a CSV
3. Run the parse script:
   ```bash
   python3 scripts/parse_custom_fields.py path/to/downloaded.csv > config/aha_custom_field_schema.json
   ```
4. Commit the updated file

**Parse script** (`scripts/parse_custom_fields.py`):

```python
import csv, json, sys, io
from datetime import date

raw = open(sys.argv[1]).read()
reader = csv.DictReader(io.StringIO(raw))

schema = {}
for row in reader:
    record_type = row["Record type"].strip()
    if record_type not in schema:
        schema[record_type] = []
    schema[record_type].append({
        "name": row["Name"].strip(),
        "api_key": row["API key"].strip(),
        "field_type": row["Field type"].strip(),
        "used_in_layouts": [l.strip() for l in row["Used in layouts"].split(",") if l.strip()],
        "used_in_products": [p.strip() for p in row["Used in products"].split(",") if p.strip()],
    })

output = {
    "_meta": {
        "exported_at": str(date.today()),
        "how_to_regenerate": "See aha_custom_field_schema_README.md"
    },
    "custom_fields_by_record_type": schema
}

print(json.dumps(output, indent=2))
```

## Field type reference

| Aha! field_type | Write value format |
|---|---|
| Note | HTML string, e.g. `<p>Content.</p>` |
| Text field | Plain string |
| URL/Email field | URL string |
| Number field | Integer or float |
| Predefined choice list | String — must match a configured option exactly (case-sensitive) |
| Editable choice list | String — free entry allowed |
| Predefined tags field | Array of strings — each must match a configured option |
| Tags field | Array of strings — free entry allowed |
| Date field | `YYYY-MM-DD` string |
| Users field | Aha! user reference (see Aha! API docs) |
| Scorecard field | Not writable via custom_fields |
| Personas field | Not writable via custom_fields |
| Attachment | Not writable via custom_fields |

## Known quirks

- **`announcementsblog`** (Competitor, Announcements/Blog) has no underscore between "announcements"
  and "blog". This matches the Aha! API response exactly and is not a typo.
- **`description`** exists as a custom field on Competitor, Persona, and Idea record types — it
  is not a standard top-level field on those record types.
- **`pm_owner`** is the api_key for "PM Lead" on Features; **`pm_lead`** is the api_key for
  "PM Lead" on Epics. These are different fields despite having the same display name.
- Some fields appear to be drafts or duplicates (e.g. multiple "Portfolio" fields on Idea with
  keys `portfolio`, `portf`, `portfo`, `ptfl`). Only `ptfl` is in an active layout. Ignore the
  others unless you have a specific reason to use them.
