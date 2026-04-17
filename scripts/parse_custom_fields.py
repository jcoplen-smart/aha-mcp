import csv, json, sys, io
from datetime import date

raw = open(sys.argv[1]).read()
reader = csv.DictReader(io.StringIO(raw))

schema = {}
for row in reader:
    record_type = row["Record type"].strip()
    layouts = [l.strip() for l in row["Used in layouts"].split(",") if l.strip()]
    products = [p.strip() for p in row["Used in products"].split(",") if p.strip()]
    if record_type not in schema:
        schema[record_type] = []
    schema[record_type].append({
        "name": row["Name"].strip(),
        "api_key": row["API key"].strip(),
        "field_type": row["Field type"].strip(),
        "used_in_layouts": layouts,
        "used_in_products": products,
    })

output = {
    "_meta": {
        "exported_at": str(date.today()),
        "how_to_regenerate": "See aha_custom_field_schema_README.md"
    },
    "custom_fields_by_record_type": schema
}

print(json.dumps(output, indent=2))
