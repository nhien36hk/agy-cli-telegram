#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Define colors for professional output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "    ___                   ______     __"
echo "   /   | ____ ___  __    /_  __/__  / /__  ____ __________ _____ ___ "
echo "  / /| |/ __ \`/ / / /_____/ / / _ \\/ / _ \\/ __ \`/ ___/ __ \`/ __ \`__ \\"
echo " / ___ / /_/ / /_/ /_____/ / /  __/ /  __/ /_/ / /  / /_/ / / / / / /"
echo "/_/  |_\\__, /\\__, /     /_/  \\___/_/\\___/\\__, /_/   \\__,_/_/ /_/ /_/ "
echo "      /____//____/                      /____/                       "
echo -e "${NC}"
echo -e "${BLUE}⚡ Starting installation of Telegram Antigravity Bridge (telegram-agy)...${NC}\n"

# 1. Checking system requirements (Prerequisites)
echo -e "${YELLOW}🔍 Checking environment...${NC}"

SUDO=""
SUDO_E=""
if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo &> /dev/null; then
        SUDO="sudo"
        SUDO_E="sudo -E"
    else
        echo -e "${RED}❌ Error: You need to run as root or install 'sudo' to continue.${NC}"
        exit 1
    fi
fi

if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️ Node.js not found. Proceeding with automatic installation...${NC}"
    
    if command -v apt-get &> /dev/null; then
        echo -e "${BLUE}▶ Installing Node.js via apt-get (Debian/Ubuntu)...${NC}"
        export DEBIAN_FRONTEND=noninteractive
        if (true < /dev/tty) 2>/dev/null; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO_E bash -
            $SUDO apt-get install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" nodejs < /dev/tty
        else
            curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO_E bash -
            $SUDO apt-get install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" nodejs
        fi
    elif command -v yum &> /dev/null; then
        echo -e "${BLUE}▶ Installing Node.js via yum (CentOS/RHEL)... (May require sudo password)${NC}"
        if (true < /dev/tty) 2>/dev/null; then
            curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO_E bash -
            $SUDO yum install -y nodejs < /dev/tty
        else
            curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO_E bash -
            $SUDO yum install -y nodejs
        fi
    elif command -v pacman &> /dev/null; then
        echo -e "${BLUE}▶ Installing Node.js via pacman (Arch Linux)... (May require sudo password)${NC}"
        if (true < /dev/tty) 2>/dev/null; then
            $SUDO pacman -S --noconfirm nodejs npm < /dev/tty
        else
            $SUDO pacman -S --noconfirm nodejs npm
        fi
    elif command -v brew &> /dev/null; then
        echo -e "${BLUE}▶ Installing Node.js via Homebrew (macOS)...${NC}"
        brew install node
    else
        echo -e "${RED}❌ Cannot automatically install Node.js on this OS. Please install Node.js (>= v18) manually first.${NC}"
        exit 1
    fi

    # Double check after installation
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Error: Node.js installation failed. Please install manually and try again.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Node.js installed successfully! ($(node -v))${NC}"
fi

if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️ pm2 not found. Proceeding with automatic installation...${NC}"
    # If npm global directory is owned by root, we need sudo
    if [ -w "$(npm config get prefix)/lib/node_modules" ] || [ -w "$(npm config get prefix)/lib" ] || [ -w "$(npm config get prefix)" ]; then
        npm install -g pm2
    else
        echo -e "${BLUE}▶ Sudo privilege required to install pm2 globally...${NC}"
        if (true < /dev/tty) 2>/dev/null; then
            $SUDO npm install -g pm2 < /dev/tty
        else
            $SUDO npm install -g pm2
        fi
    fi
    
    if command -v pm2 &> /dev/null; then
        echo -e "${GREEN}✅ pm2 installed successfully!${NC}"
    else
        echo -e "${RED}❌ Error: pm2 installation failed.${NC}"
    fi
fi

if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Error: Git not found. Please install Git first.${NC}"
    exit 1
fi

if ! command -v agy &> /dev/null; then
    echo -e "${YELLOW}⚠️ Warning: 'agy' (Antigravity CLI) not found in PATH.${NC}"
    echo -e "${YELLOW}   The bot will still be installed, but you must ensure 'agy' can run for the bot to work!${NC}"
fi
echo -e "${GREEN}✅ Environment is ready.${NC}\n"

# 2. Download source code to standard directory
INSTALL_DIR="$HOME/.telegram-agy"

if [ -d "$INSTALL_DIR" ]; then
    echo -e "${BLUE}🔄 Found existing installation at $INSTALL_DIR. Updating source code...${NC}"
    cd "$INSTALL_DIR"
    # Temporarily reset old code (careful not to delete config)
    git fetch --all
    git reset --hard origin/main
else
    echo -e "${BLUE}📦 Downloading source code from GitHub to $INSTALL_DIR...${NC}"
    git clone https://github.com/nhien36hk/agy-cli-telegram.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# 3. Install Node.js dependencies
echo -e "\n${BLUE}⚙️  Installing dependencies (NPM)...${NC}"
npm install --silent

if [ -z "$SKIP_CONFIG" ]; then
    echo -e "\n${CYAN}====================================================${NC}"
    echo -e "${CYAN}   ⚙️  BOT CONFIGURATION SETUP  ${NC}"
    echo -e "${CYAN}====================================================${NC}"
    # Call Node.js setup script. Redirect /dev/tty so Inquirer.js can receive keypresses
    if (true < /dev/tty) 2>/dev/null; then
        npm run setup < /dev/tty
    else
        npm run setup
    fi
fi

# 4. Linking global command
echo -e "\n${BLUE}🔗 Linking global command...${NC}"
npm link

# 5. Complete
echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN} 🎉 INSTALLATION SUCCESSFUL!${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "You can now start the bot from anywhere on your computer using command:\n"
echo -e "   ${CYAN}agy-tele${NC}\n"
echo -e "💡 Tip: Use pm2 if you want to run the bot in the background 24/7 (e.g., pm2 start agy-tele)"
