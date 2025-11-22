import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying FiatPaymentsAnchor contract...");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  // Deploy del contrato
  const FiatPaymentsAnchor = await ethers.getContractFactory("FiatPaymentsAnchor");
  const contract = await FiatPaymentsAnchor.deploy();

  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();

  console.log("✅ FiatPaymentsAnchor deployed to:", contractAddress);
  console.log("👤 Owner:", await contract.owner());
  console.log("📊 Total anchored:", await contract.totalAnchored());
  console.log("🔖 Version:", await contract.version());

  // Guardar dirección en archivo para el backend
  const fs = require("fs");
  const deploymentInfo = {
    contractAddress: contractAddress,
    network: "ganache",
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
  };

  fs.writeFileSync(
    "../src/config/contract-address.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n📄 Contract address saved to src/config/contract-address.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });