// backend/services/whatsappService.js
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

let sock;
let connectionStatus = "disconnected";
let currentQR = null;

async function connectWhatsApp() {
  console.log("Starting WhatsApp...");

  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: "silent" }),
    browser: ["Business Manager", "Chrome", "1.0.0"],
  });

  // SAVE SESSION
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // SHOW QR
    if (qr) {
      currentQR = qr;
      console.log("Scan QR Below:\n");
      qrcode.generate(qr, { small: true });
    }

    // CONNECTED
    if (connection === "open") {
      connectionStatus = "connected";
      currentQR = null;
      console.log("✅ WhatsApp Connected");
    }

    // CONNECTING
    if (connection === "connecting") {
      connectionStatus = "connecting";
      console.log("🔄 Connecting to WhatsApp...");
    }

    // DISCONNECTED
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      connectionStatus = "disconnected";
      console.log("❌ Connection closed");

      if (shouldReconnect) {
        console.log("🔄 Reconnecting...");
        setTimeout(() => connectWhatsApp(), 5000);
      }
    }
  });

  return sock;
}

// Get connection status
function getConnectionStatus() {
  return {
    status: connectionStatus,
    connected: connectionStatus === "connected",
    qrCode: currentQR,
  };
}

// Get QR code
function getQR() {
  return currentQR;
}

// Send text message
async function sendWhatsAppMessage(number, message) {
  try {
    if (!sock || connectionStatus !== "connected") {
      throw new Error("WhatsApp not connected. Please scan QR code first.");
    }

    const jid = `${number}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: message });
    console.log(`✅ Text message sent to ${number}`);
    return { success: true, message: "Message sent" };
  } catch (error) {
    console.log("WhatsApp Error:", error.message);
    throw error;
  }
}

// NEW: Send PDF document via WhatsApp
async function sendWhatsAppPDF(number, pdfBuffer, fileName, caption = "") {
  try {
    if (!sock || connectionStatus !== "connected") {
      throw new Error("WhatsApp not connected. Please scan QR code first.");
    }

    const jid = `${number}@s.whatsapp.net`;
    
    const result = await sock.sendMessage(jid, {
      document: pdfBuffer,
      mimetype: "application/pdf",
      fileName: fileName,
      caption: caption,
    });
    
    console.log(`✅ PDF sent to ${number}: ${fileName}`);
    return result;
  } catch (error) {
    console.log("WhatsApp PDF Error:", error.message);
    throw error;
  }
}

// NEW: Send image via WhatsApp
async function sendWhatsAppImage(number, imageBuffer, caption = "") {
  try {
    if (!sock || connectionStatus !== "connected") {
      throw new Error("WhatsApp not connected. Please scan QR code first.");
    }

    const jid = `${number}@s.whatsapp.net`;
    
    const result = await sock.sendMessage(jid, {
      image: imageBuffer,
      caption: caption,
    });
    
    console.log(`✅ Image sent to ${number}`);
    return result;
  } catch (error) {
    console.log("WhatsApp Image Error:", error.message);
    throw error;
  }
}

// NEW: Send any document (PDF, DOC, XLS, etc.)
async function sendWhatsAppDocument(number, documentBuffer, mimeType, fileName, caption = "") {
  try {
    if (!sock || connectionStatus !== "connected") {
      throw new Error("WhatsApp not connected. Please scan QR code first.");
    }

    const jid = `${number}@s.whatsapp.net`;
    
    const result = await sock.sendMessage(jid, {
      document: documentBuffer,
      mimetype: mimeType,
      fileName: fileName,
      caption: caption,
    });
    
    console.log(`✅ Document sent to ${number}: ${fileName}`);
    return result;
  } catch (error) {
    console.log("WhatsApp Document Error:", error.message);
    throw error;
  }
}

// NEW: Send message with buttons (optional)
async function sendWhatsAppWithButtons(number, text, buttons) {
  try {
    if (!sock || connectionStatus !== "connected") {
      throw new Error("WhatsApp not connected. Please scan QR code first.");
    }

    const jid = `${number}@s.whatsapp.net`;
    
    const result = await sock.sendMessage(jid, {
      text: text,
      buttons: buttons,
      headerType: 1,
    });
    
    console.log(`✅ Message with buttons sent to ${number}`);
    return result;
  } catch (error) {
    console.log("WhatsApp Button Error:", error.message);
    throw error;
  }
}

// Logout from WhatsApp
async function logoutWhatsApp() {
  try {
    if (sock) {
      await sock.logout();
      sock = null;
      connectionStatus = "disconnected";
      currentQR = null;
      console.log("✅ Logged out from WhatsApp");
      
      // Delete auth folder to force new QR on next connection
      const authPath = path.join(__dirname, "../auth_info");
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
      }
    }
    return { success: true, message: "Logged out" };
  } catch (error) {
    console.log("Logout Error:", error.message);
    throw error;
  }
}

// Reconnect WhatsApp
async function reconnectWhatsApp() {
  try {
    await logoutWhatsApp();
    await connectWhatsApp();
    console.log("🔄 Reconnecting WhatsApp...");
    return { success: true, message: "Reconnecting..." };
  } catch (error) {
    console.log("Reconnect Error:", error.message);
    throw error;
  }
}

module.exports = {
  connectWhatsApp,
  sendWhatsAppMessage,
  sendWhatsAppPDF,
  sendWhatsAppImage,
  sendWhatsAppDocument,
  sendWhatsAppWithButtons,
  getConnectionStatus,
  getQR,
  logoutWhatsApp,
  reconnectWhatsApp,
};