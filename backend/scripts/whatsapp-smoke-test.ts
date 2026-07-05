/**
 * Smoke-test do WhatsApp Cloud API.
 *
 * Envia uma mensagem de TEXTO simples (só funciona dentro da janela de 24h —
 * o número de destino precisa ter mandado mensagem pro número business antes,
 * OU estar cadastrado como test recipient no painel da Meta).
 *
 * Uso (no Render shell ou local com as env vars setadas):
 *   WHATSAPP_SMOKE_TEST_TO=5511999999999 npx tsx scripts/whatsapp-smoke-test.ts
 *
 * Requer: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_SMOKE_TEST_TO
 */
import { sendWhatsAppText, normalizeBrazilianPhone } from "../src/services/whatsappService.js";

async function main() {
  const rawTo = process.env.WHATSAPP_SMOKE_TEST_TO;
  if (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    console.error("❌ WHATSAPP_ACCESS_TOKEN e/ou WHATSAPP_PHONE_NUMBER_ID não definidos.");
    process.exit(1);
  }
  if (!rawTo) {
    console.error("❌ Defina WHATSAPP_SMOKE_TEST_TO com o número de destino (ex.: 5511999999999).");
    process.exit(1);
  }
  const to = normalizeBrazilianPhone(rawTo);
  if (!to) {
    console.error(`❌ Número inválido: "${rawTo}". Use DDD + número, com ou sem DDI 55.`);
    process.exit(1);
  }

  console.log(`→ Enviando texto de teste para ${to} via phone_number_id=${process.env.WHATSAPP_PHONE_NUMBER_ID}...`);
  const result = await sendWhatsAppText(
    to,
    "✅ Smoke-test MeloCale: integração WhatsApp Cloud API funcionando."
  );

  console.log("\n--- Resultado ---");
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main();
