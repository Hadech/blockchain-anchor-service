// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FiatPaymentsAnchor
 * @dev Contrato para anclar pagos FIAT en blockchain
 */
contract FiatPaymentsAnchor {
    address public owner;
    uint256 public totalAnchored;

    struct AnchorRecord {
        bytes32 paymentHash;
        string offchainId;
        uint256 amountMinorUnits;
        string currency;
        uint256 executedAt;
        uint256 anchoredAt;
        address anchoredBy;
        bool exists;
    }

    // Mapping de hash a registro
    mapping(bytes32 => AnchorRecord) public anchors;

    event PaymentAnchored(
        bytes32 indexed paymentHash,
        string offchainId,
        uint256 amountMinorUnits,
        string currency,
        uint256 executedAt,
        address indexed anchoredBy,
        uint256 anchoredAt
    );

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
        totalAnchored = 0;
    }

    /**
     * @dev Ancla un pago FIAT en la blockchain
     * @param paymentHash Hash SHA-256 del payload canónico
     * @param offchainId ID público del pago en el sistema off-chain
     * @param amountMinorUnits Monto en unidades mínimas (centavos)
     * @param currency Código de moneda (ISO 4217)
     * @param executedAt Timestamp Unix de ejecución del pago FIAT
     */
    function anchorPayment(
        bytes32 paymentHash,
        string calldata offchainId,
        uint256 amountMinorUnits,
        string calldata currency,
        uint256 executedAt
    ) external onlyOwner {
        require(paymentHash != bytes32(0), "Invalid payment hash");
        require(bytes(offchainId).length > 0, "Invalid offchain ID");
        require(amountMinorUnits > 0, "Amount must be greater than 0");
        require(bytes(currency).length == 3, "Invalid currency code");
        require(executedAt > 0, "Invalid execution timestamp");
        require(!anchors[paymentHash].exists, "Payment already anchored");

        anchors[paymentHash] = AnchorRecord({
            paymentHash: paymentHash,
            offchainId: offchainId,
            amountMinorUnits: amountMinorUnits,
            currency: currency,
            executedAt: executedAt,
            anchoredAt: block.timestamp,
            anchoredBy: msg.sender,
            exists: true
        });

        totalAnchored++;

        emit PaymentAnchored(
            paymentHash,
            offchainId,
            amountMinorUnits,
            currency,
            executedAt,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @dev Verifica si un pago está anclado
     * @param paymentHash Hash del pago a verificar
     * @return exists Si el pago existe
     * @return record Datos del registro
     */
    function getAnchor(bytes32 paymentHash)
        external
        view
        returns (bool exists, AnchorRecord memory record)
    {
        return (anchors[paymentHash].exists, anchors[paymentHash]);
    }

    /**
     * @dev Transfiere la propiedad del contrato
     * @param newOwner Nueva dirección propietaria
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /**
     * @dev Retorna la versión del contrato
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
}