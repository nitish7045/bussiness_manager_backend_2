const axios = require("axios");

async function sendWhatsApp(user, message) {
  try {
    const phone = user.companyDetails?.whatsappNumber;
    const apikey = user.companyDetails?.whatsappApiKey;

    if (!phone || !apikey) {
      return;
    }

    const url =
      `https://api.callmebot.com/whatsapp.php` +
      `?phone=${phone}` +
      `&text=${encodeURIComponent(message)}` +
      `&apikey=${apikey}`;

    await axios.get(url);

    console.log("WhatsApp sent");
  } catch (err) {
    console.log("WhatsApp Error:", err.message);
  }
}

module.exports = sendWhatsApp;