const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const axios = require("axios");

let records = [];
const client = new Client({
  authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("message", async (message) => {
  const user = message.from;
  const body = message.body;

  try {
    if (body.startsWith("/cekawb ")) {
      const awb = body.split("/cekawb ")[1].trim().toUpperCase();

      const apiUrl = `https://apiv2.jne.co.id:10205/tracing/api/list/v1/cnote/${awb}`;
      const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Laravel-Request",
        Accept: "*/*",
        Host: "apiv2.jne.co.id:10205",
      };

      const username = "RUPA";
      const apikey = "19a6594938f819daaca6181d59060b68";

      const payload = {
        username: username,
        api_key: apikey,
      };

      const requestBody = new URLSearchParams(payload).toString();

    try {
      const response = await axios.post(apiUrl, requestBody, { headers });

      // Mengambil data yang diinginkan dari tanggapan API
      const {
        cnote_no,
        cnote_receiver_name,
        pod_status,
        cnote_pod_receiver,
        photo,
        last_status,
      } = response.data.cnote;

      // Gunakan operator ternary untuk menampilkan emoticon "? " jika cnote_pod_receiver adalah null
      const podReceiver =
        cnote_pod_receiver !== null ? cnote_pod_receiver : "?";

      // Kirim tanggapan ke pengguna di WhatsApp dengan data yang diinginkan
      const replyMessage = `===================\n🤖 Hello, *ab0t* here 🤖 \nThis is the reply to your request. \n===================\n\n📦🚚\nNomor AWB : *${cnote_no}*\nReceiver Name: ${cnote_receiver_name}\nPOD Status: ${pod_status}\nPOD Receiver: ${cnote_pod_receiver}\nLast Status: ${last_status}`;
      message.reply(replyMessage);

      // Menambahkan kode untuk mengirim foto melalui WhatsApp
      const media = await MessageMedia.fromUrl(photo);
      client.sendMessage(message.from, media, {
        caption: "Hasil foto dari kurir",
      });
    } catch (error) {
      // Tanggapan dari API gagal atau terjadi kesalahan
      console.error("Error:", error.message);

      // Kirim pesan kesalahan ke pengguna di WhatsApp
      message.reply(
        "Terjadi kesalahan saat mengambil data AWB. Mohon coba lagi nanti."
      );
    }
    } else if (body === "/catat") {
      await client.sendMessage(user, showMenu());
    } else if (body === "4") {
      showTransactionHistory(user);
    } else if (["1", "2", "3"].includes(body)) {
      handleMenu(client, user, body);
    } else if (records.some((record) => record.user === user && record.state === "waiting_for_usage")) {
      const lastRecord = records.find((record) => record.user === user && record.state === "waiting_for_usage");
      lastRecord.usage = body;
      lastRecord.state = "waiting_for_amount";
      await client.sendMessage(user, "Masukkan nominal:");
    } else if (records.some((record) => record.user === user && record.state === "waiting_for_amount")) {
      const lastRecord = records.find((record) => record.user === user && record.state === "waiting_for_amount");
      const amount = parseFloat(body);
      if (isNaN(amount)) {
        await client.sendMessage(user, "Nominal harus berupa angka. Masukkan ulang:");
        return;
      }
      lastRecord.amount = amount;
      lastRecord.state = "waiting_for_payment_method";
      await client.sendMessage(user, "Masukkan metode pembayaran (contoh: Tunai, Transfer, dll):");
    } else if (records.some((record) => record.user === user && record.state === "waiting_for_payment_method")) {
      const lastRecord = records.find((record) => record.user === user && record.state === "waiting_for_payment_method");
      lastRecord.paymentMethod = body;
      lastRecord.state = "complete";

      const successMessage = `Pencatatan ${lastRecord.type} sebesar ${lastRecord.amount} telah selesai.\nKeterangan: ${lastRecord.usage}\nMetode Pembayaran: ${lastRecord.paymentMethod}\nTerima kasih!`;
      await client.sendMessage(user, successMessage);
      saveRecordsToFile(records);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
});

function showMenu() {
  return (
    "\n===== Aplikasi Pencatat Uang =====\n1. Tambah Pemasukan\n2. Tambah Pengeluaran\n3. Lihat Total Saldo\n4. Lihat Riwayat Transaksi\n5. Keluar"
  );
}

async function handleMenu(client, user, choice) {
  try {
    switch (choice) {
      case "1":
        records.push({ type: "Pemasukan", user: user, state: "waiting_for_usage", date: new Date() });
        await client.sendMessage(user, "Masukkan keterangan untuk pemasukan:");
        break;
      case "2":
        records.push({ type: "Pengeluaran", user: user, state: "waiting_for_usage", date: new Date() });
        await client.sendMessage(user, "Masukkan keterangan untuk pengeluaran:");
        break;
      case "3":
        showTotalBalance(client, user);
        break;
      case "4":
        showTransactionHistory(user); // Memanggil fungsi untuk menampilkan riwayat transaksi
        break;
      case "5":
        await client.sendMessage(user, "Terima kasih telah menggunakan aplikasi Pencatat Uang!");
        await client.endChat(user);
        break;
      default:
        await client.sendMessage(user, "Pilihan tidak valid. Silakan pilih menu yang benar.");
        break;
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

function showTotalBalance(client, user) {
  let totalIncome = 0;
  let totalExpense = 0;

  records.forEach((record) => {
    if (record.type === "Pemasukan") {
      totalIncome += record.amount;
    } else if (record.type === "Pengeluaran") {
      totalExpense += record.amount;
    }
  });

  const balance = totalIncome - totalExpense;
  const balanceMessage = `Total Pemasukan: ${totalIncome}\nTotal Pengeluaran: ${totalExpense}\nSaldo Akhir: ${balance}`;
  client.sendMessage(user, balanceMessage);
}

function showTransactionHistory(user) {
  const userRecords = records.filter((record) => record.user === user && record.state === "complete");

  if (userRecords.length === 0) {
    client.sendMessage(user, "Tidak ada riwayat transaksi.");
    return;
  }

  let historyMessage = "Riwayat Transaksi:\n";

  userRecords.forEach((record, index) => {
    const transactionType = record.type === "Pemasukan" ? "Pemasukan" : "Pengeluaran";
    const dateObject = new Date(record.date);
    const transactionDate = dateObject.toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    historyMessage += `\n${index + 1}. ${transactionType}\n`;
    historyMessage += `   Tanggal: ${transactionDate}\n`;
    historyMessage += `   Keterangan: ${record.usage}\n`;
    historyMessage += `   Nominal: ${record.amount}\n`;
    historyMessage += `   Metode Pembayaran: ${record.paymentMethod}\n`;
  });

  client.sendMessage(user, historyMessage);
}


function addNewRecord(record) {
  records.push(record);
  saveRecordsToFile(records);
}

function saveRecordsToFile(records) {
  const jsonData = JSON.stringify(records, null, 2);
  fs.writeFile("records.json", jsonData, (err) => {
    if (err) {
      console.error("Error writing to JSON file:", err);
    } else {
      console.log("Records saved to JSON file.");
    }
  });
}

client.on("ready", () => {
  console.log("Client is ready!");
});

fs.readFile("records.json", "utf8", (err, data) => {
  if (!err) {
    try {
      records = JSON.parse(data || "[]");
      console.log("Existing data loaded from JSON file.");
    } catch (parseError) {
      console.error("Error parsing JSON:", parseError);
      // Handle parsing error
    }
  } else {
    console.error("Error reading JSON file:", err);
    // Handle file reading error
  }

  // After reading data, initialize the WhatsApp client
  client.initialize();
});
