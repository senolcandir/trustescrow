# Arc Escrow

Merkeziyetsiz, alıcı-satıcıyı buluşturmayan, **sadece güvenli USDC ödeme (escrow) hizmeti** sunan platform. Arc Testnet üzerinde çalışır.

> Platform ürün satmaz, ilan yayınlamaz, alıcı/satıcıyı bir araya getirmez. Kullanıcılar başka bir yerde (Sahibinden, Telegram, Discord, X vb.) anlaşır, buraya sadece **güvenli ödeme** için gelir.

## İçindekiler

- `contracts/ArcEscrow.sol` — Ana escrow kontratı
- `contracts/mocks/MockUSDC.sol` — Sadece testler için sahte USDC (Arc'a deploy edilmez)
- `test/ArcEscrow.test.js` — 33 test, tüm durum geçişlerini ve güvenlik kontrollerini kapsar
- `scripts/deploy.js` — Arc Testnet'e deploy scripti

## Durum Makinesi

```
Created ──cancel──► Cancelled
   │
   │ pay()
   ▼
Locked ──refundIfNotShipped (7 gün)──► Refunded
   │  │
   │  └──openDispute──► Disputed ──resolveDispute (hakem)──► Resolved
   │
   │ markShipped()
   ▼
Shipped ──confirmReceived──► Completed
   │  │
   │  ├──autoRelease (14 gün, itiraz yoksa)──► Completed
   │  │
   │  └──openDispute──► Disputed ──resolveDispute (hakem)──► Resolved
```

## Roller

| Rol | Açıklama |
|---|---|
| **Seller** | Escrow'u oluşturur, kargoyu bildirir |
| **Buyer** | Ödemeyi kilitler, teslim alımı onaylar veya itiraz açar |
| **Arbiter (Hakem)** | Sadece itiraz durumunda devreye girer, tam veya kısmi (örn. %50/%50) çözüm uygular |

## Güvenlik Önlemleri

- **Checks-Effects-Interactions**: Her fonksiyonda önce durum değişir, sonra token transferi yapılır.
- **ReentrancyGuard**: Fon hareketi olan tüm fonksiyonlarda `nonReentrant`.
- **Immutable USDC adresi**: Kontrat sadece belirlenen tek token'ı kabul eder, deploy sonrası değiştirilemez.
- **Pausable**: Acil durumda `owner` yeni işlemleri durdurabilir (mevcut kilitli fonları etkilemez).
- **Sıkı erişim kontrolü**: Her fonksiyon `onlySeller` / `onlyBuyer` / `onlyArbiter` ile korunur.
- **Kilitlenme riski yok**: Hem satıcı kargolamazsa (`refundIfNotShipped`) hem alıcı onay vermezse (`autoRelease`) fon sonsuza kadar kontratta kalmaz.

## Kurulum

```bash
npm install
```

`.env.example` dosyasını `.env` olarak kopyala ve doldur:

```bash
cp .env.example .env
```

`.env` içine testnet cüzdanının private key'ini (0x **olmadan**) yaz. **Gerçek/mainnet cüzdan key'i asla buraya yazılmamalı.**

## Test

```bash
npm test
```

33 test de geçmeli (state machine, yetki kontrolleri, timeout'lar, kısmi dispute çözümü dahil).

## Arc Testnet'e Deploy

1. Cüzdanına Arc Testnet faucet'inden (https://faucet.circle.com) test USDC'si al (gas için).
2. `.env` dosyasını doldur (`PRIVATE_KEY`, isteğe bağlı `ARBITER_ADDRESS`).
3. Deploy et:

```bash
npm run deploy:arc
```

4. Konsolda çıkan kontrat adresini ve `https://testnet.arcscan.app/address/...` explorer linkini kaydet.

## Arc Testnet Ağ Bilgileri

| Alan | Değer |
|---|---|
| Chain ID | 5042002 |
| RPC | https://rpc.testnet.arc.network |
| Explorer | https://testnet.arcscan.app |
| USDC (ERC-20) adresi | `0x3600000000000000000000000000000000000000` |
| Faucet | https://faucet.circle.com |

> ⚠️ Deploy öncesi USDC kontrat adresini mutlaka [docs.arc.io/arc/references/contract-addresses](https://docs.arc.io/arc/references/contract-addresses) sayfasından teyit et — Arc hızlı gelişen bir testnet, adresler değişebilir.

## Önemli Notlar

- Kullanıcının cüzdanında hem **gas için native USDC** (18 decimal) hem **ödeme için ERC-20 USDC** (6 decimal) bulunması gerekir. Bu ikisi farklı şeylerdir, arayüzde ayrı gösterilmeli.
- Alıcının `pay()` çağırabilmesi için önce escrow kontratına `approve()` ile yeterli allowance vermesi gerekir.
- `AUTO_RELEASE_TIMEOUT` (14 gün) ve `SHIP_TIMEOUT` (7 gün) şu an sabit (constant). Gerekirse v2'de escrow bazında değiştirilebilir hale getirilebilir.
- Kargo takip numarası (`trackingNumber`) kontrat tarafından doğrulanamaz, sadece dispute anında hakemin değerlendirmesi için bir kanıt niteliğindedir.

## Sıradaki Adımlar

- [ ] Frontend (Next.js) — cüzdan bağlama, escrow oluşturma/görüntüleme, durum takibi
- [ ] Dispute kanıt yükleme (fotoğraf) için basit bir storage entegrasyonu (IPFS/Pinata veya backend upload)
- [ ] Arc Testnet'e gerçek deploy ve explorer üzerinden doğrulama
- [ ] Demo videosu
