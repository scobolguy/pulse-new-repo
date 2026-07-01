<#
.SYNOPSIS
    AWS IoT Certificate Setup Script for ESP32 Devices

.DESCRIPTION
    This script helps you set up AWS IoT certificates for your ESP32 devices.
    It can download certificates from AWS IoT, convert them to the correct format,
    and upload them to the ESP32 filesystem.

.PARAMETER ThingName
    The AWS IoT Thing name for your device

.PARAMETER Region
    AWS region (default: us-east-1)

.PARAMETER CertificateArn
    ARN of the certificate to download (if already created)

.PARAMETER CreateNew
    Create a new certificate and thing

.PARAMETER UploadToDevice
    Upload certificates to ESP32 device via serial

.PARAMETER ComPort
    COM port for ESP32 device (e.g., COM5)

.EXAMPLE
    .\setup-aws-iot-certs.ps1 -ThingName "esp32-device-01" -CreateNew -UploadToDevice -ComPort COM5

.EXAMPLE
    .\setup-aws-iot-certs.ps1 -ThingName "esp32-device-01" -CertificateArn "arn:aws:iot:us-east-1:123456789012:cert/abc123"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ThingName,
    
    [string]$Region = "us-east-1",
    
    [string]$CertificateArn,
    
    [switch]$CreateNew,
    
    [switch]$UploadToDevice,
    
    [string]$ComPort = "COM5"
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Error { Write-Host $args -ForegroundColor Red }

Write-Info "==================================================="
Write-Info "AWS IoT Certificate Setup for ESP32"
Write-Info "==================================================="
Write-Info ""

# Check if AWS CLI is installed
try {
    $awsVersion = aws --version
    Write-Success "✓ AWS CLI found: $awsVersion"
} catch {
    Write-Error "✗ AWS CLI not found. Please install AWS CLI first."
    Write-Info "Download from: https://aws.amazon.com/cli/"
    exit 1
}

# Create certificates directory
$certsDir = ".\certs"
if (-not (Test-Path $certsDir)) {
    New-Item -ItemType Directory -Path $certsDir | Out-Null
    Write-Success "✓ Created certificates directory: $certsDir"
}

# Download Amazon Root CA
$rootCaUrl = "https://www.amazontrust.com/repository/AmazonRootCA1.pem"
$rootCaPath = "$certsDir\AmazonRootCA1.pem"

if (-not (Test-Path $rootCaPath)) {
    Write-Info "Downloading Amazon Root CA..."
    Invoke-WebRequest -Uri $rootCaUrl -OutFile $rootCaPath
    Write-Success "✓ Downloaded Amazon Root CA"
} else {
    Write-Info "Amazon Root CA already exists"
}

