#!/usr/bin/env node
/**
 * Build-time script to fetch custom field schema from Aha! API
 * and cache it in build/aha_custom_field_schema.json
 */

const fs = require('fs').promises;
const path = require('path');

async function restRequest(domain, token, apiPath) {
  const response = await fetch(`https://${domain}.aha.io${apiPath}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Aha! REST API request failed (${response.status}): ${errorBody}`
    );
  }

  return await response.json();
}

function normalizeCustomFieldType(apiType) {
  const knownMappings = {
    'CustomFieldDefinitions::TextField': 'text',
    'CustomFieldDefinitions::NoteField': 'note',
    'CustomFieldDefinitions::NumberField': 'number',
    'CustomFieldDefinitions::UrlField': 'url',
    'CustomFieldDefinitions::DateField': 'date',
    'CustomFieldDefinitions::SelectConstant': 'select',
    'CustomFieldDefinitions::SelectEditable': 'select_editable',
    'CustomFieldDefinitions::SelectMultipleConstant': 'select_multiple',
    'CustomFieldDefinitions::SelectMultipleEditable': 'select_multiple_editable',
    'CustomFieldDefinitions::ScorecardField': 'scorecard',
    'CustomFieldDefinitions::Records::UsersField': 'users',
    'CustomFieldDefinitions::Records::PersonasField': 'personas',
  };

  if (knownMappings[apiType]) {
    return knownMappings[apiType];
  }

  // Fallback: strip prefixes and convert to snake_case
  let normalized = apiType
    .replace('CustomFieldDefinitions::', '')
    .replace('Records::', '')
    .replace(/Field$/, '');

  normalized = normalized
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');

  return normalized;
}

async function generateSchema() {
  const ahaDomain = process.env.AHA_DOMAIN;
  const ahaApiToken = process.env.AHA_API_TOKEN;

  if (!ahaDomain || !ahaApiToken) {
    console.log('[INFO] Skipping custom field schema generation - environment variables not set');
    console.log('  AHA_DOMAIN=' + (ahaDomain || '(not set)'));
    console.log('  AHA_API_TOKEN=' + (ahaApiToken ? '(set)' : '(not set)'));
    console.log('  The server will use an existing cached schema if available.');
    return;
  }

  console.log('Fetching custom field definitions from Aha! API...');

  try {
    // NOTE: The Aha! API endpoint for custom_field_definitions ignores pagination
    // parameters and always returns the complete dataset in a single response.
    // This behavior was verified during implementation - do not add pagination
    // loops here unless Aha changes this API behavior in the future.
    const data = await restRequest(
      ahaDomain,
      ahaApiToken,
      `/api/v1/custom_field_definitions`
    );

    const definitions = data.custom_field_definitions;
    console.log(`  Found ${definitions.length} field definitions`);

    // Identify which definitions need options fetched
    const selectTypes = [
      'CustomFieldDefinitions::SelectConstant',
      'CustomFieldDefinitions::SelectEditable',
      'CustomFieldDefinitions::SelectMultipleConstant',
      'CustomFieldDefinitions::SelectMultipleEditable',
    ];

    const defsNeedingOptions = definitions.filter((def) =>
      selectTypes.includes(def.type)
    );

    console.log(`  Fetching options for ${defsNeedingOptions.length} select fields...`);

    // Fetch options in parallel for all select-type fields
    const optionsPromises = defsNeedingOptions.map((def) =>
      restRequest(
        ahaDomain,
        ahaApiToken,
        `/api/v1/custom_field_definitions/${def.id}/custom_field_options`
      ).catch((error) => {
        console.error(`  [WARNING] Failed to fetch options for field ${def.key}:`, error.message);
        return null;
      })
    );

    const optionsResults = await Promise.all(optionsPromises);

    // Build options map
    const optionsMap = new Map();
    defsNeedingOptions.forEach((def, index) => {
      const result = optionsResults[index];
      if (result && result.custom_field_options) {
        optionsMap.set(
          def.id,
          result.custom_field_options
            .filter((opt) => !opt.hidden)
            .map((opt) => opt.value)
        );
      }
    });

    // Group by record type and normalize
    const grouped = {};

    for (const def of definitions) {
      const recordType = def.custom_fieldable_type;

      if (!grouped[recordType]) {
        grouped[recordType] = [];
      }

      const isSelectType = selectTypes.includes(def.type);
      const options = isSelectType
        ? (optionsMap.get(def.id) || null)
        : null;

      grouped[recordType].push({
        id: String(def.id),
        key: def.key,
        name: def.name,
        type: normalizeCustomFieldType(def.type),
        options,
      });
    }

    // Build schema with metadata
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const schema = {
      _meta: {
        cached_at: now.toISOString(),
        expires_at: expires.toISOString(),
        ttl_days: 30,
      },
      custom_fields_by_record_type: grouped,
    };

    // Ensure build directory exists
    const projectRoot = path.resolve(__dirname, '..');
    const buildDir = path.join(projectRoot, 'build');
    await fs.mkdir(buildDir, { recursive: true });

    // Write to cache file
    const outputPath = path.join(buildDir, 'aha_custom_field_schema.json');
    await fs.writeFile(outputPath, JSON.stringify(schema, null, 2), 'utf-8');

    const recordTypeCounts = Object.keys(grouped).length;
    const totalFields = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

    console.log(`✓ Generated schema with ${totalFields} custom fields across ${recordTypeCounts} record types`);
    console.log(`  Cache expires: ${expires.toISOString().split('T')[0]}`);
    console.log(`  Output: ${outputPath}`);
  } catch (error) {
    console.error('[ERROR] Failed to generate custom field schema:');
    console.error(error.message);
    process.exit(1);
  }
}

generateSchema();
