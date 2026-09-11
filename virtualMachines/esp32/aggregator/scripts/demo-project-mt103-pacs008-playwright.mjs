import { chromium } from 'playwright'
import fs from 'fs/promises'
import path from 'path'

const baseUrl = process.env.PULSE_DEMO_URL || 'http://127.0.0.1:5174'
const esp32Target = 'DisplayNode'
const esp32Ip = '192.168.2.155'
const jsPmachineTarget = process.env.PULSE_JS_PMACHINE_TARGET || 'magic-js-pmachine-01'
const projectId = `mt103-pacs008-demo-${Date.now()}`
const projectLabel = 'MT103 to PACS.008 Demo'
const serviceFileName = 'mt103-to-pacs008.pas'
const serviceSource = [
  'service "mt103-to-pacs008" on local;',
  'role code_librarian;',
  'mapper "cbds-mt103-to-pacs008" source "swift-mt103" target "pacs.008" begin',
  '  map "block4.20" to "Document.FIToFICstmrCdtTrf.GrpHdr.MsgId" using "output := trim(src);";',
  '  map "block4.32A.amount" to "Document.FIToFICstmrCdtTrf.CdtTrfTxInf.IntrBkSttlmAmt" using "output := mtamounttodecimal(src);";',
  'end;',
  'router "mt103-to-pacs008-route" input "swift.mt103.parsed" begin',
  '  output "pacs.008.outbound" when "output := 1;" transform "output := map(\'cbds-mt103-to-pacs008\', src);";',
  'end;',
  'begin',
  'end.'
].join('\n')

async function jsonRequest(page, url, options = {}) {
  const requestOptions = { ...options }
  if (requestOptions.body !== undefined) {
    requestOptions.data = requestOptions.body
    delete requestOptions.body
  }
  const response = await page.request.fetch(new URL(url, baseUrl).toString(), requestOptions)
  const text = await response.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = { raw: text } }
  return { status: response.status(), ok: response.ok(), data }
}

async function main() {
  await fs.mkdir(path.resolve('demo-output'), { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } })
  const report = { baseUrl, projectId, projectLabel, esp32Target, esp32Ip, jsPmachineTarget, steps: [] }

  try {
    await page.goto(`${baseUrl}/projects`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.getByPlaceholder('project-id').fill(projectId)
    await page.getByPlaceholder('Project label (optional)').fill(projectLabel)
    await page.getByRole('button', { name: 'Create Project', exact: true }).click()
    await page.getByText(projectLabel, { exact: true }).first().waitFor()
    await page.locator('button').filter({ hasText: projectLabel }).last().click()
    await page.getByText('Path: ' + projectId, { exact: true }).waitFor()
    report.steps.push({ step: 'create project', ok: true, projectId })

    const saveSource = await jsonRequest(page, `/api/projects/${encodeURIComponent(projectId)}/resources/programs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: serviceFileName, content: serviceSource })
    })
    if (!saveSource.ok) throw new Error(`service source creation failed (${saveSource.status}): ${JSON.stringify(saveSource.data)}`)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('button').filter({ hasText: projectLabel }).last().click()
    await page.getByText('Path: ' + projectId, { exact: true }).waitFor()
    await page.getByRole('button', { name: serviceFileName, exact: true }).waitFor()
    await page.getByRole('button', { name: serviceFileName, exact: true }).click()
    report.steps.push({ step: 'create and open service source', ok: true, file: serviceFileName })

    const workspaceResponse = await jsonRequest(page, `/api/projects/${encodeURIComponent(projectId)}/workspace`)
    const workspace = workspaceResponse.data.workspace
    workspace.projectModel.services = [{
      id: 'service.mt103-to-pacs008',
      name: 'MT103 to PACS.008 Mapper Service',
      protocol: 'pmachine',
      contractRef: 'swift-mt103-to-pacs.008',
      fileName: serviceFileName,
      inputQueue: 'swift.mt103.parsed',
      outputQueue: 'pacs.008.outbound'
    }]
    workspace.projectModel.programs = [{ id: 'mt103-to-pacs008.main', fileName: serviceFileName, language: 'pascalish' }]
    const saveWorkspace = await jsonRequest(page, `/api/projects/${encodeURIComponent(projectId)}/workspace`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspace })
    })
    report.steps.push({ step: 'register mapper service metadata', ok: saveWorkspace.ok, status: saveWorkspace.status })

    const plan = {
      version: 1,
      projectId,
      status: 'ready',
      targets: [esp32Ip, jsPmachineTarget],
      resources: [{ kind: 'service', id: 'service.mt103-to-pacs008', file: `programs/${serviceFileName}` }],
      artifacts: [{ path: `programs/${serviceFileName}`, type: 'pascalish-source' }],
      environment: { inputQueue: 'swift.mt103.parsed', outputQueue: 'pacs.008.outbound' },
      rollout: { strategy: 'all-at-once', batchSize: 2, pauseBetweenBatchesMs: 0 },
      healthChecks: [{ type: 'pmachine-execute', inputQueue: 'swift.mt103.parsed' }],
      rollback: { enabled: true, strategy: 'previous-version' }
    }
    const savePlan = await jsonRequest(page, `/api/projects/${encodeURIComponent(projectId)}/deployment-plan`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plan })
    })
    report.steps.push({ step: 'save deployment plan', ok: savePlan.ok, status: savePlan.status })

    const deployFiles = [{ path: `/projects/${projectId}/programs/${serviceFileName}`, content: serviceSource }]
    const esp32Deploy = await jsonRequest(page, `/api/nodes/${encodeURIComponent(esp32Target)}/deploy`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        nodeId: esp32Target,
        ip: esp32Ip,
        serviceName: 'mt103-to-pacs008',
        packageName: `projects/${projectId}`,
        packageVersion: 'demo-1',
        metadata: { projectId, mapping: 'swift-mt103 -> pacs.008', source: 'playwright-demo' },
        files: deployFiles
      })
    })
    report.steps.push({ step: 'deploy to 192.168.2.155', ok: esp32Deploy.ok, status: esp32Deploy.status, response: esp32Deploy.data })

    const jsDeploy = await jsonRequest(page, '/api/pmachine/deployments', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        serviceName: 'mt103-to-pacs008',
        packageName: `projects/${projectId}`,
        packageVersion: 'demo-1',
        targetNodeIds: [jsPmachineTarget],
        workloadKind: 'service',
        runtimeKind: 'pmachine',
        autoStart: true,
        metadata: { projectId, mapping: 'swift-mt103 -> pacs.008', source: 'playwright-demo' }
      })
    })
    report.steps.push({ step: `deploy to ${jsPmachineTarget}`, ok: jsDeploy.ok, status: jsDeploy.status, response: jsDeploy.data })

    await page.screenshot({ path: 'demo-output/mt103-pacs008-project-tabs.png', fullPage: true })
    await fs.writeFile('demo-output/mt103-pacs008-playwright-report.json', `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify(report, null, 2))
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error.stack || String(error))
  process.exitCode = 1
})
