# Get node installed / updated
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc

# Install version v20.x.x and set active
nvm install 20
nvm use 20

# install npm
sudo apt install npm

# load module vscode with support for 1.70+
npm install --save-dev @types/vscode@=1.70.0
