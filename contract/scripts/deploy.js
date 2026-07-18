const hre = require("hardhat");

// Arc Testnet ERC-20 USDC kontrat adresi (docs.arc.io/arc/references/contract-addresses'ten teyit edilmelidir)
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const arbiterAddress = process.env.ARBITER_ADDRESS || deployer.address;

  console.log("Deploy eden adres:", deployer.address);
  console.log("Hakem (arbiter) adresi:", arbiterAddress);
  console.log("USDC adresi:", ARC_TESTNET_USDC);

  const ArcEscrow = await hre.ethers.getContractFactory("ArcEscrow");
  const arcEscrow = await ArcEscrow.deploy(ARC_TESTNET_USDC, arbiterAddress);
  await arcEscrow.waitForDeployment();

  const address = await arcEscrow.getAddress();
  console.log("\nArcEscrow deploy edildi:", address);
  console.log("Explorer:", `https://testnet.arcscan.app/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
