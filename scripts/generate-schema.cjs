#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const csvPath = path.join(projectRoot, 'config', 'custom_field_report.csv');
const outputPath = path.join(projectRoot, 'build', 'aha_custom_field_schema.json');

console.log('Generating custom field schema...');

// Check if CSV exists
if (!fs.existsSync(csvPath)) {
  console.warn(`[WARNING] Custom field report not found at ${csvPath}`);
  console.warn('[WARNING] Skipping schema generation - server will use empty schema');
  process.exit(0);
}

// Parse CSV
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const lines = csvContent.trim().split(/\r?\n/);

if (lines.length < 2) {
  console.warn('[WARNING] Custom field report appears empty');
  console.warn('[WARNING] Skipping schema generation - server will use empty schema');
  process.exit(0);
}

// Parse header
const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
const nameIdx = headers.indexOf('Name');
const apiKeyIdx = headers.indexOf('API key');
const fieldTypeIdx = headers.indexOf('Field type');
const recordTypeIdx = headers.indexOf('Record type');
const recordCountIdx = headers.indexOf('Record count');
const layoutsIdx = headers.indexOf('Used in layouts');
const productsIdx = headers.indexOf('Used in products');

if ([nameIdx, apiKeyIdx, fieldTypeIdx, recordTypeIdx, recordCountIdx].some(i => i === -1)) {
  console.error('[ERROR] CSV header missing required columns');
  console.error(`[ERROR] Expected: Name, API key, Field type, Record type, Record count`);
  console.error(`[ERROR] Found: ${headers.join(', ')}`);
  process.exit(1);
}

// Parse CSV rows (handle quoted fields with commas)
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

const schema = {};
let fieldCount = 0;

// Parse data rows
for (let i = 1; i < lines.length; i++) {
  const fields = parseCSVLine(lines[i]);

  if (fields.length < headers.length) {
    console.warn(`[WARNING] Row ${i + 1} has fewer fields than header, skipping`);
    continue;
  }

  const recordType = fields[recordTypeIdx].trim();
  const recordCount = parseInt(fields[recordCountIdx].trim(), 10);

  // Skip fields with zero record count (matching Python script behavior)
  if (recordCount === 0) {
    continue;
  }

  const layouts = fields[layoutsIdx]
    ? fields[layoutsIdx].split(',').map(l => l.trim()).filter(l => l)
    : [];
  const products = fields[productsIdx]
    ? fields[productsIdx].split(',').map(p => p.trim()).filter(p => p)
    : [];

  if (!schema[recordType]) {
    schema[recordType] = [];
  }

  schema[recordType].push({
    name: fields[nameIdx].trim(),
    api_key: fields[apiKeyIdx].trim(),
    field_type: fields[fieldTypeIdx].trim(),
    used_in_layouts: layouts,
    used_in_products: products,
  });

  fieldCount++;
}

// Build output
const today = new Date().toISOString().split('T')[0];
const output = {
  _meta: {
    exported_at: today,
    how_to_regenerate: "See README.md Development section"
  },
  custom_fields_by_record_type: schema
};

// Ensure build directory exists
const buildDir = path.join(projectRoot, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Write output
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

console.log(`✓ Generated schema with ${fieldCount} custom fields across ${Object.keys(schema).length} record types`);
console.log(`  Output: ${outputPath}`);
