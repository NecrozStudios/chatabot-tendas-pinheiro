import express from "express";
import "dotenv/config";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WA_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v23.0";
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP || "5521995317420";

const sessions = new Map();

const tents = {
  "1": "6x3m",
  "2": "6x4m",
  "3": "6x5m",
  "4": "6x6m",
  "5": "10x10m"
};

function cleanPhone(phone = "") {
  return String(phone).replace(/\D/g, "");
}

function getSession(from) {
  if (!sessions.has(from)) {
    sessions.set(from, {
      step: "nome",
      data: {
        telefone: from
      }
    });
  }
  return sessions.get(from);
}

function resetSession(from) {
  sessions.set(from, {
    step: "nome",
    data: {
      telefone: from
    }
  });
  return sessions.get(from);
}

function brDate(value) {
  if (!value) return "";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeCep(value) {
  return String(value).replace(/\D/g, "");
}

async function lookupCep(cep) {
  const clean = normalizeCep(cep);
  if (clean.length !== 8) return null;

  const response = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
  if (!response.ok) throw new Error("Falha no ViaCEP");

  const data = await response.json();
  if (data.erro) return null;

  return {
    cep: clean,
    logradouro: data.logradouro || "",
    bairro: data.bairro || "",
    localidade: data.localidade || "",
    uf: data.uf || ""
  };
}

function summary(data) {
  return [
    "*CONFIRME SUA SOLICITAÇÃO*",
    "",
    `👤 *Cliente:* ${data.nome}`,
    `📱 *WhatsApp:* ${data.telefone}`,
    "",
    "📍 *LOCAL DO EVENTO*",
    `CEP: ${data.cepFormatted || data.cep}`,
    `${data.logradouro || "Logradouro não informado"}, Nº ${data.numero}`,
    `${data.bairro || "Bairro não informado"} - ${data.localidade || ""}/${data.uf || "RJ"}`,
    "",
    "⛺ *ESPECIFICAÇÕES*",
    `Tenda: ${data.tamanho}`,
    `Quantidade: ${data.quantidade}`,
    "",
    "📅 *AGENDAMENTO*",
    `Instalação: ${brDate(data.dataInstalacao)} às ${data.horaInstalacao}`,
    `Retirada: ${brDate(data.dataRetirada)} às ${data.horaRetirada}`,
    "",
    "💰 *ORÇAMENTO*",
    "Solicitação enviada para avaliação. O valor será informado pela equipe.",
    "",
    "Digite *1* para confirmar ou *2* para corrigir."
  ].join("\n");
}

function adminMessage(data) {
  return [
    "*NOVO PEDIDO DE ORÇAMENTO* ⛺",
    "",
    `👤 *Cliente:* ${data.nome}`,
    `📱 *WhatsApp:* ${data.telefone}`,
    "",
    "📍 *ENDEREÇO*",
    `CEP: ${data.cepFormatted || data.cep}`,
    `${data.logradouro || "Logradouro não informado"}, Nº ${data.numero}`,
    `${data.bairro || "Bairro não informado"} - ${data.localidade || ""}/${data.uf || "RJ"}`,
    "",
    "📐 *ESPECIFICAÇÕES*",
    `Tenda: ${data.tamanho}`,
    `Quantidade: ${data.quantidade}`,
    "",
    "📅 *AGENDAMENTO*",
    `Instalação: ${brDate(data.dataInstalacao)} às ${data.horaInstalacao}`,
    `Retirada: ${brDate(data.dataRetirada)} às ${data.horaRetirada}`,
    "",
    "💰 *ORÇAMENTO:* calcular e enviar ao cliente.",
    "",
    "_Pedido recebido automaticamente pelo chatbot._"
  ].join("\n");
}

async function sendWhatsAppText(to, body) {
  if (!WA_TOKEN || !PHONE_NUMBER_ID) {
    console.log("\n[SIMULAÇÃO - WhatsApp]\nPara:", to, "\n", body, "\n");
    return;
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Erro WhatsApp:", error);
    throw new Error("Não foi possível enviar mensagem pelo WhatsApp.");
  }
}

async function startConversation(from) {
  resetSession(from);

  await sendWhatsAppText(
    from,
    [
      "👋 *Olá! Seja bem-vindo à Tendas & Toldos Rio.*",
      "",
      "Vou registrar seus dados para solicitar um orçamento.",
      "",
      "Para começar, qual é o seu *nome completo*?"
    ].join("\n")
  );
}

async function handleMessage(from, text) {
  const input = String(text || "").trim();
  const lower = input.toLowerCase();
  const session = getSession(from);
  const data = session.data;

  if (["oi", "olá", "ola", "menu", "início", "inicio", "começar", "comecar"].includes(lower)) {
    await startConversation(from);
    return;
  }

  if (["cancelar", "cancel", "sair"].includes(lower)) {
    resetSession(from);
    await sendWhatsAppText(from, "Solicitação cancelada. Quando quiser, envie *oi* para começar novamente.");
    return;
  }

  switch (session.step) {
    case "nome":
      if (input.length < 3) {
        await sendWhatsAppText(from, "Por favor, informe seu nome completo.");
        return;
      }
      data.nome = input;
      session.step = "cep";
      await sendWhatsAppText(from, "📍 Agora informe o *CEP do local do evento* (somente o CEP).");
      break;

    case "cep": {
      const cep = normalizeCep(input);
      if (cep.length !== 8) {
        await sendWhatsAppText(from, "CEP inválido. Envie um CEP com 8 números, por exemplo: *21825-320*.");
        return;
      }

      try {
        const address = await lookupCep(cep);
        if (!address) {
          await sendWhatsAppText(from, "Não encontrei esse CEP. Confira e envie novamente.");
          return;
        }

        Object.assign(data, address);
        data.cepFormatted = `${cep.slice(0, 5)}-${cep.slice(5)}`;
        session.step = "confirmar_endereco";

        await sendWhatsAppText(
          from,
          [
            "📍 *Endereço encontrado:*",
            `${data.logradouro || "Logradouro não informado"}`,
            `Bairro: ${data.bairro || "Não informado"}`,
            `${data.localidade}/${data.uf}`,
            "",
            "Está correto?",
            "*1️⃣ Sim*",
            "*2️⃣ Não*"
          ].join("\n")
        );
      } catch {
        await sendWhatsAppText(from, "Não consegui consultar o CEP agora. Tente novamente em alguns instantes.");
      }
      break;
    }

    case "confirmar_endereco":
      if (input === "1") {
        session.step = "numero";
        await sendWhatsAppText(from, "🔢 Qual é o *número do imóvel*?");
      } else if (input === "2") {
        session.step = "cep";
        await sendWhatsAppText(from, "Tudo bem. Envie o CEP correto novamente.");
      } else {
        await sendWhatsAppText(from, "Responda *1* para Sim ou *2* para Não.");
      }
      break;

    case "numero":
      if (!input) {
        await sendWhatsAppText(from, "Informe o número do imóvel. Se não houver número, escreva *S/N*.");
        return;
      }
      data.numero = input;
      session.step = "tamanho";
      await sendWhatsAppText(
        from,
        [
          "⛺ *Qual tamanho de tenda você deseja?*",
          "",
          "1️⃣ 6x3m",
          "2️⃣ 6x4m",
          "3️⃣ 6x5m",
          "4️⃣ 6x6m",
          "5️⃣ 10x10m",
          "6️⃣ Outro tamanho"
        ].join("\n")
      );
      break;

    case "tamanho":
      if (tents[input]) {
        data.tamanho = tents[input];
        session.step = "quantidade";
        await sendWhatsAppText(from, "🔢 Quantas tendas você precisa?");
      } else if (input === "6") {
        session.step = "outro_tamanho";
        await sendWhatsAppText(from, "Informe o tamanho desejado, por exemplo: *8x4m*.");
      } else {
        await sendWhatsAppText(from, "Escolha uma opção de 1 a 6.");
      }
      break;

    case "outro_tamanho":
      if (!/^\d+([,.]\d+)?x\d+([,.]\d+)?\s*m?$/i.test(input)) {
        await sendWhatsAppText(from, "Formato inválido. Informe assim: *8x4m*.");
        return;
      }
      data.tamanho = input;
      session.step = "quantidade";
      await sendWhatsAppText(from, "🔢 Quantas tendas você precisa?");
      break;

    case "quantidade": {
      const qty = Number.parseInt(input, 10);
      if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
        await sendWhatsAppText(from, "Informe uma quantidade entre *1 e 100*.");
        return;
      }
      data.quantidade = qty;
      session.step = "data_instalacao";
      await sendWhatsAppText(from, "📅 Qual é a *data desejada para instalação*? Envie no formato *DD/MM/AAAA*.");
      break;
    }

    case "data_instalacao":
      if (!validBrDate(input)) {
        await sendWhatsAppText(from, "Data inválida. Use o formato *DD/MM/AAAA*.");
        return;
      }
      data.dataInstalacao = brToIso(input);
      session.step = "hora_instalacao";
      await sendWhatsAppText(from, "🕐 Qual é o *horário preferencial para instalação*? Ex.: *10:00*.");
      break;

    case "hora_instalacao":
      if (!validTime(input)) {
        await sendWhatsAppText(from, "Horário inválido. Use o formato *HH:MM*, por exemplo *10:00*.");
        return;
      }
      data.horaInstalacao = input;
      session.step = "data_retirada";
      await sendWhatsAppText(from, "📅 Qual é a *data desejada para retirada*? Envie no formato *DD/MM/AAAA*.");
      break;

    case "data_retirada":
      if (!validBrDate(input)) {
        await sendWhatsAppText(from, "Data inválida. Use o formato *DD/MM/AAAA*.");
        return;
      }
      if (brToIso(input) < data.dataInstalacao) {
        await sendWhatsAppText(from, "A retirada não pode ser antes da instalação. Informe outra data.");
        return;
      }
      data.dataRetirada = brToIso(input);
      session.step = "hora_retirada";
      await sendWhatsAppText(from, "🕐 Qual é o *horário preferencial para retirada*? Ex.: *12:00*.");
      break;

    case "hora_retirada":
      if (!validTime(input)) {
        await sendWhatsAppText(from, "Horário inválido. Use o formato *HH:MM*, por exemplo *12:00*.");
        return;
      }
      data.horaRetirada = input;
      session.step = "confirmacao";
      await sendWhatsAppText(from, summary(data));
      break;

    case "confirmacao":
      if (input === "1") {
        await sendWhatsAppText(from, "⏳ Recebido! Estou enviando sua solicitação para nossa equipe.");

        try {
          await sendWhatsAppText(ADMIN_WHATSAPP, adminMessage(data));
          await sendWhatsAppText(
            from,
            "✅ *Solicitação enviada com sucesso!*\n\nNossa equipe irá analisar os dados e retornar com o orçamento e a disponibilidade.\n\nObrigado pelo contato! ⛺"
          );
          resetSession(from);
        } catch {
          await sendWhatsAppText(
            from,
            "⚠️ Seus dados foram registrados, mas não consegui avisar a equipe automaticamente. Por favor, tente novamente mais tarde."
          );
        }
      } else if (input === "2") {
        resetSession(from);
        await sendWhatsAppText(from, "Sem problema. Vamos começar novamente.\n\nQual é o seu *nome completo*?");
      } else {
        await sendWhatsAppText(from, "Responda *1* para confirmar ou *2* para corrigir.");
      }
      break;

    default:
      resetSession(from);
      await sendWhatsAppText(from, "Vamos começar novamente. Qual é o seu *nome completo*?");
  }
}

function validBrDate(value) {
  const m = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;

  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));

  return date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d;
}

function brToIso(value) {
  const [d, m, y] = value.split("/");
  return `${y}-${m}-${d}`;
}

function validTime(value) {
  const m = String(value).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return Boolean(m);
}

// Webhook de verificação da Meta
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// Webhook de mensagens recebidas
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages || [];

    for (const message of messages) {
      if (message.type !== "text") continue;

      const from = cleanPhone(message.from);
      const text = message.text?.body || "";

      await handleMessage(from, text);
    }
  } catch (error) {
    console.error("Erro no webhook:", error);
  }
});

app.get("/", (_req, res) => {
  res.json({
    status: "online",
    service: "Chatbot Tendas & Toldos Rio",
    webhook: "/webhook"
  });
});

app.listen(PORT, () => {
  console.log(`Chatbot rodando na porta ${PORT}`);
});
