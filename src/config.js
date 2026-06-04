const fs = require('fs');
const path = require('path');

// Determine the config path. Support overrides via process.env.CONFIG_PATH for unit testing.
const configPath = process.env.CONFIG_PATH || path.resolve(__dirname, '../config.json');

if (!fs.existsSync(configPath)) {
  const errorMsg = `Error: Configuration file not found at ${configPath}`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}

let configData;
try {
  const content = fs.readFileSync(configPath, 'utf8');
  configData = JSON.parse(content);
} catch (err) {
  const errorMsg = `Error parsing config JSON at ${configPath}: ${err.message}`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}

const token = configData.token;
if (!token) {
  const errorMsg = 'Error: "token" is missing or empty in configuration';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

const hasAllowedUserId = configData.allowedUserId !== undefined && configData.allowedUserId !== null;
const hasAllowedUserIds = configData.allowedUserIds !== undefined && configData.allowedUserIds !== null;

if (!hasAllowedUserId && !hasAllowedUserIds) {
  const errorMsg = 'Error: Both "allowedUserId" and "allowedUserIds" are missing in configuration';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

// Convert input to a standardized array of strings
function normalizeUserIds(val) {
  if (Array.isArray(val)) {
    return val.map(item => String(item).trim()).filter(Boolean);
  }
  const strVal = String(val).trim();
  return strVal ? [strVal] : [];
}

let allowedUserIds = [];
if (hasAllowedUserIds) {
  allowedUserIds = normalizeUserIds(configData.allowedUserIds);
} else if (hasAllowedUserId) {
  allowedUserIds = normalizeUserIds(configData.allowedUserId);
}

if (allowedUserIds.length === 0) {
  const errorMsg = 'Error: No valid user IDs found in "allowedUserId" or "allowedUserIds"';
  console.error(errorMsg);
  throw new Error(errorMsg);
}

module.exports = {
  token,
  allowedUserIds
};
