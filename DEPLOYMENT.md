# GitHub Actions Deployment Setup

This guide explains how to set up automatic deployment to your Windows server using GitHub Actions with Git pull approach.

## Prerequisites

1. **GitHub Repository** - Your project must be in a GitHub repository
2. **Windows Server** - Access to your Windows server with:
   - SSH enabled (OpenSSH Server)
   - Git installed
   - Node.js installed
   - PowerShell available
3. **Network Access** - GitHub Actions must be able to reach your server

## GitHub Secrets Configuration

You need to add the following secrets to your GitHub repository:

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add:

### Required Secrets:

- **WINDOWS_SERVER_HOST**: Your Windows server IP address or hostname
- **WINDOWS_SERVER_USER**: SSH username for the Windows server
- **WINDOWS_SERVER_PASSWORD**: SSH password for the Windows server
- **WINDOWS_SERVER_PORT**: SSH port (default: 22)
- **WINDOWS_DEPLOY_PATH**: Deployment path on Windows server (default: `C:\smart-garden`)

### Example Values:
```
WINDOWS_SERVER_HOST: 192.168.1.100
WINDOWS_SERVER_USER: administrator
WINDOWS_SERVER_PASSWORD: your_secure_password
WINDOWS_SERVER_PORT: 22
WINDOWS_DEPLOY_PATH: C:\smart-garden
```

## Windows Server Setup

### 1. Enable OpenSSH Server on Windows

```powershell
# Install OpenSSH Server
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0

# Start SSH service
Start-Service sshd

# Set SSH service to start automatically
Set-Service -Name sshd -StartupType 'Automatic'

# Configure firewall to allow SSH
New-NetFirewallRule -Name sshd -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
```

### 2. Install Git on Windows

Download and install Git from https://git-scm.com/download/win or use:

```powershell
# Using Chocolatey (if available)
choco install git

# Or download manually and install
```

### 3. Create Deployment Directory

```powershell
# Create deployment directory
New-Item -Path "C:\smart-garden" -ItemType Directory -Force

# Create logs directory
New-Item -Path "C:\smart-garden\logs" -ItemType Directory -Force

# Create data directory
New-Item -Path "C:\smart-garden\data" -ItemType Directory -Force
```

### 4. Install Node.js (if not already installed)

Download and install Node.js from https://nodejs.org/ or use:

```powershell
# Using Chocolatey (if available)
choco install nodejs

# Or download manually and install
```

### 5. Configure .env File

Copy your `.env` file to the server:

```powershell
# Create .env file on server
# Copy your existing .env content or create a new one
```

### 6. Initial Git Setup (First Time Only)

```powershell
cd C:\smart-garden

# Clone your repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .

# Or if you prefer SSH (requires SSH key setup)
git clone git@github.com:YOUR_USERNAME/YOUR_REPO.git .
```

## Deployment Workflow

The GitHub Actions workflow will:

1. **On push to main/master branch:**
   - Checkout the latest code
   - Install dependencies
   - Run tests (if available)
   - Connect to Windows server via SSH
   - Stop existing Node.js process
   - Backup current version
   - Pull latest changes from GitHub
   - Install production dependencies
   - Initialize database if needed
   - Start the application

2. **Manual trigger:**
   - You can also trigger deployment manually from GitHub Actions tab

## Monitoring Deployment

1. Go to **Actions** tab in your GitHub repository
2. Click on the **Deploy to Windows Server** workflow
3. View real-time deployment logs
4. Check for any errors or warnings

## Troubleshooting

### SSH Connection Issues

```powershell
# Test SSH connection from your local machine
ssh username@server_ip

# Check if SSH service is running on Windows server
Get-Service sshd

# Check firewall rules
Get-NetFirewallRule -Name sshd
```

### Git Issues

```powershell
# Check Git is installed
git --version

# Configure Git credentials (if needed)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Test Git connection
git ls-remote https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

### Permission Issues

Ensure the SSH user has:
- Write permissions to deployment directory
- Permissions to run Node.js processes
- Permissions to modify firewall rules (if needed)

### Application Won't Start

```powershell
# Check Node.js is installed
node --version

# Check if port 3000 is available
netstat -ano | findstr :3000

# Manually test application
cd C:\smart-garden
node app.js
```

## Security Best Practices

1. **Use SSH Keys** (recommended instead of password):
   - Generate SSH key pair
   - Add public key to Windows server
   - Use private key in GitHub secrets

2. **Limit SSH Access:**
   - Use firewall rules to restrict SSH access
   - Consider using a VPN for additional security

3. **Regular Updates:**
   - Keep Node.js and dependencies updated
   - Regular security patches for Windows

4. **Monitor Logs:**
   - Regularly check application logs
   - Monitor for unusual activity

## Advanced Configuration

### Using SSH Keys Instead of Passwords

1. Generate SSH key pair:
```bash
ssh-keygen -t rsa -b 4096 -C "github-actions"
```

2. Add public key to Windows server:
```powershell
# Add to authorized_keys
$authorizedKeys = "C:\ProgramData\ssh\administrators_authorized_keys"
Add-Content -Path $authorizedKeys -Value "YOUR_PUBLIC_KEY"
icacls.exe $authorizedKeys /inheritance:r /grant "Administrators:F"
```

3. Update GitHub workflow to use SSH key:
```yaml
- name: Deploy via SSH
  uses: appleboy/ssh-action@v1.0.0
  with:
    host: ${{ secrets.WINDOWS_SERVER_HOST }}
    username: ${{ secrets.WINDOWS_SERVER_USER }}
    key: ${{ secrets.WINDOWS_SSH_PRIVATE_KEY }}
    port: ${{ secrets.WINDOWS_SERVER_PORT }}
    script: |
      # Your deployment script
```

### Using GitHub Personal Access Token

If your repository is private, you may need to authenticate Git:

```powershell
cd C:\smart-garden

# Set up Git credential helper
git config --global credential.helper store

# Or use personal access token in URL
git clone https://TOKEN@github.com/YOUR_USERNAME/YOUR_REPO.git
```

### Environment-Specific Deployments

Create separate workflows for different environments:
- `deploy-staging.yml` for staging
- `deploy-production.yml` for production

Use different secrets for each environment.

## Rollback Procedure

If deployment fails:

```powershell
cd C:\smart-garden

# Find latest backup
$latestBackup = Get-ChildItem -Filter "backup_*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

# Extract backup
Expand-Archive -Path $latestBackup.FullName -DestinationPath . -Force

# Restart application
taskkill /F /IM node.exe 2>$null
Start-Process node -ArgumentList "app.js" -NoNewWindow
```

Or use Git to revert:

```powershell
cd C:\smart-garden

# View recent commits
git log --oneline -10

# Revert to previous commit
git checkout PREVIOUS_COMMIT_HASH

# Restart application
taskkill /F /IM node.exe 2>$null
Start-Process node -ArgumentList "app.js" -NoNewWindow
```

## Support

For issues with:
- **GitHub Actions**: Check GitHub Actions documentation
- **SSH on Windows**: Microsoft OpenSSH documentation
- **Git on Windows**: Git for Windows documentation
- **Node.js on Windows**: Node.js Windows installation guide
