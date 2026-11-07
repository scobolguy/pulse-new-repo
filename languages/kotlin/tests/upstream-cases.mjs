export const upstreamRevision = 'd17db9fd646aae75c55e67745f954c67f2e03e33';

// Paths are relative to JetBrains/kotlin's compiler/testData directory.
export const upstreamCases = [
  ['codegen/box/controlStructures/kt17110.kt', '6779502f9f96c7825dba7e58930199a5a33875b7b67c3f447633b38f97ae0e12', 'box', 'supported'],
  ['codegen/box/controlStructures/kt1899.kt', '93900383c2dc5c143e0982907c85066f8ad94c3ffc31942c6f662b99cceff4db', 'box', 'supported'],
  ['codegen/box/controlStructures/kt3087.kt', '918da924e4b49ba4863d789f5ce89f0477e08a686fd85dabd99b04edcb3fedb1', 'box', 'supported'],
  ['codegen/box/controlStructures/continueInWhile.kt', '6da31c64b761e0bbfd028dccca6dc35e87f8a351d911fe86704c6d599e27104f', 'box', 'supported'],
  ['codegen/box/controlStructures/ifConst2.kt', '6a781289548ba3bb63aefbd43ff0058bb8464a95bca9f33511636da923f62afe', 'box', 'supported'],
  ['codegen/box/controlStructures/ifIncompatibleBranches.kt', '855918e9e54d52a130a39c9113afd3777c05ab33329d1a61cb6abf98b3fd6435', 'box', 'supported'],
  ['diagnostics/tests/reassignment/if.kt', 'b77d55d03c4985a45c6af7da3ed8d5009f0a552098241c466b80aa1934783c2e', 'diagnostic', 'supported'],
  ['diagnostics/tests/reassignment/else.kt', '02d8936d9599c7b756e3b0494886fa26ea1f41d9d4e959b9f5b43b4d48884408', 'diagnostic', 'supported'],
  ['diagnostics/tests/reassignment/ifelse.kt', '09c45844cc44a3a10208f1e860a686f97b5c6dc79600f4dbe6f5d5a6477656d2', 'diagnostic', 'supported'],
  ['diagnostics/tests/reassignment/foronly.kt', 'e86b6dcfb47f52c992c27b013ebc55d565e8ec08db4c5418dc55af64de252ef1', 'diagnostic', 'supported'],
  ['diagnostics/tests/reassignment/dowhile.kt', '39cbdd7dba5853b7ded0ff56580319f9a2c679e0a245ac3b7ee57954ea8105a8', 'diagnostic', 'supported'],
  ['diagnostics/tests/reassignment/afterfor.kt', 'd18432ca3e1b5b9e93aedb046fbc144166c2abbf661f687436e270eb033edb1a', 'diagnostic', 'supported'],
  ['codegen/box/controlStructures/bottles.kt', '052007d95d927defcca7691514a165b65a54a53c8473629032405f781715a69d', 'box', 'gap'],
  ['codegen/box/controlStructures/doWhile.kt', 'c18d9084d012b0bcebe4b4f7612fe1e6739d2eb0074abd6381bfc276b4a5ac4c', 'box', 'gap'],
  ['codegen/box/controlStructures/factorialTest.kt', '2d979bfacf7571818390c678bb3f41d5a08d3b0cafaeb183c0261f86f12b2b69', 'box', 'gap'],
  ['codegen/box/controlStructures/kt958.kt', '2d7a33137b2fbe21595e38caf945ef6b111f1064fd0667a238c8b07220232a4b', 'box', 'gap'],
  ['codegen/box/controlStructures/ifConst1.kt', 'adb6b9a9d230e28454b614468a81d8ddd9373bfe401aec89fbd960cd009980b4', 'box', 'supported'],
  ['codegen/box/controlStructures/kt299.kt', 'ee1597c6b49dd2e02f24bbc684f30f3da1fe3e122b4f42e44a7fbf72ac48af56', 'box', 'gap'],
  ['codegen/box/controlStructures/kt2147.kt', '05db5c2eba6abcaac3d68082db36c4ca8af469050227caa45478279d28483e5a', 'box', 'gap'],
  ['codegen/box/controlStructures/kt2291.kt', '0c66ae322e3e660bdc91ad102dbed822ca02adc74a5dcfb016cd209ba282b1e0', 'box', 'gap'],
  ['codegen/box/controlStructures/kt15726.kt', 'ded6100d02d04df64c973991450ba4c43fa6167f18b971bfd5b04d23f84cc5b1', 'box', 'gap'],
  ['codegen/box/binaryOp/overflowInt.kt', 'd93996d8617c3d6f3ebe0e4850245d3199db0f917aa0c67bfbc49f592cfb93ab', 'box', 'gap'],
  ['codegen/box/functions/kt2271.kt', 'b0010bad8a6acdd42e1145f791b857c2a2439053c849f776d077854689bf65c8', 'box', 'gap'],
  ['codegen/box/functions/kt2739.kt', '7582beb96d6dee82f759961d2d65abb4a9a4fd49ac91f5a4e12e3b97fb570e4a', 'box', 'gap'],
  ['diagnostics/tests/reassignment/whiletrue.kt', '701ad0a5f678bd1a07f5d5a741ab96b7ee903549a2aeea59f01a1e784bb2ef1c', 'diagnostic', 'supported']
].map(([path, sha256, kind, status]) => ({ path, sha256, kind, status }));
