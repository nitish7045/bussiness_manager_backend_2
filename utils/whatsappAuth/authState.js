const fs = require('fs').promises;
const path = require('path');

const SESSION_DIR = path.join(__dirname, 'session');

async function ensureSessionDir() {
    try {
        await fs.access(SESSION_DIR);
    } catch {
        await fs.mkdir(SESSION_DIR, { recursive: true });
    }
}

async function saveAuthState(state) {
    await ensureSessionDir();
    await fs.writeFile(
        path.join(SESSION_DIR, 'creds.json'),
        JSON.stringify(state.creds, null, 2)
    );
    if (state.keys) {
        await fs.writeFile(
            path.join(SESSION_DIR, 'keys.json'),
            JSON.stringify(state.keys, null, 2)
        );
    }
}

async function loadAuthState() {
    await ensureSessionDir();
    
    let creds = {};
    let keys = {};
    
    try {
        const credsData = await fs.readFile(path.join(SESSION_DIR, 'creds.json'), 'utf-8');
        creds = JSON.parse(credsData);
    } catch {}
    
    try {
        const keysData = await fs.readFile(path.join(SESSION_DIR, 'keys.json'), 'utf-8');
        keys = JSON.parse(keysData);
    } catch {}
    
    return { creds, keys };
}

async function clearAuthState() {
    try {
        await fs.unlink(path.join(SESSION_DIR, 'creds.json')).catch(() => {});
        await fs.unlink(path.join(SESSION_DIR, 'keys.json')).catch(() => {});
    } catch (err) {
        console.error('Error clearing auth state:', err);
    }
}

module.exports = { saveAuthState, loadAuthState, clearAuthState, SESSION_DIR };