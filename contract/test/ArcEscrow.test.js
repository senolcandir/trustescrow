const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("ArcEscrow", function () {
  let arcEscrow, usdc;
  let owner, seller, buyer, arbiter, stranger;
  const AMOUNT = ethers.parseUnits("350", 6); // 350 USDC (6 decimal)

  beforeEach(async function () {
    [owner, seller, buyer, arbiter, stranger] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const ArcEscrow = await ethers.getContractFactory("ArcEscrow");
    arcEscrow = await ArcEscrow.deploy(await usdc.getAddress(), arbiter.address);
    await arcEscrow.waitForDeployment();

    // Aliciya USDC gonder ve escrow kontratina allowance ver
    await usdc.mint(buyer.address, AMOUNT * 10n);
    await usdc.connect(buyer).approve(await arcEscrow.getAddress(), AMOUNT * 10n);
  });

  async function createAndLock() {
    await arcEscrow.connect(seller).createEscrow(buyer.address, AMOUNT);
    const id = 1n;
    await arcEscrow.connect(buyer).pay(id);
    return id;
  }

  describe("createEscrow", function () {
    it("satici escrow olusturabilir ve Created durumunda baslar", async function () {
      await expect(arcEscrow.connect(seller).createEscrow(buyer.address, AMOUNT))
        .to.emit(arcEscrow, "EscrowCreated")
        .withArgs(1n, seller.address, buyer.address, AMOUNT);

      const escrow = await arcEscrow.getEscrow(1n);
      expect(escrow.state).to.equal(0n); // Created
      expect(escrow.seller).to.equal(seller.address);
      expect(escrow.buyer).to.equal(buyer.address);
    });

    it("satici kendini alici olarak gosteremez", async function () {
      await expect(
        arcEscrow.connect(seller).createEscrow(seller.address, AMOUNT)
      ).to.be.revertedWith("ArcEscrow: alici ve satici ayni olamaz");
    });

    it("sifir tutarla escrow olusturulamaz", async function () {
      await expect(
        arcEscrow.connect(seller).createEscrow(buyer.address, 0)
      ).to.be.revertedWith("ArcEscrow: tutar sifir olamaz");
    });

    it("gecersiz (sifir) alici adresiyle olusturulamaz", async function () {
      await expect(
        arcEscrow.connect(seller).createEscrow(ethers.ZeroAddress, AMOUNT)
      ).to.be.revertedWith("ArcEscrow: gecersiz alici adresi");
    });
  });

  describe("cancelEscrow", function () {
    it("satici odeme oncesi iptal edebilir", async function () {
      await arcEscrow.connect(seller).createEscrow(buyer.address, AMOUNT);
      await expect(arcEscrow.connect(seller).cancelEscrow(1n))
        .to.emit(arcEscrow, "Cancelled")
        .withArgs(1n);

      const escrow = await arcEscrow.getEscrow(1n);
      expect(escrow.state).to.equal(1n); // Cancelled
    });

    it("baskasi iptal edemez", async function () {
      await arcEscrow.connect(seller).createEscrow(buyer.address, AMOUNT);
      await expect(arcEscrow.connect(buyer).cancelEscrow(1n)).to.be.revertedWith(
        "ArcEscrow: sadece satici"
      );
    });

    it("odeme kilitlendikten sonra iptal edilemez", async function () {
      const id = await createAndLock();
      await expect(arcEscrow.connect(seller).cancelEscrow(id)).to.be.revertedWith(
        "ArcEscrow: gecersiz durum"
      );
    });
  });

  describe("pay", function () {
    it("alici odeme yapinca fon kontrata kilitlenir ve Locked durumuna gecer", async function () {
      await arcEscrow.connect(seller).createEscrow(buyer.address, AMOUNT);

      const beforeBalance = await usdc.balanceOf(await arcEscrow.getAddress());
      await expect(arcEscrow.connect(buyer).pay(1n))
        .to.emit(arcEscrow, "FundsLocked")
        .withArgs(1n, AMOUNT);
      const afterBalance = await usdc.balanceOf(await arcEscrow.getAddress());

      expect(afterBalance - beforeBalance).to.equal(AMOUNT);
      const escrow = await arcEscrow.getEscrow(1n);
      expect(escrow.state).to.equal(2n); // Locked
      expect(escrow.lockedAt).to.be.greaterThan(0n);
    });

    it("sadece belirlenen alici odeme yapabilir", async function () {
      await arcEscrow.connect(seller).createEscrow(buyer.address, AMOUNT);
      await expect(arcEscrow.connect(stranger).pay(1n)).to.be.revertedWith(
        "ArcEscrow: sadece alici"
      );
    });

    it("allowance yetersizse islem basarisiz olur", async function () {
      await arcEscrow.connect(seller).createEscrow(buyer.address, AMOUNT);
      await usdc.connect(buyer).approve(await arcEscrow.getAddress(), 0);
      await expect(arcEscrow.connect(buyer).pay(1n)).to.be.reverted;
    });
  });

  describe("markShipped", function () {
    it("satici kargoladigini bildirebilir", async function () {
      const id = await createAndLock();
      await expect(
        arcEscrow.connect(seller).markShipped(id, "TRK123456", "Aras Kargo")
      )
        .to.emit(arcEscrow, "ShipmentMarked")
        .withArgs(id, "TRK123456", "Aras Kargo");

      const escrow = await arcEscrow.getEscrow(id);
      expect(escrow.state).to.equal(3n); // Shipped
      expect(escrow.trackingNumber).to.equal("TRK123456");
    });

    it("takip numarasi bos olamaz", async function () {
      const id = await createAndLock();
      await expect(
        arcEscrow.connect(seller).markShipped(id, "", "Aras Kargo")
      ).to.be.revertedWith("ArcEscrow: takip numarasi gerekli");
    });

    it("Locked disinda bir durumda cagrilamaz", async function () {
      await arcEscrow.connect(seller).createEscrow(buyer.address, AMOUNT);
      await expect(
        arcEscrow.connect(seller).markShipped(1n, "TRK1", "Kargo")
      ).to.be.revertedWith("ArcEscrow: gecersiz durum");
    });
  });

  describe("confirmReceived", function () {
    it("alici onaylayinca fon saticiya gider", async function () {
      const id = await createAndLock();
      await arcEscrow.connect(seller).markShipped(id, "TRK1", "Kargo");

      const beforeBalance = await usdc.balanceOf(seller.address);
      await expect(arcEscrow.connect(buyer).confirmReceived(id))
        .to.emit(arcEscrow, "FundsReleased")
        .withArgs(id, seller.address, AMOUNT, "buyer_confirmed");
      const afterBalance = await usdc.balanceOf(seller.address);

      expect(afterBalance - beforeBalance).to.equal(AMOUNT);
      const escrow = await arcEscrow.getEscrow(id);
      expect(escrow.state).to.equal(5n); // Completed
    });

    it("sadece alici onaylayabilir", async function () {
      const id = await createAndLock();
      await arcEscrow.connect(seller).markShipped(id, "TRK1", "Kargo");
      await expect(arcEscrow.connect(stranger).confirmReceived(id)).to.be.revertedWith(
        "ArcEscrow: sadece alici"
      );
    });
  });

  describe("autoRelease", function () {
    it("14 gun sonra dispute yoksa herkes tetikleyebilir, fon saticiya gider", async function () {
      const id = await createAndLock();
      await arcEscrow.connect(seller).markShipped(id, "TRK1", "Kargo");

      await time.increase(14 * 24 * 60 * 60 + 1);

      const beforeBalance = await usdc.balanceOf(seller.address);
      await expect(arcEscrow.connect(stranger).autoRelease(id))
        .to.emit(arcEscrow, "FundsReleased")
        .withArgs(id, seller.address, AMOUNT, "auto_release");
      const afterBalance = await usdc.balanceOf(seller.address);

      expect(afterBalance - beforeBalance).to.equal(AMOUNT);
    });

    it("sure dolmadan tetiklenemez", async function () {
      const id = await createAndLock();
      await arcEscrow.connect(seller).markShipped(id, "TRK1", "Kargo");

      await time.increase(5 * 24 * 60 * 60);

      await expect(arcEscrow.autoRelease(id)).to.be.revertedWith(
        "ArcEscrow: sure henuz dolmadi"
      );
    });

    it("dispute acildiysa autoRelease calismaz", async function () {
      const id = await createAndLock();
      await arcEscrow.connect(seller).markShipped(id, "TRK1", "Kargo");
      await arcEscrow.connect(buyer).openDispute(id, "ipfs://kanit");

      await time.increase(14 * 24 * 60 * 60 + 1);

      await expect(arcEscrow.autoRelease(id)).to.be.revertedWith(
        "ArcEscrow: gecersiz durum"
      );
    });
  });

  describe("refundIfNotShipped", function () {
    it("satici 7 gun icinde kargolamazsa alici iade alabilir", async function () {
      const id = await createAndLock();

      await time.increase(7 * 24 * 60 * 60 + 1);

      const beforeBalance = await usdc.balanceOf(buyer.address);
      await expect(arcEscrow.connect(buyer).refundIfNotShipped(id))
        .to.emit(arcEscrow, "RefundedNotShipped")
        .withArgs(id);
      const afterBalance = await usdc.balanceOf(buyer.address);

      expect(afterBalance - beforeBalance).to.equal(AMOUNT);
      const escrow = await arcEscrow.getEscrow(id);
      expect(escrow.state).to.equal(6n); // Refunded
    });

    it("sure dolmadan iade edilemez", async function () {
      const id = await createAndLock();
      await expect(arcEscrow.connect(buyer).refundIfNotShipped(id)).to.be.revertedWith(
        "ArcEscrow: iade suresi henuz dolmadi"
      );
    });
  });

  describe("openDispute", function () {
    it("alici Locked durumundayken dispute acabilir (satici kargolamadi/kayboldu)", async function () {
      const id = await createAndLock();
      await expect(arcEscrow.connect(buyer).openDispute(id, "ipfs://kanit1"))
        .to.emit(arcEscrow, "DisputeOpened")
        .withArgs(id, buyer.address, "ipfs://kanit1");

      const escrow = await arcEscrow.getEscrow(id);
      expect(escrow.state).to.equal(4n); // Disputed
    });

    it("alici Shipped durumundayken de dispute acabilir (hasarli/yanlis urun)", async function () {
      const id = await createAndLock();
      await arcEscrow.connect(seller).markShipped(id, "TRK1", "Kargo");
      await expect(arcEscrow.connect(buyer).openDispute(id, "ipfs://hasarli-foto"))
        .to.emit(arcEscrow, "DisputeOpened");
    });

    it("sadece alici dispute acabilir", async function () {
      const id = await createAndLock();
      await expect(
        arcEscrow.connect(seller).openDispute(id, "ipfs://x")
      ).to.be.revertedWith("ArcEscrow: sadece alici");
    });

    it("Created durumunda dispute acilamaz", async function () {
      await arcEscrow.connect(seller).createEscrow(buyer.address, AMOUNT);
      await expect(
        arcEscrow.connect(buyer).openDispute(1n, "ipfs://x")
      ).to.be.revertedWith("ArcEscrow: gecersiz durum");
    });
  });

  describe("resolveDispute", function () {
    it("hakem tum tutari saticiya verebilir", async function () {
      const id = await createAndLock();
      await arcEscrow.connect(seller).markShipped(id, "TRK1", "Kargo");
      await arcEscrow.connect(buyer).openDispute(id, "ipfs://kanit");

      const sellerBefore = await usdc.balanceOf(seller.address);
      await expect(arcEscrow.connect(arbiter).resolveDispute(id, 0, AMOUNT))
        .to.emit(arcEscrow, "DisputeResolved")
        .withArgs(id, 0, AMOUNT);
      const sellerAfter = await usdc.balanceOf(seller.address);

      expect(sellerAfter - sellerBefore).to.equal(AMOUNT);
    });

    it("hakem kismi (50/50) cozum uygulayabilir", async function () {
      const id = await createAndLock();
      await arcEscrow.connect(seller).markShipped(id, "TRK1", "Kargo");
      await arcEscrow.connect(buyer).openDispute(id, "ipfs://kanit");

      const half = AMOUNT / 2n;
      const buyerBefore = await usdc.balanceOf(buyer.address);
      const sellerBefore = await usdc.balanceOf(seller.address);

      await arcEscrow.connect(arbiter).resolveDispute(id, half, AMOUNT - half);

      const buyerAfter = await usdc.balanceOf(buyer.address);
      const sellerAfter = await usdc.balanceOf(seller.address);

      expect(buyerAfter - buyerBefore).to.equal(half);
      expect(sellerAfter - sellerBefore).to.equal(AMOUNT - half);
    });

    it("tutarlar toplami escrow miktarina esit olmali", async function () {
      const id = await createAndLock();
      await arcEscrow.connect(seller).markShipped(id, "TRK1", "Kargo");
      await arcEscrow.connect(buyer).openDispute(id, "ipfs://kanit");

      await expect(
        arcEscrow.connect(arbiter).resolveDispute(id, AMOUNT, AMOUNT)
      ).to.be.revertedWith("ArcEscrow: tutarlar escrow miktarina esit olmali");
    });

    it("sadece hakem cozebilir", async function () {
      const id = await createAndLock();
      await arcEscrow.connect(seller).markShipped(id, "TRK1", "Kargo");
      await arcEscrow.connect(buyer).openDispute(id, "ipfs://kanit");

      await expect(
        arcEscrow.connect(stranger).resolveDispute(id, 0, AMOUNT)
      ).to.be.revertedWith("ArcEscrow: sadece hakem");
    });
  });

  describe("pause / unpause", function () {
    it("owner durdurunca createEscrow calismaz", async function () {
      await arcEscrow.connect(owner).pause();

      await expect(
        arcEscrow.connect(seller).createEscrow(buyer.address, AMOUNT)
      ).to.be.revertedWithCustomError(arcEscrow, "EnforcedPause");
    });

    it("owner disinda kimse pause yapamaz", async function () {
      await expect(arcEscrow.connect(stranger).pause()).to.be.revertedWithCustomError(
        arcEscrow,
        "OwnableUnauthorizedAccount"
      );
    });

    it("unpause sonrasi islemler tekrar calisir", async function () {
      await arcEscrow.connect(owner).pause();
      await arcEscrow.connect(owner).unpause();
      await expect(arcEscrow.connect(seller).createEscrow(buyer.address, AMOUNT)).to.not
        .be.reverted;
    });
  });

  describe("setArbiter", function () {
    it("owner hakemi degistirebilir", async function () {
      await expect(arcEscrow.connect(owner).setArbiter(stranger.address))
        .to.emit(arcEscrow, "ArbiterUpdated")
        .withArgs(stranger.address);
      expect(await arcEscrow.arbiter()).to.equal(stranger.address);
    });

    it("owner disinda kimse hakemi degistiremez", async function () {
      await expect(
        arcEscrow.connect(stranger).setArbiter(stranger.address)
      ).to.be.revertedWithCustomError(arcEscrow, "OwnableUnauthorizedAccount");
    });
  });
});
