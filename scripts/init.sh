#!/bin/bash

echo "🚀 Inicializando Blockchain Anchor Service..."

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Paso 1: Levantar servicios
echo -e "${BLUE}📦 Levantando servicios Docker...${NC}"
docker-compose up -d ganache postgres redis

# Esperar a que los servicios estén listos
echo -e "${YELLOW}⏳ Esperando a que los servicios estén listos...${NC}"
sleep 10

# Paso 2: Compilar contratos
echo -e "${BLUE}🔨 Compilando smart contracts...${NC}"
cd contracts
npm run compile
cd ..

# Paso 3: Desplegar contrato
echo -e "${BLUE}🚀 Desplegando contrato en Ganache...${NC}"
cd contracts
npx hardhat run scripts/deploy.ts --network localhost
cd ..

# Paso 4: Leer dirección del contrato
if [ -f "src/config/contract-address.json" ]; then
    CONTRACT_ADDRESS=$(cat src/config/contract-address.json | grep -o '"contractAddress": "[^"]*' | grep -o '[^"]*$')
    echo -e "${GREEN}✅ Contrato desplegado en: ${CONTRACT_ADDRESS}${NC}"
    
    # Actualizar .env
    if grep -q "CONTRACT_ADDRESS=" .env; then
        sed -i.bak "s|CONTRACT_ADDRESS=.*|CONTRACT_ADDRESS=${CONTRACT_ADDRESS}|" .env
    else
        echo "CONTRACT_ADDRESS=${CONTRACT_ADDRESS}" >> .env
    fi
    
    echo -e "${GREEN}✅ Archivo .env actualizado${NC}"
else
    echo -e "${YELLOW}⚠️  No se encontró el archivo de dirección del contrato${NC}"
fi

# Paso 5: Levantar servicio
echo -e "${BLUE}🚀 Levantando Anchor Service...${NC}"
docker-compose up -d anchor-service

echo -e "${GREEN}✅ Inicialización completa!${NC}"
echo -e "${BLUE}📝 Servicios disponibles:${NC}"
echo -e "  - API: http://localhost:3000"
echo -e "  - Ganache RPC: http://localhost:8545"
echo -e "  - PostgreSQL: localhost:5432"
echo -e "  - Redis: localhost:6379"
echo ""
echo -e "${BLUE}📊 Ver logs:${NC}"
echo -e "  docker-compose logs -f anchor-service"