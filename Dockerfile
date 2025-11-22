FROM node:24-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY contracts/package*.json ./contracts/

# Instalar dependencias
RUN npm install
RUN cd contracts && npm install

# Copiar código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

# Exponer puerto
EXPOSE 3000

# Comando por defecto
CMD ["npm", "start"]