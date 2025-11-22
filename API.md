# API Documentation

## Base URL
http://localhost:3000

## Endpoints

### Health Check
```http
GET /health HTTP/1.1
```
**Response:**
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
### Create Payment
```http
POST /api/payments HTTP/1.1
Content-Type: application/json
```
**Request Body:**
```json
{
  "externalId": "PAY-2025-000001",
  "payerId": "customer_123",
  "beneficiaryId": "vendor_456",
  "amountMinorUnits": 150000000,
  "currency": "COP"
}
```