import { expect } from "chai";
import { ethers } from "hardhat";
import { FiatPaymentsAnchor } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("FiatPaymentsAnchor", function () {
  let contract: FiatPaymentsAnchor;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();

    const FiatPaymentsAnchor = await ethers.getContractFactory("FiatPaymentsAnchor");
    contract = await FiatPaymentsAnchor.deploy();
    await contract.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("Should initialize totalAnchored to 0", async function () {
      expect(await contract.totalAnchored()).to.equal(0);
    });

    it("Should return correct version", async function () {
      expect(await contract.version()).to.equal("1.0.0");
    });
  });

  describe("Anchoring Payments", function () {
    it("Should anchor a payment successfully", async function () {
      const paymentHash = ethers.keccak256(ethers.toUtf8Bytes("test-payment-1"));
      const offchainId = "PAY-2025-000001";
      const amount = 150000000n; // 1,500,000.00 en centavos
      const currency = "COP";
      const executedAt = Math.floor(Date.now() / 1000);

      await expect(
        contract.anchorPayment(paymentHash, offchainId, amount, currency, executedAt)
      )
        .to.emit(contract, "PaymentAnchored")
        .withArgs(
          paymentHash,
          offchainId,
          amount,
          currency,
          executedAt,
          owner.address,
          await ethers.provider.getBlock("latest").then((b) => b!.timestamp + 1)
        );

      expect(await contract.totalAnchored()).to.equal(1);
    });

    it("Should not allow duplicate anchors", async function () {
      const paymentHash = ethers.keccak256(ethers.toUtf8Bytes("test-payment-2"));
      const offchainId = "PAY-2025-000002";
      const amount = 100000n;
      const currency = "USD";
      const executedAt = Math.floor(Date.now() / 1000);

      await contract.anchorPayment(paymentHash, offchainId, amount, currency, executedAt);

      await expect(
        contract.anchorPayment(paymentHash, offchainId, amount, currency, executedAt)
      ).to.be.revertedWith("Payment already anchored");
    });

    it("Should not allow non-owner to anchor", async function () {
      const paymentHash = ethers.keccak256(ethers.toUtf8Bytes("test-payment-3"));
      const offchainId = "PAY-2025-000003";
      const amount = 100000n;
      const currency = "MXN";
      const executedAt = Math.floor(Date.now() / 1000);

      await expect(
        contract.connect(addr1).anchorPayment(paymentHash, offchainId, amount, currency, executedAt)
      ).to.be.revertedWith("Not authorized");
    });
  });

  describe("Verification", function () {
    it("Should retrieve anchored payment", async function () {
      const paymentHash = ethers.keccak256(ethers.toUtf8Bytes("test-payment-4"));
      const offchainId = "PAY-2025-000004";
      const amount = 250000n;
      const currency = "COP";
      const executedAt = Math.floor(Date.now() / 1000);

      await contract.anchorPayment(paymentHash, offchainId, amount, currency, executedAt);

      const [exists, record] = await contract.getAnchor(paymentHash);

      expect(exists).to.be.true;
      expect(record.offchainId).to.equal(offchainId);
      expect(record.amountMinorUnits).to.equal(amount);
      expect(record.currency).to.equal(currency);
    });

    it("Should return false for non-existent payment", async function () {
      const paymentHash = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));
      const [exists] = await contract.getAnchor(paymentHash);
      expect(exists).to.be.false;
    });
  });
});