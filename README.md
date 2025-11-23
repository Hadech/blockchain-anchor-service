# Blockchain Anchor Service

Microservicio en Node.js para anclar pagos FIAT en una blockchain EVM (Ganache en local) mediante un smart contract `FiatPaymentsAnchor`. Incluye:

- API REST con Express
- Persistencia en PostgreSQL
- Cola de jobs con Redis + BullMQ
- Smart contract en Solidity desplegado en Ganache
- Contenerización con Docker y docker-compose

---

## 1. Arquitectura General

Componentes principales:

- **Ganache**: nodo de blockchain local (EVM) para desarrollo.
- **Smart Contract** `FiatPaymentsAnchor.sol`: registra en cadena un hash de la transacción FIAT y metadatos.
- **Anchor Service (Node.js)**:
  - API HTTP con Express.
  - Lógica de anclaje a blockchain.
  - Gestión de pagos y registros de anclaje.
- **PostgreSQL**: base de datos relacional para pagos y registros de anclaje.
- **Redis + BullMQ**: colas de background para procesar anclajes.

---

## 2. Prerrequisitos

Asegúrate de tener instalado:

- **Node.js** v18+
- **npm** v9+
- **Docker** y **docker-compose** v2+

Verificación rápida:

```bash
node --version
npm --version
docker --version
docker-compose --version
```

---

## 3. Estructura del Proyecto

```text
blockchain-anchor-service/
├─ contracts/                # Proyecto Hardhat (Solidity)
│  ├─ contracts/
│  │  └─ FiatPaymentsAnchor.sol
│  ├─ scripts/
│  │  ├─ deploy.ts
│  │  └─ test-anchor.ts
│  ├─ test/
│  │  └─ FiatPaymentsAnchor.test.ts
│  ├─ hardhat.config.ts
│  └─ package.json
├─ src/
│  ├─ config/
│  │  ├─ index.ts            # Configuración general (env)
│  │  └─ database.ts         # Configuración TypeORM
│  ├─ controllers/
│  │  ├─ payment.controller.ts
│  │  ├─ verification.controller.ts
│  │  └─ health.controller.ts
│  ├─ models/
│  │  ├─ Payment.ts
│  │  ├─ AnchorRecord.ts
│  │  └─ index.ts
│  ├─ routes/
│  │  └─ index.ts
│  ├─ services/
│  │  ├─ canonicalizer.service.ts
│  │  ├─ blockchain.service.ts
│  │  └─ anchor.service.ts
│  ├─ utils/
│  │  └─ logger.ts
│  ├─ workers/
│  │  └─ anchor.worker.ts
│  ├─ app.ts
│  └─ server.ts
├─ docker-compose.yml
├─ Dockerfile
├─ package.json
├─ tsconfig.json
├─ .env.example
├─ .gitignore
└─ scripts/
   └─ init.sh
```

---

## 4. Smart Contract: `FiatPaymentsAnchor.sol`

Contrato sencillo que:

- Guarda un registro por cada pago FIAT anclado:
  - `paymentHash` (hash SHA-256 del payload canónico off-chain).
  - `offchainId` (ID público del pago en el sistema interno).
  - `amountMinorUnits` (monto en unidades mínimas, por ejemplo centavos).
  - `currency` (ej. `"COP"`, `"USD"`).
  - `executedAt` (timestamp de ejecución FIAT).
  - `anchoredAt`, `anchoredBy`.
- Evita duplicados (no permite anclar dos veces el mismo `paymentHash`).
- Expone un método de lectura `getAnchor(paymentHash)` y métricas como `totalAnchored()`.

Se despliega en Ganache usando Hardhat y un script de deploy (`contracts/scripts/deploy.ts`).

El script guarda la dirección del contrato en `src/config/contract-address.json` para que el backend pueda usarla.

---

## 5. Servicios Node.js

### 5.1. CanonicalizerService

Responsable de:

- Construir un **payload canónico** de los datos relevantes del pago:
  - `version`, `externalId`, `payerId`, `beneficiaryId`, `amountMinorUnits`, `currency`, `executedAt`, `bankReference`.
- Ordenar los campos alfabéticamente y serializar como JSON compacto.
- Calcular el hash SHA-256 del payload.
- Proveer una función de verificación (`verifyPayload`).

Esto garantiza que el mismo pago siempre genere el mismo hash, y que cualquier alteración off-chain sea detectable.

### 5.2. BlockchainService

Encapsula la interacción con el contrato en Ganache:

