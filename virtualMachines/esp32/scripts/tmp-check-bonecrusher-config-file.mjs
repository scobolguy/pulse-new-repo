const urls = [
  'http://192.168.2.115/ffs/list',
  'http://192.168.2.115/ffs/get?file=/bonecrusher-worker-config.json'
];

for (const url of urls) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log(`URL: ${url}`);
    console.log(`HTTP: ${res.status}`);
    console.log(text);
    console.log('---');
  } catch (error) {
    console.log(`URL: ${url}`);
    console.log(`ERR: ${error?.message || String(error)}`);
    console.log('---');
  }
}
