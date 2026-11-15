import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseOnvifProbeMatch } from '../../pmachines/javascript/src/network-bindings.mjs';

test('ONVIF ProbeMatch yields the advertised device-service endpoint', () => {
  const response = `<d:ProbeMatches xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery">
    <d:ProbeMatch><d:Types>dn:NetworkVideoTransmitter</d:Types>
    <d:XAddrs>http://192.0.2.42:2020/onvif/device_service</d:XAddrs></d:ProbeMatch>
    </d:ProbeMatches>`;

  assert.deepEqual(parseOnvifProbeMatch(response, '192.0.2.42'), {
    kind: 'camera',
    protocol: 'onvif',
    address: '192.0.2.42',
    port: 2020,
    serviceUrl: 'http://192.0.2.42:2020/onvif/device_service'
  });
});

test('ONVIF discovery ignores non-matches and invalid service URLs', () => {
  assert.equal(parseOnvifProbeMatch('<d:ProbeMatch/>', '192.0.2.42'), null);
  assert.equal(parseOnvifProbeMatch(
    '<d:ProbeMatch><d:Types>dn:NetworkVideoTransmitter</d:Types><d:XAddrs>file:///tmp</d:XAddrs></d:ProbeMatch>',
    '192.0.2.42'
  ), null);
});
