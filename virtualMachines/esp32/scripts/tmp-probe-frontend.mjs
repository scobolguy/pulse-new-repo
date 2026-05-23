#!/usr/bin/env node

const url = process.argv[2] || 'http://127.0.0.1:5173/';

async function main() {
  const res = await fetch(url);
  const text = await res.text();
  console.log('status=' + res.status);
  console.log('length=' + text.length);
  console.log(text.slice(0, 200));
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
