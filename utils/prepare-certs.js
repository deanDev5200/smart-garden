/**
 * Script untuk mempersiapkan sertifikat CA untuk MQTT SSL/TLS
 * Jalankan dengan: node utils/prepare-certs.js atau npm run prepare-certs
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');

console.log('🔐 Smart Garden IoT - MQTT Certificate Preparation');
console.log('=' .repeat(55));

// Path sertifikat CA
const certPath = process.env.MQTT_CA_FILE || 'data/certs/isrgrootx1.pem';
const certDir = path.dirname(certPath);

// URL untuk mengunduh sertifikat ISRG Root X1 (untuk HiveMQ Cloud)
const isrgRootX1Url = 'https://letsencrypt.org/certs/isrgrootx1.pem';

console.log(`📁 Certificate directory: ${certDir}`);
console.log(`📄 Certificate file: ${certPath}`);

// Memastikan direktori untuk sertifikat ada
console.log(`\n🔍 Checking certificate directory...`);
if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, {
        recursive: true
    });
    console.log(`✓ Directory ${certDir} created`);
} else {
    console.log(`✓ Directory ${certDir} already exists`);
}

// Mengunduh sertifikat jika belum ada
console.log(`\n🔍 Checking certificate file...`);
if (!fs.existsSync(certPath)) {
    console.log(`⬇️  Downloading ISRG Root X1 certificate...`);
    console.log(`   Source: ${isrgRootX1Url}`);

    const file = fs.createWriteStream(certPath);

    https.get(isrgRootX1Url, function (response) {
        if (response.statusCode !== 200) {
            console.error(`❌ Failed to download certificate: HTTP ${response.statusCode}`);
            file.close();
            fs.unlink(certPath, () => {});
            return;
        }

        response.pipe(file);

        file.on('finish', function () {
            file.close();
            console.log(`✓ Certificate downloaded and saved to ${certPath}`);
            
            // Verify certificate file
            try {
                const certContent = fs.readFileSync(certPath, 'utf8');
                if (certContent.includes('BEGIN CERTIFICATE') && certContent.includes('END CERTIFICATE')) {
                    console.log(`✓ Certificate file appears to be valid`);
                } else {
                    console.warn(`⚠️  Certificate file may be invalid`);
                }
            } catch (err) {
                console.error(`❌ Error reading certificate file: ${err.message}`);
            }

            showUsageInfo();
        });
    }).on('error', function (err) {
        fs.unlink(certPath, () => {});
        console.error(`❌ Error downloading certificate: ${err.message}`);
        console.log('\n💡 Alternative options:');
        console.log('1. Download certificate manually from https://letsencrypt.org/certs/isrgrootx1.pem');
        console.log(`2. Save it to: ${certPath}`);
        console.log('3. Or use MQTT without SSL by setting MQTT_USE_SSL=false in .env');
    });
} else {
    console.log(`✓ Certificate file already exists`);
    
    // Verify existing certificate
    try {
        const certContent = fs.readFileSync(certPath, 'utf8');
        if (certContent.includes('BEGIN CERTIFICATE') && certContent.includes('END CERTIFICATE')) {
            console.log(`✓ Existing certificate appears to be valid`);
        } else {
            console.warn(`⚠️  Existing certificate may be invalid`);
        }
    } catch (err) {
        console.error(`❌ Error reading existing certificate: ${err.message}`);
    }

    showUsageInfo();
}

function showUsageInfo() {
    console.log('\n📋 MQTT SSL/TLS Configuration:');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│ Environment Variables for .env file:                   │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ MQTT_USE_SSL=true                                       │');
    console.log(`│ MQTT_CA_FILE=${certPath.padEnd(30)} │`);
    console.log('│ MQTT_HOST=your-hivemq-cluster.hivemq.cloud             │');
    console.log('│ MQTT_PORT=8883                                          │');
    console.log('│ MQTT_USERNAME=your_username                             │');
    console.log('│ MQTT_PASSWORD=your_password                             │');
    console.log('└─────────────────────────────────────────────────────────┘');

    console.log('\n🌐 Supported MQTT Brokers:');
    console.log('• HiveMQ Cloud (recommended)');
    console.log('• Any MQTT broker with Let\'s Encrypt SSL certificates');
    console.log('• AWS IoT Core (requires different certificate)');
    console.log('• Azure IoT Hub (requires different certificate)');

    console.log('\n🎯 For Smart Garden IoT Dashboard:');
    console.log('• This certificate enables secure MQTT communication');
    console.log('• Required for HiveMQ Cloud connections');
    console.log('• Ensures sensor data transmission is encrypted');
    console.log('• Protects valve control commands from interception');

    console.log('\n✨ Certificate preparation complete!');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Certificate preparation interrupted');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n👋 Certificate preparation terminated');
    process.exit(0);
});