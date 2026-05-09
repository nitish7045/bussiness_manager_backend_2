const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const qrcode = require("qrcode-terminal");

let sock;

async function connectWhatsApp() {

  console.log("Starting WhatsApp...");

  const { state, saveCreds } =
    await useMultiFileAuthState("auth_info");

  const { version } =
    await fetchLatestBaileysVersion();

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

    const {
      connection,
      lastDisconnect,
      qr,
    } = update;

    // SHOW QR
    if (qr) {

      console.log("Scan QR Below:\n");

      qrcode.generate(qr, {
        small: true,
      });

    }

    // CONNECTED
    if (connection === "open") {

      console.log("✅ WhatsApp Connected");

    }

    // DISCONNECTED
    if (connection === "close") {

      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log("❌ Connection closed");

      if (shouldReconnect) {

        console.log("🔄 Reconnecting...");

        connectWhatsApp();

      }

    }

  });

}

async function sendWhatsAppMessage(
  number,
  message
) {

  try {

    const jid =
      `${number}@s.whatsapp.net`;

    await sock.sendMessage(jid, {
      text: message,
    });

    console.log("✅ Message Sent");

  } catch (error) {

    console.log(
      "WhatsApp Error:",
      error.message
    );

  }

}

module.exports = {
  connectWhatsApp,
  sendWhatsAppMessage,
};