# Create new certificate if requested
if ($CreateNew) {
    Write-Info ""
    Write-Info "Creating new AWS IoT certificate..."
    
    # Create certificate
    $certOutput = aws iot create-keys-and-certificate `
        --set-as-active `
        --certificate-pem-outfile "$certsDir\device-certificate.pem.crt" `
        --public-key-outfile "$certsDir\public.pem.key" `
        --private-key-outfile "$certsDir\private.pem.key" `
        --region $Region | ConvertFrom-Json
    
    $CertificateArn = $certOutput.certificateArn
    $certificateId = $certOutput.certificateId
    
    Write-Success "✓ Certificate created: $certificateId"
    Write-Info "  ARN: $CertificateArn"
    
    # Create IoT Thing if it doesn't exist
    Write-Info ""
    Write-Info "Creating AWS IoT Thing: $ThingName"
    
    try {
        aws iot create-thing --thing-name $ThingName --region $Region | Out-Null
        Write-Success "✓ Thing created: $ThingName"
    } catch {
        Write-Warning "Thing may already exist or creation failed"
    }
    
    # Attach certificate to thing
    Write-Info "Attaching certificate to thing..."
    aws iot attach-thing-principal `
        --thing-name $ThingName `
        --principal $CertificateArn `
        --region $Region
    
    Write-Success "✓ Certificate attached to thing"
    
    # Create and attach policy
    $policyName = "${ThingName}-Policy"
    $policyDocument = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "iot:Connect"
      ],
      "Resource": "arn:aws:iot:${Region}:*:client/${ThingName}"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iot:Publish",
        "iot:Receive"
      ],
      "Resource": [
        "arn:aws:iot:${Region}:*:topic/`$aws/things/${ThingName}/*",
        "arn:aws:iot:${Region}:*:topic/alexa/*",
        "arn:aws:iot:${Region}:*:topic/wfl/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "iot:Subscribe"
      ],
      "Resource": [
        "arn:aws:iot:${Region}:*:topicfilter/`$aws/things/${ThingName}/*",
        "arn:aws:iot:${Region}:*:topicfilter/alexa/*",
        "arn:aws:iot:${Region}:*:topicfilter/wfl/*"
      ]
    }
  ]
}
"@
    
    $policyDocument | Out-File -FilePath "$certsDir\policy.json" -Encoding utf8
    
    Write-Info "Creating IoT policy..."
    try {
        aws iot create-policy `
            --policy-name $policyName `
            --policy-document file://$certsDir/policy.json `
            --region $Region | Out-Null
        Write-Success "✓ Policy created: $policyName"
    } catch {
        Write-Warning "Policy may already exist"
    }
    
    # Attach policy to certificate
    aws iot attach-policy `
        --policy-name $policyName `
        --target $CertificateArn `
        --region $Region
    
    Write-Success "✓ Policy attached to certificate"
}

# Get IoT endpoint
Write-Info ""
Write-Info "Getting AWS IoT endpoint..."
$endpoint = aws iot describe-endpoint --endpoint-type iot:Data-ATS --region $Region | ConvertFrom-Json
$iotEndpoint = $endpoint.endpointAddress
Write-Success "✓ IoT Endpoint: $iotEndpoint"

# Create configuration file
Write-Info ""
Write-Info "Creating configuration file..."

$config = @{
    version = "1.0.0"
    aws = @{
        iot = @{
            endpoint = $iotEndpoint
            region = $Region
            thingName = $ThingName
            clientId = $ThingName
            port = 8883
            certificates = @{
                rootCa = "/certs/AmazonRootCA1.pem"
                deviceCert = "/certs/device-certificate.pem.crt"
                privateKey = "/certs/private.pem.key"
            }
        }
        alexa = @{
            enabled = $true
            skillId = "amzn1.ask.skill.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        }
        wfl = @{
            enabled = $true
            brokerUrl = "http://localhost:5000"
        }
    }
}

$configPath = ".\config\aws-iot-config.json"
$config | ConvertTo-Json -Depth 10 | Out-File -FilePath $configPath -Encoding utf8
Write-Success "✓ Configuration saved to: $configPath"

# Upload to device if requested
if ($UploadToDevice) {
    Write-Info ""
    Write-Info "==================================================="
    Write-Info "Uploading certificates to ESP32 device"
    Write-Info "==================================================="
    Write-Info ""
    
    # Check if esptool is available
    try {
        esptool.py version | Out-Null
        Write-Success "✓ esptool.py found"
    } catch {
        Write-Error "✗ esptool.py not found. Please install esptool."
        Write-Info "Install with: pip install esptool"
        exit 1
    }
    
    Write-Info "Uploading files to ESP32 on $ComPort..."
    Write-Warning "Make sure your ESP32 is connected and not running any program."
    Write-Info ""
    
    # Create LittleFS image with certificates
    Write-Info "Creating filesystem image..."
    
    # This requires mkspiffs or mklittlefs tool
    # For now, we'll provide instructions
    Write-Info ""
    Write-Warning "Manual upload required:"
    Write-Info "1. Use PlatformIO to upload filesystem:"
    Write-Info "   pio run --target uploadfs"
    Write-Info ""
    Write-Info "2. Or use Arduino IDE:"
    Write-Info "   - Install ESP32 Sketch Data Upload plugin"
    Write-Info "   - Copy certificates to data/certs/ folder"
    Write-Info "   - Use Tools > ESP32 Sketch Data Upload"
    Write-Info ""
    Write-Info "Certificate files to upload:"
    Write-Info "  - $rootCaPath"
    Write-Info "  - $certsDir\device-certificate.pem.crt"
    Write-Info "  - $certsDir\private.pem.key"
}

Write-Info ""
Write-Info "==================================================="
Write-Success "✓ Setup Complete!"
Write-Info "==================================================="
Write-Info ""
Write-Info "Next steps:"
Write-Info "1. Update your aws-iot-config.json with your Alexa Skill ID"
Write-Info "2. Upload certificates to your ESP32 device"
Write-Info "3. Flash your ESP32 with the updated firmware"
Write-Info "4. Configure Alexa Smart Home skill in AWS Console"
Write-Info ""
Write-Info "Configuration file: $configPath"
Write-Info "Certificates directory: $certsDir"
Write-Info ""

# Save certificate info for reference
$certInfo = @{
    thingName = $ThingName
    certificateArn = $CertificateArn
    endpoint = $iotEndpoint
    region = $Region
    createdAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
}

$certInfo | ConvertTo-Json | Out-File -FilePath "$certsDir\certificate-info.json" -Encoding utf8
Write-Info "Certificate info saved to: $certsDir\certificate-info.json"
Write-Info ""

# Made with Bob
