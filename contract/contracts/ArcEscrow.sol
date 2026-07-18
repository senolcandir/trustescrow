// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title ArcEscrow
/// @notice Arc Testnet uzerinde calisan, merkeziyetsiz alici/satici anlasmalarini
///         guvenli USDC odemesi ile destekleyen escrow platformu.
/// @dev Platform urun/ilan barindirmaz. Sadece odeme guvenceyi saglar.
///      Alici ve satici karsi tarafi baska bir platformda (Sahibinden, Telegram, vb.) bulur.
contract ArcEscrow is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    /// @notice Escrow'un yasam donguesu boyunca gecebilecegi durumlar
    enum State {
        Created,    // 0 - Satici olusturdu, odeme bekleniyor
        Cancelled,  // 1 - Odeme kilitlenmeden satici iptal etti
        Locked,     // 2 - USDC kontratta kilitli, kargo bekleniyor
        Shipped,    // 3 - Satici kargoya verdiğini bildirdi
        Disputed,   // 4 - Itiraz acildi, hakem karari bekleniyor
        Completed,  // 5 - Fon saticiya gitti (onay veya auto-release ile)
        Refunded,   // 6 - Satici kargolamadigi icin fon aliciya iade edildi
        Resolved    // 7 - Hakem itirazi cozdu, fon(lar) dagitildi
    }

    struct Escrow {
        address seller;
        address buyer;
        uint256 amount;
        State state;
        string trackingNumber;
        string carrier;
        string evidenceURI;      // dispute kaniti (foto/aciklama linki)
        uint256 lockedAt;        // pay() cagrildigi an
        uint256 shippedAt;       // markShipped() cagrildigi an
        uint256 disputeOpenedAt; // openDispute() cagrildigi an
    }

    /// @notice Odeme icin kullanilan tek token. Arc Testnet ERC-20 USDC adresi.
    IERC20 public immutable USDC;

    /// @notice Hakem (dispute cozucu). v1'de tek adres, ileride cok-imzali/DAO olabilir.
    address public arbiter;

    /// @notice Satici kargoladigini bildirdikten sonra, dispute yoksa fonun
    ///         otomatik olarak saticiya serbest birakilacagi sure.
    uint256 public constant AUTO_RELEASE_TIMEOUT = 14 days;

    /// @notice Odeme kilitlendikten sonra satici kargolamazsa alicinin
    ///         iade talep edebilecegi sure.
    uint256 public constant SHIP_TIMEOUT = 7 days;

    uint256 private _nextEscrowId = 1;
    mapping(uint256 => Escrow) public escrows;

    event EscrowCreated(uint256 indexed id, address indexed seller, address indexed buyer, uint256 amount);
    event Cancelled(uint256 indexed id);
    event FundsLocked(uint256 indexed id, uint256 amount);
    event ShipmentMarked(uint256 indexed id, string trackingNumber, string carrier);
    event DisputeOpened(uint256 indexed id, address indexed openedBy, string evidenceURI);
    event DisputeResolved(uint256 indexed id, uint256 buyerAmount, uint256 sellerAmount);
    event FundsReleased(uint256 indexed id, address indexed to, uint256 amount, string reason);
    event RefundedNotShipped(uint256 indexed id);
    event ArbiterUpdated(address indexed newArbiter);

    modifier onlySeller(uint256 id) {
        require(msg.sender == escrows[id].seller, "ArcEscrow: sadece satici");
        _;
    }

    modifier onlyBuyer(uint256 id) {
        require(msg.sender == escrows[id].buyer, "ArcEscrow: sadece alici");
        _;
    }

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "ArcEscrow: sadece hakem");
        _;
    }

    modifier inState(uint256 id, State expected) {
        require(escrows[id].state == expected, "ArcEscrow: gecersiz durum");
        _;
    }

    constructor(address usdcAddress, address arbiterAddress) Ownable(msg.sender) {
        require(usdcAddress != address(0), "ArcEscrow: gecersiz USDC adresi");
        require(arbiterAddress != address(0), "ArcEscrow: gecersiz hakem adresi");
        USDC = IERC20(usdcAddress);
        arbiter = arbiterAddress;
    }

    // ---------------------------------------------------------------------
    // Satici akisi
    // ---------------------------------------------------------------------

    /// @notice Satici, alici cuzdan adresini ve tutari belirterek yeni bir escrow olusturur.
    function createEscrow(address buyer, uint256 amount) external whenNotPaused returns (uint256 id) {
        require(buyer != address(0), "ArcEscrow: gecersiz alici adresi");
        require(buyer != msg.sender, "ArcEscrow: alici ve satici ayni olamaz");
        require(amount > 0, "ArcEscrow: tutar sifir olamaz");

        id = _nextEscrowId++;
        Escrow storage e = escrows[id];
        e.seller = msg.sender;
        e.buyer = buyer;
        e.amount = amount;
        e.state = State.Created;

        emit EscrowCreated(id, msg.sender, buyer, amount);
    }

    /// @notice Odeme kilitlenmeden once satici escrow'u iptal edebilir.
    function cancelEscrow(uint256 id) external onlySeller(id) inState(id, State.Created) {
        escrows[id].state = State.Cancelled;
        emit Cancelled(id);
    }

    /// @notice Satici, urunu kargoladigini bildirir. Takip bilgisi zorunludur;
    ///         kontrat dogrulayamaz ama hakem dispute sirasinda bu bilgiye bakar.
    function markShipped(uint256 id, string calldata trackingNumber, string calldata carrier)
        external
        onlySeller(id)
        inState(id, State.Locked)
        whenNotPaused
    {
        require(bytes(trackingNumber).length > 0, "ArcEscrow: takip numarasi gerekli");

        Escrow storage e = escrows[id];
        e.trackingNumber = trackingNumber;
        e.carrier = carrier;
        e.shippedAt = block.timestamp;
        e.state = State.Shipped;

        emit ShipmentMarked(id, trackingNumber, carrier);
    }

    // ---------------------------------------------------------------------
    // Alici akisi
    // ---------------------------------------------------------------------

    /// @notice Alici, escrow tutari kadar USDC'yi kontrata kilitler.
    /// @dev Alici oncesinde bu kontrata en az `amount` kadar allowance vermis olmalidir.
    function pay(uint256 id) external nonReentrant onlyBuyer(id) inState(id, State.Created) whenNotPaused {
        Escrow storage e = escrows[id];

        // Effects once
        e.state = State.Locked;
        e.lockedAt = block.timestamp;

        // Interaction sonra
        USDC.safeTransferFrom(msg.sender, address(this), e.amount);

        emit FundsLocked(id, e.amount);
    }

    /// @notice Alici, urunu teslim aldigini onaylar. Fon saticiya gonderilir.
    function confirmReceived(uint256 id) external nonReentrant onlyBuyer(id) inState(id, State.Shipped) {
        _release(id, escrows[id].seller, "buyer_confirmed");
    }

    /// @notice Satici SHIP_TIMEOUT suresi icinde kargolamazsa, alici odemeyi geri alabilir.
    function refundIfNotShipped(uint256 id) external nonReentrant onlyBuyer(id) inState(id, State.Locked) {
        Escrow storage e = escrows[id];
        require(block.timestamp >= e.lockedAt + SHIP_TIMEOUT, "ArcEscrow: iade suresi henuz dolmadi");

        e.state = State.Refunded;
        USDC.safeTransfer(e.buyer, e.amount);

        emit RefundedNotShipped(id);
    }

    /// @notice Alici, hem Locked (satici kargolamadi/kayboldu) hem de Shipped
    ///         (kargo sahte/hasarli) asamasinda itiraz acabilir.
    function openDispute(uint256 id, string calldata evidenceURI) external {
        Escrow storage e = escrows[id];
        require(msg.sender == e.buyer, "ArcEscrow: sadece alici");
        require(e.state == State.Locked || e.state == State.Shipped, "ArcEscrow: gecersiz durum");

        e.state = State.Disputed;
        e.evidenceURI = evidenceURI;
        e.disputeOpenedAt = block.timestamp;

        emit DisputeOpened(id, msg.sender, evidenceURI);
    }

    // ---------------------------------------------------------------------
    // Permissionless (herkes tetikleyebilir)
    // ---------------------------------------------------------------------

    /// @notice Kargolamadan sonra AUTO_RELEASE_TIMEOUT gecti ve dispute acilmadiysa
    ///         fon otomatik olarak saticiya serbest birakilir. Herkes tetikleyebilir
    ///         (ornegin bir keeper/cron script).
    function autoRelease(uint256 id) external nonReentrant inState(id, State.Shipped) {
        Escrow storage e = escrows[id];
        require(block.timestamp >= e.shippedAt + AUTO_RELEASE_TIMEOUT, "ArcEscrow: sure henuz dolmadi");

        _release(id, e.seller, "auto_release");
    }

    // ---------------------------------------------------------------------
    // Hakem
    // ---------------------------------------------------------------------

    /// @notice Hakem, itirazi kismi ya da tam olarak cozer.
    /// @param buyerAmount Aliciya iade edilecek tutar
    /// @param sellerAmount Saticiya odenecek tutar
    function resolveDispute(uint256 id, uint256 buyerAmount, uint256 sellerAmount)
        external
        nonReentrant
        onlyArbiter
        inState(id, State.Disputed)
    {
        Escrow storage e = escrows[id];
        require(buyerAmount + sellerAmount == e.amount, "ArcEscrow: tutarlar escrow miktarina esit olmali");

        e.state = State.Resolved;

        if (buyerAmount > 0) {
            USDC.safeTransfer(e.buyer, buyerAmount);
        }
        if (sellerAmount > 0) {
            USDC.safeTransfer(e.seller, sellerAmount);
        }

        emit DisputeResolved(id, buyerAmount, sellerAmount);
    }

    /// @notice Hakem adresini gunceller. v2'de cok-imzali/DAO adresine tasima icin kullanilabilir.
    function setArbiter(address newArbiter) external onlyOwner {
        require(newArbiter != address(0), "ArcEscrow: gecersiz hakem adresi");
        arbiter = newArbiter;
        emit ArbiterUpdated(newArbiter);
    }

    /// @notice Acil durumda tum yeni islemleri durdurur (mevcut fonlari etkilemez).
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ---------------------------------------------------------------------
    // Goruntuleme yardimcilari
    // ---------------------------------------------------------------------

    function getEscrow(uint256 id) external view returns (Escrow memory) {
        return escrows[id];
    }

    function nextEscrowId() external view returns (uint256) {
        return _nextEscrowId;
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _release(uint256 id, address to, string memory reason) internal {
        Escrow storage e = escrows[id];
        uint256 amount = e.amount;

        // Effects once
        e.state = State.Completed;

        // Interaction sonra
        USDC.safeTransfer(to, amount);

        emit FundsReleased(id, to, amount, reason);
    }
}
