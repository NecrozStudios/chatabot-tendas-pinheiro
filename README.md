# Chatbot WhatsApp — Tendas & Toldos Rio

Primeira versão do chatbot para receber solicitações de orçamento.

## O que ele faz

- Recebe o cliente pelo WhatsApp.
- Pergunta nome.
- Consulta CEP automaticamente pelo ViaCEP.
- Confirma o endereço.
- Pergunta número.
- Pergunta tamanho e quantidade da tenda.
- Pergunta data/hora de instalação.
- Pergunta data/hora de retirada.
- Valida datas e horários básicos.
- Mostra um resumo para confirmação.
- Envia a solicitação para o WhatsApp administrativo.
- Não calcula preço da tenda.
- Não calcula frete/deslocamento.
- CEP/endereço ficam apenas como informação do pedido.

## 1. Requisitos

- Node.js 18 ou superior.
- Uma conta Meta Business.
- WhatsApp Business Platform / Cloud API.
- Um número configurado na plataforma da Meta.
- Uma URL HTTPS pública para o webhook.

## 2. Instalar

```bash
npm install
```

Copie `.env.example` para `.env`:

```bash
cp .env.example .env
```

Preencha:

- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_VERIFY_TOKEN`
- `ADMIN_WHATSAPP`

Depois:

```bash
npm start
```

## 3. Webhook

Cadastre na Meta:

```text
https://SEU-DOMINIO.com/webhook
```

Token de verificação:

```text
o mesmo valor de WHATSAPP_VERIFY_TOKEN
```

Assine o evento de mensagens (`messages`).

## 4. Teste local

Sem configurar a API do WhatsApp, o servidor funciona em modo de simulação: as mensagens aparecem no terminal.

Para testar o webhook localmente, use um túnel HTTPS, como o Cloudflare Tunnel ou ngrok.

## 5. Observações importantes

Esta versão usa memória para guardar a conversa. Se o servidor reiniciar, as sessões são perdidas.

Para produção, a próxima versão deve usar banco de dados, por exemplo PostgreSQL, e incluir:

- painel administrativo;
- histórico de clientes;
- status do orçamento;
- controle de agenda;
- bloqueio de datas/horários;
- envio de orçamento;
- templates aprovados da Meta;
- logs;
- autenticação do painel;
- tratamento de mensagens de áudio/imagem;
- recuperação de conversa interrompida.

O chatbot não deve ser usado para prometer disponibilidade antes da confirmação da equipe.
