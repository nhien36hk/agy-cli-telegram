const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const execAsync = util.promisify(exec);

const PROJECT_DIR = path.resolve(__dirname, '../../');

/**
 * Lấy commit hash hiện tại của máy (Local)
 */
async function getLocalCommit() {
  try {
    const { stdout } = await execAsync('git rev-parse HEAD', { cwd: PROJECT_DIR });
    return stdout.trim();
  } catch (err) {
    return null;
  }
}

/**
 * Lấy commit hash mới nhất trên GitHub (Remote)
 * Sử dụng git ls-remote để lấy nhanh hash mà không cần git fetch tốn thời gian/băng thông.
 */
async function getRemoteCommit() {
  try {
    const { stdout } = await execAsync('git ls-remote origin -h refs/heads/main', { cwd: PROJECT_DIR });
    if (stdout) {
      return stdout.split('\t')[0].trim();
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Kiểm tra xem có bản cập nhật mới không
 */
async function checkUpdateAvailable() {
  const [local, remote] = await Promise.all([getLocalCommit(), getRemoteCommit()]);
  
  if (!local || !remote) {
    return { available: false, error: 'Could not retrieve version information' };
  }

  return {
    available: local !== remote,
    localVersion: local.substring(0, 7),
    remoteVersion: remote.substring(0, 7)
  };
}

/**
 * Thực hiện cập nhật ứng dụng: pull code & cài dependencies
 */
async function performUpdate() {
  try {
    await execAsync('git pull origin main', { cwd: PROJECT_DIR });
    await execAsync('npm install --silent', { cwd: PROJECT_DIR });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  checkUpdateAvailable,
  performUpdate,
  getLocalCommit
};