- Conexión vía `ethers.JsonRpcProvider` a `GANACHE_URL`.
- Uso de una wallet (clave privada) definida en `ANCHOR_PRIVATE_KEY`.
- Métodos clave:
  - `anchorPayment(paymentHash, offchainId, amount, currency, executedAt)`
    - Estima el gas necesario con `estimateGas`.
    - Agrega un 20% de margen de seguridad.
    - Envía la transacción al contrato `FiatPaymentsAnchor`.
  - `verifyAnchor(paymentHash)`
    - Llama a `getAnchor(paymentHash)` en el contrato.
  - `getBalance()` y `getContractInfo()` para diagnósticos.

### 5.3. AnchorService

Orquesta el flujo de anclaje de un pago FIAT:

1. Obtiene el pago en estado `COMPLETED` desde PostgreSQL.
2. Construye el `CanonicalPaymentData` y genera `canonicalPayload` + `paymentHash`.
3. Crea/actualiza un registro en `anchor_records` con estado `PENDING`.
4. Llama a `BlockchainService.anchorPayment(...)`.
5. Actualiza `anchor_records` con `txHash`, `blockNumber`, `anchoredAt` y estado `ANCHORED`.
6. Actualiza el pago a estado `ANCHORED`.
7. Maneja errores y reintentos (estado `FAILED` + `retryCount`).

### 5.4. Worker de BullMQ (`anchor.worker.ts`)

- Cola `anchor-payments` que recibe jobs con `{ paymentId }`.
- Worker que procesa cada job llamando a `AnchorService.processPaymentAnchor(paymentId)`.
- Configuración de reintentos exponenciales y límite de concurrencia.

### 5.5. Controllers y Rutas

- **PaymentController**

  - `POST /api/payments` → Crea un pago (estado `PENDING`).
  - `POST /api/payments/:id/complete` → Marca el pago como `COMPLETED` y lo encola para anclaje.
  - `GET /api/payments/:id` → Obtiene un pago.
  - `GET /api/payments` → Lista pagos recientes.

- **VerificationController**

  - `GET /api/verify/:externalId` → Verifica el anclaje de un pago, tanto off-chain como on-chain.

- **HealthController**
  - `GET /health` → Estado de DB y contrato en blockchain.

---

## 6. Base de Datos

Se usa **PostgreSQL** con **TypeORM** y dos entidades principales:

### 6.1. `Payment`

- `id` (UUID)
- `externalId` (string único, visible para clientes)
- `payerId` (ID interno)
- `beneficiaryId` (ID interno)
- `amountMinorUnits` (BIGINT)
- `currency` (3 letras)
- `status` (`PENDING`, `PROCESSING`, `COMPLETED`, `ANCHORED`, `FAILED`)
- `bankReference` (opcional)
- `executedAt` (timestamp)
- `createdAt`, `updatedAt`

### 6.2. `AnchorRecord`

- `id` (UUID)
- `paymentId` (FK a `Payment`)
- `canonicalPayload` (TEXT)
- `paymentHash` (string)
- `anchorStatus` (`PENDING`, `ANCHORED`, `FAILED`)
- `network` (ej. `ganache`)
- `txHash` (hash de la transacción en blockchain)
- `blockNumber`
- `anchoredAt`
- `retryCount`
- `lastError`
- `createdAt`, `updatedAt`

La sincronización del schema (en desarrollo) la hace TypeORM (`synchronize: true`).

---

## 7. Docker y docker-compose

### 7.1. Servicios definidos

En `docker-compose.yml` se definen:

- **ganache**

  - Imagen: `trufflesuite/ganache`
  - Puerto: `8545`
  - Preconfigurado con cuentas y fondos de prueba.

- **postgres**

  - Imagen: `postgres:15-alpine`
  - Puerto: `5432`
  - DB: `anchor_db`, usuario `postgres`, pass `postgres123` (para desarrollo).

- **redis**

  - Imagen: `redis:7-alpine`
  - Puerto: `6379`

- **anchor-service**
  - Construido desde el `Dockerfile` de Node.js.
  - Expone el puerto `3000`.
  - Depende de: `ganache`, `postgres`, `redis`.
  - Lee variables de entorno para DB, Redis y blockchain.

### 7.2. Dockerfile

- Basado en `node:18-alpine`.
- Copia `package*.json` y `contracts/package*.json`.
- Instala dependencias en raíz y en `contracts/`.
- Copia el resto del código.
- Compila TypeScript (`npm run build`).
- Comando por defecto: `npm start`.

---

## 8. Variables de Entorno

Ejemplo de `.env` (ver también `.env.example`):

