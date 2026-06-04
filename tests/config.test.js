const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const configModulePath = path.resolve(__dirname, '../src/config.js');

// Helper to write temporary config file, set environment variable, and require the module
function loadConfigWithContent(content) {
  const tempPath = path.resolve(__dirname, `temp_config_${Math.random().toString(36).substring(7)}.json`);
  if (content !== null) {
    fs.writeFileSync(tempPath, typeof content === 'string' ? content : JSON.stringify(content));
  }
  
  process.env.CONFIG_PATH = tempPath;
  // Clear require cache for the config module
  delete require.cache[require.resolve(configModulePath)];
  
  try {
    const config = require(configModulePath);
    return { config, tempPath };
  } catch (err) {
    return { error: err, tempPath };
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    delete process.env.CONFIG_PATH;
  }
}

test('Config Loader Tests', async (t) => {
  await t.test('loads valid config with single allowedUserId', () => {
    const validConfig = {
      token: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      allowedUserId: 123456789
    };
    
    const { config, error } = loadConfigWithContent(validConfig);
    assert.strictEqual(error, undefined);
    assert.strictEqual(config.token, validConfig.token);
    assert.deepStrictEqual(config.allowedUserIds, ['123456789']);
  });

  await t.test('loads valid config with allowedUserIds array', () => {
    const validConfig = {
      token: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      allowedUserIds: [123456789, '987654321', '']
    };
    
    const { config, error } = loadConfigWithContent(validConfig);
    assert.strictEqual(error, undefined);
    assert.strictEqual(config.token, validConfig.token);
    assert.deepStrictEqual(config.allowedUserIds, ['123456789', '987654321']);
  });

  await t.test('throws error if file does not exist', () => {
    // Override CONFIG_PATH to a non-existent file
    process.env.CONFIG_PATH = path.resolve(__dirname, 'non_existent_file.json');
    delete require.cache[require.resolve(configModulePath)];
    
    assert.throws(() => {
      require(configModulePath);
    }, /Configuration file not found/);
    
    delete process.env.CONFIG_PATH;
  });

  await t.test('throws error if file is invalid JSON', () => {
    const { error } = loadConfigWithContent('invalid-json{');
    assert.ok(error instanceof Error);
    assert.match(error.message, /parsing config JSON/);
  });

  await t.test('throws error if token is missing', () => {
    const invalidConfig = {
      allowedUserId: '123456789'
    };
    const { error } = loadConfigWithContent(invalidConfig);
    assert.ok(error instanceof Error);
    assert.match(error.message, /"token" is missing/);
  });

  await t.test('throws error if both allowedUserId and allowedUserIds are missing', () => {
    const invalidConfig = {
      token: 'some-token'
    };
    const { error } = loadConfigWithContent(invalidConfig);
    assert.ok(error instanceof Error);
    assert.match(error.message, /missing in configuration/);
  });

  await t.test('throws error if allowedUserId resolves to empty array', () => {
    const invalidConfig = {
      token: 'some-token',
      allowedUserIds: []
    };
    const { error } = loadConfigWithContent(invalidConfig);
    assert.ok(error instanceof Error);
    assert.match(error.message, /No valid user IDs found/);
  });
});
