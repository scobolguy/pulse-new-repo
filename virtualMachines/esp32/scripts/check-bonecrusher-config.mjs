const urls = [
  "http://192.168.2.115/ffs/list",
  "http://192.168.2.115/ffs/get?file=/bonecrusher-worker-config.json"
];

for (const url of urls) {
  console.log(`URL: ${url}`);
  try {
    const response = await fetch(url);
    const text = await response.text();
    console.log(`HTTP: ${response.status}`);
    console.log(text);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    console.log(`ERR: ${message}`);
  }
  console.log("---");
}