```bash
NODE_ENV=development
PORT=3000

DB_HOST=postgres
DB_PORT=5432
DB_NAME=anchor_db
DB_USER=postgres
DB_PASSWORD=postgres123

REDIS_HOST=redis
REDIS_PORT=6379

GANACHE_URL=http://ganache:8545
CONTRACT_ADDRESS=0x...
ANCHOR_PRIVATE_KEY=0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d

LOG_LEVEL=info
```

> **Importante:** `CONTRACT_ADDRESS` se actualiza automáticamente al desplegar el contrato con el script de deploy (ver siguiente sección).

---

## 9. Scripts NPM Clave

En `package.json`:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "nodemon --watch src --ext ts --exec ts-node src/server.ts",
    "test": "cd contracts && npx hardhat test",
    "deploy:local": "cd contracts && npx hardhat run scripts/deploy.ts --network localhost",
    "compile": "cd contracts && npx hardhat compile"
  }
}
```

---

## 10. Script de Inicialización Rápida

El archivo `scripts/init.sh` automatiza:

1. Levantar `ganache`, `postgres` y `redis` con docker-compose.
2. Compilar los contratos con Hardhat.
3. Desplegar el contrato `FiatPaymentsAnchor` en Ganache (`localhost`).
4. Guardar la dirección del contrato en `src/config/contract-address.json`.
5. Actualizar la variable `CONTRACT_ADDRESS` en `.env`.
6. Levantar el servicio `anchor-service` con docker-compose.

Uso:

```bash
chmod +x scripts/init.sh
./scripts/init.sh
```

Al finalizar, tendrás:

- API en: `http://localhost:3000`
- Ganache RPC en: `http://localhost:8545`

---

## 11. Endpoints de la API

### 11.1. Health Check

```http
GET /health
```

Respuesta de ejemplo:

```json
{
  "status": "ok",
  "timestamp": "2025-11-22T10:00:00.000Z",
  "database": "connected",
  "blockchain": {
    "address": "0x...",
    "owner": "0x...",
    "totalAnchored": 5,
    "version": "1.0.0"
  }
}
```

---

### 11.2. Crear un Pago

```http
POST /api/payments
Content-Type: application/json

{
  "externalId": "PAY-2025-000001",
  "payerId": "customer_123",
  "beneficiaryId": "vendor_456",
  "amountMinorUnits": 150000000,
  "currency": "COP"
}
```

Respuesta de ejemplo:

```json
{
  "success": true,
  "data": {
    "id": "79f09ad2-6622-4245-99cf-b7f16fd8cabd",
    "externalId": "PAY-2025-000001",
    "payerId": "customer_123",
    "beneficiaryId": "vendor_456",
    "amountMinorUnits": 150000000,
    "currency": "COP",
    "status": "PENDING",
    "createdAt": "2025-11-22T15:40:00.000Z",
    "updatedAt": "2025-11-22T15:40:00.000Z"
  }
}
```

---

### 11.3. Completar un Pago (Disparar Anclaje)

```http
POST /api/payments/:id/complete
Content-Type: application/json

{
  "bankReference": "SPEI-ABC123XYZ"
}
```

Al completarse:

- Cambia estado del pago a `COMPLETED`.
- Encola un job en `anchor-payments`.
- El worker procesa el job y ancla el pago en el contrato.

Respuesta de ejemplo:

```json
{
  "success": true,
  "data": {
    "id": "79f09ad2-6622-4245-99cf-b7f16fd8cabd",
    "status": "COMPLETED",
    "bankReference": "SPEI-ABC123XYZ",
    "executedAt": "2025-11-22T15:41:00.000Z"
  },
  "message": "Payment completed and enqueued for blockchain anchoring"
}
```

---

### 11.4. Ver un Pago

```http
GET /api/payments/:id
```

Incluye, si existe, el `anchorRecord` asociado.

---

### 11.5. Listar Pagos

```http
GET /api/payments
```

Lista los últimos pagos (hasta 50) con su estado y anclaje.

---

### 11.6. Verificar un Pago por `externalId`

```http
GET /api/verify/:externalId
```

Ejemplo:

```http
GET /api/verify/PAY-2025-000001
```

Respuesta de ejemplo:

