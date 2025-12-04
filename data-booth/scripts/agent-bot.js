/* eslint-disable no-console */
const { createWalletClient, http, parseEther } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const PRIVATE_KEY = process.env.MOVE_TEST_WALLET_KEY ?? '0xYOUR_TEST_WALLET_PRIVATE_KEY';
const TARGET_URL = process.env.TOLLBOOTH_TARGET_URL ?? 'http://localhost:3000/api/premium/data';

const movementChain = {
  id: 30732,
  name: 'Movement Bardock',
  network: 'movement',
  nativeCurrency: { name: 'MOVE', symbol: 'MOVE', decimals: 18 },
  rpcUrls: { default: { http: ['https://mevm.testnet.imola.movementlabs.xyz'] } },
};

async function runAgent() {
  console.log('🤖 Agent waking up...');

  const initialRes = await fetch(TARGET_URL);

  if (initialRes.status !== 402) {
    console.log('Unexpected status code:', initialRes.status);
    console.log(await initialRes.text());
    return;
  }

  console.log('⛔ 402 Payment Required encountered.');

  const instructionsHeader = initialRes.headers.get('X-Payment-Accepts');
  if (!instructionsHeader) {
    throw new Error('Missing X-Payment-Accepts header');
  }

  const instructions = JSON.parse(instructionsHeader);
  console.log(
    `💰 Price: ${instructions.amount} ${instructions.token} to ${instructions.recipient} on chain ${instructions.chainId}`,
  );

  const account = privateKeyToAccount(PRIVATE_KEY);
  const client = createWalletClient({
    account,
    chain: movementChain,
    transport: http(),
  });

  console.log('💸 Sending transaction...');
  const hash = await client.sendTransaction({
    to: instructions.recipient,
    value: parseEther(instructions.amount),
  });
  console.log(`✅ Tx Sent: ${hash}`);

  await new Promise((resolve) => setTimeout(resolve, 2000));

  const proof = Buffer.from(JSON.stringify({ txHash: hash })).toString('base64');

  console.log('🔓 Retrying with proof...');
  const paidRes = await fetch(TARGET_URL, {
    headers: { 'X-Payment': proof },
  });

  const data = await paidRes.json();
  console.log('🎉 SUCCESS! Data received:');
  console.log(data);
}

runAgent().catch((error) => {
  console.error('Agent failed', error);
  process.exit(1);
});

