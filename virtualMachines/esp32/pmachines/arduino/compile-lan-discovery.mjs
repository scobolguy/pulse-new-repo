import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { compilePascalishProgramWithAntlr } from '../../aggregator/scripts/compile-pascalish-program-antlr-to-pcode.mjs';
import { compactServiceHostProgramMap } from '../shared/contracts/service-host-bindings.mjs';
import { encodeHostedImage } from '../shared/contracts/hosted-image.mjs';
import { attachPcodeSignature } from '../../aggregator/scripts/pcode-signing.mjs';

export async function compileNativeLanDiscovery() {
  const source = await fs.readFile(new URL('../../src/service-lifecycle/discovery.pas', import.meta.url), 'utf8');
  const compiled = compilePascalishProgramWithAntlr(source, { hostServices: true, nativeTarget: true });
  if (!compiled.programMap.targets.includes('esp32')) throw new Error('Discovery requires unavailable native host bindings');
  const image = encodeHostedImage(compiled.pcodeText, { profile: 'extended' });
  const map = attachPcodeSignature({
    ...compactServiceHostProgramMap(compiled.programMap),
    hostImageFormat: 'PHI1', hostImageProfile: 'extended',
  }, image);
  delete map.signing.signedAt;
  return { compiled, image, map };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { compiled, image, map } = await compileNativeLanDiscovery();
  const chunks = image.match(/.{1,256}/g).map(chunk => `  "${chunk}"`).join('\n');
  const header = `// Generated from shared discovery.pas; regenerate with compile-lan-discovery.mjs.\n`
    + `#pragma once\nnamespace pmachine {\n`
    + `static const char LAN_DISCOVERY_IMAGE[] =\n${chunks};\n`
    + `static const char LAN_DISCOVERY_MAP[] = ${JSON.stringify(JSON.stringify(map))};\n}\n`;
  await fs.writeFile(new URL('./src/lan_discovery_image.h', import.meta.url), header);
  if (process.argv.includes('--native-probe')) {
    const directory = new URL('../../.pio/native-discovery-probe/', import.meta.url);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(new URL('policy.pcode', directory), compiled.pcodeText);
    await fs.writeFile(new URL('policy.map.json', directory), JSON.stringify(compiled.programMap));
  }
  console.log(`Native LAN policy: ${compiled.pcodeText.trim().split('\n').length} instructions, ${image.length} signed paged bytes`);
}