```json
{
  "success": true,
  "data": {
    "found": true,
    "payment": {
      "externalId": "PAY-2025-000001",
      "status": "ANCHORED",
      "amount": 150000000,
      "currency": "COP",
      "executedAt": "2025-11-22T15:41:00.000Z"
    },
    "anchor": {
      "status": "ANCHORED",
      "paymentHash": "0x...",
      "txHash": "0x...",
      "blockNumber": 1446,
      "anchoredAt": "2025-11-22T15:41:24.000Z",
      "network": "ganache"
    },
    "verification": {
      "localHashValid": true,
      "onChainConfirmed": true,
      "onChainRecord": {
        "paymentHash": "0x...",
        "offchainId": "PAY-2025-000001",
        "amountMinorUnits": "150000000",
        "currency": "COP",
        "executedAt": 1700667684,
        "anchoredAt": 1700667686,
        "anchoredBy": "0x..."
      }
    }
  }
}
```

---

## 12. Flujo Completo de Uso

1. **Levantar infraestructura y servicio**

   ```bash
    chmod +x ./init.sh && ./init.sh
   ```

   ```bash
    ./scripts/init.sh
   ```

2. **Crear un pago** (`PENDING`)

   ```bash
   curl -X POST http://localhost:3000/api/payments      -H "Content-Type: application/json"      -d '{
       "externalId": "PAY-2025-000001",
       "payerId": "customer_123",
       "beneficiaryId": "vendor_456",
       "amountMinorUnits": 150000000,
       "currency": "COP"
     }'
   ```

3. **Completar el pago** (`COMPLETED` → se encola para anclaje)

   ```bash
   curl -X POST http://localhost:3000/api/payments/<ID_DEVUELTO>/complete      -H "Content-Type: application/json"      -d '{ "bankReference": "SPEI-ABC123XYZ" }'
   ```

4. **El worker procesa el job**

   - Genera `canonicalPayload` + `paymentHash`.
   - Llama al contrato `FiatPaymentsAnchor` en Ganache.
   - Actualiza `anchor_records` y el estado del pago a `ANCHORED`.

5. **Verificar el pago por `externalId`**

   ```bash
   curl http://localhost:3000/api/verify/PAY-2025-000001
   ```

---

## 13. Comandos Útiles

```bash
# Ver estado de los contenedores
docker-compose ps

# Ver logs del servicio principal
docker-compose logs -f anchor-service

# Ver logs de Ganache
docker-compose logs -f ganache

# Ver logs de PostgreSQL
docker-compose logs -f postgres

# Ver logs de Redis
docker-compose logs -f redis

# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes (reset completo)
docker-compose down -v

# Volver a construir la imagen del servicio
docker-compose build anchor-service

# Reiniciar solo el servicio de anclaje
docker-compose restart anchor-service
```

---

## 14. Troubleshooting Común

### Error: `transaction execution reverted (out of gas)`

- Causa: el `gasLimit` configurado era demasiado bajo.
- Solución implementada:
  - Usar `estimateGas` en `BlockchainService.anchorPayment`.
  - Agregar un margen de seguridad del 20% sobre el gas estimado.

### Error de conexión a PostgreSQL

- Verificar logs:

  ```bash
  docker-compose logs postgres
  ```

- Asegurarse de que el servicio `anchor-service` se levante **después** de que PostgreSQL esté `healthy` (configurado en `docker-compose.yml`).

### Worker no procesa jobs

- Verificar Redis:

  ```bash
  docker exec -it redis redis-cli ping
  ```

- Ver claves de BullMQ:

  ```bash
  docker exec -it redis redis-cli
  KEYS bull:anchor-payments:*
  ```

- Reiniciar servicio:

  ```bash
  docker-compose restart anchor-service
  ```

---

## 15. Próximos Pasos / Mejores Prácticas

- Agregar **autenticación y autorización** (API keys, JWT).
- Implementar **rate limiting** y protección contra abuso.
- Separar el worker en un contenedor propio si se requiere escalar.
- Añadir tests de integración end-to-end (API + DB + blockchain).
- Extender el contrato para soportar:
  - Anclaje por lotes.
  - Roles más finos (multi-owner, multisig).
- Preparar despliegue en una red pública (Polygon, Base, etc.) cambiando el provider y las cuentas.

---

## 16. Resumen

Este microservicio implementa un **patrón de anclaje blockchain para pagos FIAT**:

- Los pagos se ejecutan en el mundo FIAT (bancos, SPEI, ACH, etc.).
- El detalle del pago se convierte en un **payload canónico** y se hashea.
- Ese hash se **registra en blockchain** mediante un contrato sencillo.
- Cualquier parte interesada puede:
  - Verificar que los datos off-chain no han sido modificados.
  - Comprobar en blockchain que ese pago fue registrado en un momento y bloque específicos.

Es una base sólida para un sistema de dispersión de pagos FIAT con **trazabilidad, auditabilidad e inmutabilidad** gracias a la tecnología blockchain.
